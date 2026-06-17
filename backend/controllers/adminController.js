const db = require("../db");

// Get all users
exports.getAllUsers = async (req, res) => {
    try {
        const result = await db.query(
            "SELECT user_id, name, email, role, city, is_verified FROM Users ORDER BY role, user_id DESC"
        );
        return res.json(result.rows);
    } catch (err) {
        console.error("❌ Admin Get Users Error:", err);
        return res.status(500).send(err.message);
    }
};

// Toggle user verification
exports.toggleUserVerification = async (req, res) => {
    const { userId } = req.params;
    const { is_verified } = req.body;

    try {
        const result = await db.query(
            "UPDATE Users SET is_verified = $1 WHERE user_id = $2 RETURNING user_id, name, is_verified",
            [is_verified, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        // Log action in QueryLogs
        const user = result.rows[0];
        const statusText = is_verified ? "VERIFIED" : "UNVERIFIED";
        await db.query(
            "INSERT INTO QueryLogs (action, description) VALUES ($1, $2)",
            ["USER_VERIFICATION", `User ${user.name} (ID: ${user.user_id}) was ${statusText.toLowerCase()}`]
        );

        return res.json({
            message: `User status updated to ${statusText}`,
            user: user
        });
    } catch (err) {
        console.error("❌ Admin Verify User Error:", err);
        return res.status(500).send(err.message);
    }
};

// Get global system stats for Admin Dashboard
exports.getAdminStats = async (req, res) => {
    try {
        // Core KPIs
        const totalMedicinesQuery = "SELECT COALESCE(SUM(quantity), 0)::INT AS count FROM Medicines";
        const activeDonationsQuery = "SELECT COALESCE(SUM(quantity), 0)::INT AS count FROM Medicines WHERE status IN ('Available', 'Near Expiry') AND quantity > 0";
        const activeRequestsQuery = "SELECT COUNT(*)::INT AS count FROM Requests WHERE remaining_quantity > 0";
        const completedTransfersQuery = "SELECT COUNT(*)::INT AS count FROM Transfers";
        const expiringMedicinesQuery = "SELECT COALESCE(SUM(quantity), 0)::INT AS count FROM Medicines WHERE (expiry_date - CURRENT_DATE) BETWEEN 0 AND 30 AND quantity > 0";
        const wastePreventedQuery = "SELECT COALESCE(SUM(quantity_transferred), 0)::INT AS count FROM Transfers WHERE (expiry_date - DATE(transfer_date)) BETWEEN 0 AND 30";
        const savedViaFefoQuery = "SELECT COALESCE(SUM(quantity_allocated), 0)::INT AS count FROM Allocation_Logs";
        const fulfillmentRateQuery = `
            SELECT ROUND(
                COALESCE(
                    (SELECT COUNT(*)::FLOAT FROM Requests WHERE status IN ('Completed', 'Fulfilled')),
                    0
                ) / NULLIF((SELECT COUNT(*) FROM Requests), 0) * 100
            )::INT AS rate
        `;

        const [
            totalMeds,
            activeDonations,
            activeRequests,
            completedTransfers,
            expiringMeds,
            wastePrevented,
            savedViaFefo,
            fulfillmentRate
        ] = await Promise.all([
            db.query(totalMedicinesQuery),
            db.query(activeDonationsQuery),
            db.query(activeRequestsQuery),
            db.query(completedTransfersQuery),
            db.query(expiringMedicinesQuery),
            db.query(wastePreventedQuery),
            db.query(savedViaFefoQuery),
            db.query(fulfillmentRateQuery)
        ]);

        // Monthly Donations Chart
        const monthlyDonations = await db.query(`
            SELECT TO_CHAR(created_at, 'Mon YYYY') AS month, COALESCE(SUM(quantity), 0)::INT AS count
            FROM Medicines
            GROUP BY TO_CHAR(created_at, 'Mon YYYY'), DATE_TRUNC('month', created_at)
            ORDER BY DATE_TRUNC('month', created_at) ASC
            LIMIT 12
        `);

        // Monthly Requests Chart
        const monthlyRequests = await db.query(`
            SELECT TO_CHAR(created_at, 'Mon YYYY') AS month, COUNT(*)::INT AS count
            FROM Requests
            GROUP BY TO_CHAR(created_at, 'Mon YYYY'), DATE_TRUNC('month', created_at)
            ORDER BY DATE_TRUNC('month', created_at) ASC
            LIMIT 12
        `);

        // Top Medicines Chart (Most donated)
        const topMedicines = await db.query(`
            SELECT medicine_name, COALESCE(SUM(quantity), 0)::INT AS count
            FROM Medicines
            GROUP BY medicine_name
            ORDER BY count DESC
            LIMIT 5
        `);

        // Transfer analytics (Transfers by city / NGO)
        const transferAnalytics = await db.query(`
            SELECT u.city, COUNT(t.transfer_id)::INT AS transfer_count, COALESCE(SUM(t.quantity_transferred), 0)::INT AS total_quantity
            FROM Transfers t
            JOIN Users u ON t.ngo_id = u.user_id
            GROUP BY u.city
            ORDER BY total_quantity DESC
            LIMIT 5
        `);

        return res.json({
            kpis: {
                total_medicines: totalMeds.rows[0].count,
                active_donations: activeDonations.rows[0].count,
                active_requests: activeRequests.rows[0].count,
                completed_transfers: completedTransfers.rows[0].count,
                expiring_medicines: expiringMeds.rows[0].count,
                waste_prevented: wastePrevented.rows[0].count,
                saved_via_fefo: savedViaFefo.rows[0].count,
                fulfillment_rate: fulfillmentRate.rows[0].rate || 0
            },
            charts: {
                monthly_donations: monthlyDonations.rows,
                monthly_requests: monthlyRequests.rows,
                top_medicines: topMedicines.rows,
                transfer_analytics: transferAnalytics.rows
            }
        });

    } catch (err) {
        console.error("❌ Admin Get Stats Error:", err);
        return res.status(500).send(err.message);
    }
};
