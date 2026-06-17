const express = require("express");
const router = express.Router();
const db = require("../db");
const verifyToken = require("../middleware/authMiddleware");
const allowRoles = require("../middleware/roleMiddleware");
const allocationService = require("../utils/allocationService");

// 1. Get all transfers for the logged-in user (List view)
router.get("/", verifyToken, async (req, res) => {
    const { user_id, role } = req.user;

    let sql = "";
    let params = [];

    if (role === "Donor") {
        sql = `
            SELECT t.transfer_id, t.quantity_transferred, t.transfer_date, t.status, t.expiry_date,
                   m.medicine_name, u_ngo.name AS ngo_name
            FROM Transfers t
            JOIN Medicines m ON t.medicine_id = m.medicine_id
            JOIN Users u_ngo ON t.ngo_id = u_ngo.user_id
            WHERE m.donor_id = $1
            ORDER BY t.transfer_date DESC
        `;
        params = [user_id];
    } else if (role === "NGO") {
        sql = `
            SELECT t.transfer_id, t.quantity_transferred, t.transfer_date, t.status, t.expiry_date,
                   m.medicine_name, u_donor.name AS donor_name
            FROM Transfers t
            JOIN Medicines m ON t.medicine_id = m.medicine_id
            JOIN Users u_donor ON m.donor_id = u_donor.user_id
            WHERE t.ngo_id = $1
            ORDER BY t.transfer_date DESC
        `;
        params = [user_id];
    } else if (role === "Admin") {
        sql = `
            SELECT t.transfer_id, t.quantity_transferred, t.transfer_date, t.status, t.expiry_date,
                   m.medicine_name, u_donor.name AS donor_name, u_ngo.name AS ngo_name
            FROM Transfers t
            JOIN Medicines m ON t.medicine_id = m.medicine_id
            JOIN Users u_donor ON m.donor_id = u_donor.user_id
            JOIN Users u_ngo ON t.ngo_id = u_ngo.user_id
            ORDER BY t.transfer_date DESC
        `;
    }

    try {
        const result = await db.query(sql, params);
        return res.json(result.rows);
    } catch (err) {
        console.error("❌ Fetch Transfers List Error:", err);
        return res.status(500).send(err.message);
    }
});

// 2. Preview FEFO allocation breakdown
router.get("/preview-allocation", verifyToken, allowRoles("Donor"), async (req, res) => {
    const donor_id = req.user.user_id;
    const { request_id, quantity } = req.query;

    if (!request_id || !quantity || parseInt(quantity, 10) <= 0) {
        return res.status(400).json({ message: "Invalid request ID or quantity" });
    }

    try {
        const reqRes = await db.query("SELECT medicine_name FROM Requests WHERE request_id = $1", [request_id]);
        if (reqRes.rows.length === 0) {
            return res.status(404).json({ message: "Request not found" });
        }

        const request = reqRes.rows[0];
        const preview = await allocationService.previewAllocation(donor_id, request.medicine_name, parseInt(quantity, 10));
        return res.json(preview);
    } catch (err) {
        console.error("❌ Allocation Preview Error:", err);
        return res.status(500).json({ message: "Error calculating preview", error: err.message });
    }
});

// 3. Fulfill a request (Partial/Complete) using FEFO transaction-safe engine
router.post("/create", verifyToken, allowRoles("Donor"), async (req, res) => {
    console.log("🚀 TRANSFER API HIT (FEFO engine)");
    const donor_id = req.user.user_id;
    const { request_id, quantity } = req.body;

    if (!request_id || !quantity || quantity <= 0) {
        return res.status(400).json({ message: "Invalid request ID or quantity" });
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
            message: "Donation successful! Thank you for your support.",
            allocations: allocatedRecords
        });
    } catch (err) {
        await client.query("ROLLBACK");
        console.error("❌ Fulfill Request Transaction Error (Rolled Back):", err);
        return res.status(500).json({ message: "Database transaction error during allocation", error: err.message });
    } finally {
        client.release();
    }
});

// 3. Track a specific transfer timeline (Uber-style tracking)
router.get("/:id/track", verifyToken, async (req, res) => {
    const { id } = req.params;
    const { user_id, role } = req.user;

    const sql = `
        SELECT t.transfer_id, t.quantity_transferred, t.transfer_date, t.status, t.expiry_date,
               m.medicine_name, m.batch_number, m.donor_id,
               u_donor.name AS donor_name, u_donor.city AS donor_city,
               u_ngo.name AS ngo_name, u_ngo.city AS ngo_city,
               t.ngo_id
        FROM Transfers t
        JOIN Medicines m ON t.medicine_id = m.medicine_id
        JOIN Users u_donor ON m.donor_id = u_donor.user_id
        JOIN Users u_ngo ON t.ngo_id = u_ngo.user_id
        WHERE t.transfer_id = $1
    `;

    try {
        const result = await db.query(sql, [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Transfer record not found" });
        }

        const transfer = result.rows[0];

        // Security check: must be the donor, receiver NGO, or admin
        if (role !== "Admin" && transfer.donor_id !== user_id && transfer.ngo_id !== user_id) {
            return res.status(403).json({ message: "Access forbidden: You are not authorized to view this transfer." });
        }

        return res.json(transfer);
    } catch (err) {
        console.error("❌ Fetch Transfer Tracking Error:", err);
        return res.status(500).send(err.message);
    }
});

// 4. Update transfer status (Donor or Admin)
router.put("/:id/status", verifyToken, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const { user_id, role } = req.user;

    const validStatuses = [
        "Donation Submitted",
        "Verification Complete",
        "NGO Matched",
        "Transfer Approved",
        "Pickup Scheduled",
        "In Transit",
        "Delivered"
    ];

    if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid status value" });
    }

    try {
        // Fetch transfer to check ownership
        const transRes = await db.query(
            "SELECT t.*, m.donor_id, m.medicine_name FROM Transfers t JOIN Medicines m ON t.medicine_id = m.medicine_id WHERE t.transfer_id = $1",
            [id]
        );

        if (transRes.rows.length === 0) {
            return res.status(404).json({ message: "Transfer record not found" });
        }

        const transfer = transRes.rows[0];

        // Only the donor of that medicine or an admin can update the status
        if (role !== "Admin" && transfer.donor_id !== user_id) {
            return res.status(403).json({ message: "Forbidden: You are not authorized to update this status." });
        }

        await db.query(
            "UPDATE Transfers SET status = $1 WHERE transfer_id = $2",
            [status, id]
        );

        // Log to QueryLogs
        const description = `Transfer #${id} (${transfer.medicine_name}) updated to: ${status}`;
        await db.query(
            "INSERT INTO QueryLogs (action, description) VALUES ($1, $2)",
            ["TRANSFER_STATUS_UPDATED", description]
        );

        return res.json({ message: "Transfer status updated successfully", status });
    } catch (err) {
        console.error("❌ Update Transfer Status Error:", err);
        return res.status(500).send(err.message);
    }
});

module.exports = router;
