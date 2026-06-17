const express = require("express");
const router = express.Router();
const db = require("../db");
const verifyToken = require("../middleware/authMiddleware");
const allowRoles = require("../middleware/roleMiddleware");
const allocationService = require("../utils/allocationService");

// NGO posts a request
router.post("/create", verifyToken, allowRoles("NGO"), async (req, res) => {
    const { medicine_name, required_quantity, urgency } = req.body;
    const ngo_id = req.user.user_id;

    if (!medicine_name || !required_quantity) {
        return res.status(400).json({ message: "Medicine name and required quantity are required" });
    }

    const infoSql = `INSERT INTO Medicines_Info (medicine_name, category) VALUES ($1, 'Other') ON CONFLICT (medicine_name) DO NOTHING`;
    const sql = `
    INSERT INTO Requests 
    (ngo_id, medicine_name, required_quantity, remaining_quantity, urgency)
    VALUES ($1, $2, $3, $4, $5)
    `;

    try {
        await db.query(infoSql, [medicine_name]);
        await db.query(sql, [ngo_id, medicine_name, required_quantity, required_quantity, urgency || "Normal"]);
        
        // Log activity feed
        const ngoNameRes = await db.query("SELECT name FROM Users WHERE user_id = $1", [ngo_id]);
        const ngoName = ngoNameRes.rows.length > 0 ? ngoNameRes.rows[0].name : `NGO #${ngo_id}`;
        const logDesc = `${ngoName} requested ${required_quantity} units of ${medicine_name}`;
        await db.query("INSERT INTO QueryLogs (action, description) VALUES ('REQUEST_CREATED', $1)", [logDesc]);

        return res.status(201).json({ message: "Request Created Successfully" });
    } catch (err) {
        console.error("❌ Create Request Error:", err);
        return res.status(500).json({ message: "Database Error", error: err.message });
    }
});

// Fetch logged-in NGO's requests
router.get("/my-requests", verifyToken, allowRoles("NGO"), async (req, res) => {
    const ngo_id = req.user.user_id;

    try {
        const result = await db.query("SELECT * FROM Requests WHERE ngo_id = $1", [ngo_id]);
        return res.json(result.rows);
    } catch (err) {
        console.error("❌ Fetch My Requests Error:", err);
        return res.status(500).json({ message: "Database Error", error: err.message });
    }
});

// Match NGO needs with Donor inventory (same city matching)
router.get("/matching-needs", verifyToken, allowRoles("Donor"), async (req, res) => {
    const donor_id = req.user.user_id;

    const sql = `
    SELECT 
        m.medicine_name,
        SUM(m.quantity) AS total_available,
        r.request_id,
        r.required_quantity,
        r.remaining_quantity,
        r.urgency,
        u.name AS ngo_name,
        u.city
    FROM Medicines m
    JOIN Requests r ON m.medicine_name = r.medicine_name
    JOIN Users u ON r.ngo_id = u.user_id
    JOIN Users d ON m.donor_id = d.user_id
    WHERE m.donor_id = $1
      AND m.status = 'Available'
      AND m.quantity > 0
      AND d.city = u.city
      AND r.remaining_quantity > 0
    GROUP BY m.medicine_name, r.request_id, r.required_quantity, r.remaining_quantity, r.urgency, u.name, u.city
    `;

    try {
        const result = await db.query(sql, [donor_id]);
        return res.json(result.rows);
    } catch (err) {
        console.error("❌ Fetch Matching Needs Error:", err);
        return res.status(500).json({ message: "Database Error", error: err.message });
    }
});

// Fulfill a request (FEFO based batch selection) using transaction-safe allocation engine
router.post("/fulfill", verifyToken, allowRoles("Donor"), async (req, res) => {
    const donor_id = req.user.user_id;
    const { request_id, quantity } = req.body;

    if (!request_id || !quantity || quantity <= 0) {
        return res.status(400).send("Invalid request ID or quantity");
    }

    const client = await db.connect();
    try {
        await client.query("BEGIN");
        
        const allocatedRecords = await allocationService.allocateInventory(
            client,
            donor_id,
            request_id,
            parseInt(quantity, 10)
        );

        await client.query("COMMIT");
        return res.json({ 
            message: "Request fulfilled successfully (FEFO)",
            allocations: allocatedRecords
        });
    } catch (err) {
        await client.query("ROLLBACK");
        console.error("❌ Fulfill Request Transaction Error (Rolled Back):", err);
        return res.status(500).send("Database transaction error during allocation: " + err.message);
    } finally {
        client.release();
    }
});

module.exports = router;
