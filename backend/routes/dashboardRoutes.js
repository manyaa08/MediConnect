const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/authMiddleware");
const allowRoles = require("../middleware/roleMiddleware");
const { getDonorDashboard } = require("../controllers/dashboardController");
const db = require("../db");

// Donor dashboard route
router.get("/donor", verifyToken, allowRoles("Donor"), getDonorDashboard);

// NGO dashboard route
router.get("/ngo", verifyToken, allowRoles("NGO"), async (req, res) => {
    const ngo_id = req.user.user_id;

    const requestsQuery = `
    SELECT request_id, medicine_name, required_quantity,
           remaining_quantity, urgency, status
    FROM Requests
    WHERE ngo_id = $1 AND remaining_quantity > 0`;

    const receivedQuery = `
    SELECT 
      t.medicine_id,
      t.quantity_transferred,
      t.transfer_date,
      t.expiry_date,
      m.medicine_name,
      u.name AS donor_name
    FROM Transfers t
    LEFT JOIN Medicines m ON t.medicine_id = m.medicine_id
    LEFT JOIN Users u ON m.donor_id = u.user_id
    WHERE t.ngo_id = $1
    ORDER BY t.transfer_date DESC
    `;

    // Near-expiry received medicines count using Postgres date arithmetic
    const nearExpiryReceivedQuery = `
    SELECT 
      COUNT(DISTINCT t.transfer_id) AS ngo_near_expiry_count,
      COALESCE(SUM(t.quantity_transferred), 0) AS ngo_near_expiry_units
    FROM Transfers t
    WHERE t.ngo_id = $1
      AND (t.expiry_date - CURRENT_DATE) BETWEEN 0 AND 30
    `;

    try {
        // Run queries in parallel
        const [requestsRes, receivedRes, nearExpiryRes] = await Promise.all([
            db.query(requestsQuery, [ngo_id]),
            db.query(receivedQuery, [ngo_id]),
            db.query(nearExpiryReceivedQuery, [ngo_id])
        ]);

        const nearExpiryData = nearExpiryRes.rows.length > 0 
            ? nearExpiryRes.rows[0] 
            : { ngo_near_expiry_count: 0, ngo_near_expiry_units: 0 };

        return res.json({
            requests: requestsRes.rows,
            received: receivedRes.rows,
            near_expiry_summary: nearExpiryData
        });
    } catch (err) {
        console.error("❌ NGO Dashboard Fetch Error:", err);
        return res.status(500).send(err.message);
    }
});

// Paginated global activity feed
router.get("/activity-feed", verifyToken, async (req, res) => {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;

    try {
        const countRes = await db.query("SELECT COUNT(*)::INT as total FROM QueryLogs");
        const totalLogs = countRes.rows[0].total || 0;
        const totalPages = Math.ceil(totalLogs / limit);

        const logsRes = await db.query(
            "SELECT log_id, action, description, created_at FROM QueryLogs ORDER BY created_at DESC LIMIT $1 OFFSET $2",
            [limit, offset]
        );

        return res.json({
            logs: logsRes.rows,
            page,
            totalPages,
            totalLogs
        });
    } catch (err) {
        console.error("❌ Fetch Activity Feed Error:", err);
        return res.status(500).send(err.message);
    }
});

module.exports = router;
