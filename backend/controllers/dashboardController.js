const db = require("../db");

exports.getDonorDashboard = async (req, res) => {
    const donor_id = req.user.user_id;

    // Recent transfers SQL
    const recentTransfersSql = `
    SELECT
      t.transfer_id,
      t.quantity_transferred,
      t.transfer_date,
      m.medicine_name,
      u.name AS ngo_name
    FROM Transfers t
    JOIN Medicines m ON t.medicine_id = m.medicine_id
    JOIN Users u ON t.ngo_id = u.user_id
    WHERE m.donor_id = $1
    ORDER BY t.transfer_date DESC
    LIMIT 10;
    `;

    // Inventory SQL
    const inventorySql = `
    SELECT
      m.medicine_id,
      m.medicine_name,
      m.batch_number,
      m.expiry_date,
      m.quantity,
      mi.category
    FROM Medicines m
    JOIN Medicines_Info mi ON m.medicine_name = mi.medicine_name
    WHERE m.donor_id = $1
    ORDER BY m.medicine_id DESC;
    `;

    // Near-expiry count SQL (using Postgres date arithmetic)
    const nearExpiryCountSql = `
    SELECT 
      COUNT(DISTINCT m.medicine_id) AS near_expiry_count,
      COALESCE(SUM(m.quantity), 0) AS near_expiry_units
    FROM Medicines m
    WHERE m.donor_id = $1
      AND (m.expiry_date - CURRENT_DATE) BETWEEN 0 AND 30
      AND m.quantity > 0;
    `;

    try {
        // Call Stored Function for Summary
        const spResult = await db.query("SELECT * FROM get_donor_dashboard($1)", [donor_id]);
        const spSummary = spResult.rows.length > 0 ? spResult.rows[0] : {};

        // Get Recent Transfers
        const transfersResult = await db.query(recentTransfersSql, [donor_id]);

        // Get Inventory
        const inventoryResult = await db.query(inventorySql, [donor_id]);

        // Get Near-Expiry Count
        const nearExpiryCountResult = await db.query(nearExpiryCountSql, [donor_id]);

        // Keep classifyExpiry purely for frontend badge styling if needed
        const { classifyExpiry } = require("../utils/expiryLogic");
        
        const inventoryWithExpiry = inventoryResult.rows.map(item => {
            return {
                ...item,
                expiry_status: classifyExpiry(item.expiry_date)
            };
        });

        // Get near-expiry details
        const nearExpiryCount = nearExpiryCountResult.rows.length > 0 
            ? nearExpiryCountResult.rows[0].near_expiry_count 
            : 0;

        // Use Stored Procedure output with updated near-expiry count
        const enhancedSummary = {
            total_medicines_listed: spSummary.total_meds || 0,
            current_available_units: 0,
            available_count: spSummary.total_avail || 0,
            near_expiry_count: nearExpiryCount,
            expired_count: spSummary.total_exp || 0
        };

        const transferredRes = await db.query(
            `SELECT COALESCE(SUM(t.quantity_transferred), 0)::INT as total_units_transferred 
             FROM Transfers t 
             JOIN Medicines m ON t.medicine_id = m.medicine_id 
             WHERE m.donor_id = $1`, 
            [donor_id]
        );
        const availableRes = await db.query(
            `SELECT COALESCE(SUM(quantity), 0)::INT as current_available_units 
             FROM Medicines 
             WHERE donor_id = $1 AND status IN ('Available', 'Near Expiry') AND quantity > 0`, 
            [donor_id]
        );

        enhancedSummary.total_units_transferred = transferredRes.rows[0].total_units_transferred;
        enhancedSummary.current_available_units = availableRes.rows[0].current_available_units;

        return res.json({
            summary: enhancedSummary,
            recent_transfers: transfersResult.rows,
            inventory: inventoryWithExpiry
        });
    } catch (err) {
        console.error("❌ Donor Dashboard Fetch Error:", err);
        return res.status(500).send(err.message);
    }
};