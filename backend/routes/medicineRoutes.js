const express = require("express");
const router = express.Router();
const db = require("../db");
const verifyToken = require("../middleware/authMiddleware");
const allowRoles = require("../middleware/roleMiddleware");

// Add a new medicine
router.post("/add", verifyToken, allowRoles("Donor"), async (req, res) => {
    const donor_id = req.user.user_id;
    const { medicine_name, batch_number, expiry_date, quantity, category } = req.body;

    if (!medicine_name || !expiry_date || !quantity || !category) {
        return res.status(400).json({ message: "Required fields are missing" });
    }

    const infoSql = `INSERT INTO Medicines_Info (medicine_name, category) VALUES ($1, $2) ON CONFLICT (medicine_name) DO NOTHING`;
    const medSql = `
    INSERT INTO Medicines 
    (donor_id, medicine_name, batch_number, expiry_date, quantity, status)
    VALUES ($1, $2, $3, $4, $5, 'Available') RETURNING medicine_id
    `;

    try {
        await db.query(infoSql, [medicine_name, category]);
        const result = await db.query(medSql, [donor_id, medicine_name, batch_number, expiry_date, quantity]);
        
        // Log activity feed
        const donorNameRes = await db.query("SELECT name FROM Users WHERE user_id = $1", [donor_id]);
        const donorName = donorNameRes.rows.length > 0 ? donorNameRes.rows[0].name : `Donor #${donor_id}`;
        const logDesc = `${donorName} donated ${quantity} units of ${medicine_name}`;
        await db.query("INSERT INTO QueryLogs (action, description) VALUES ('MEDICINE_DONATED', $1)", [logDesc]);

        return res.status(201).json({ 
            message: "Medicine Added Successfully", 
            medicine_id: result.rows[0].medicine_id 
        });
    } catch (err) {
        console.error("❌ Add Medicine Error:", err);
        return res.status(500).json({ message: "Database Error", error: err.message });
    }
});

// Fetch all available medicines for public/NGO consumption
router.get("/available", async (req, res) => {
    try {
        const result = await db.query(
            "SELECT m.*, mi.category FROM Medicines m JOIN Medicines_Info mi ON m.medicine_name = mi.medicine_name WHERE m.status = 'Available' AND m.quantity > 0"
        );
        return res.json(result.rows);
    } catch (err) {
        console.error("❌ Fetch Available Error:", err);
        return res.status(500).json({ message: "Database Error", error: err.message });
    }
});

// Claim a medicine (Requires Transaction)
router.post("/claim", verifyToken, allowRoles("NGO"), async (req, res) => {
    const { medicine_id } = req.body;

    if (!medicine_id) {
        return res.status(400).json({ message: "Medicine ID is required" });
    }

    // Check if verified NGO
    try {
        const usersResult = await db.query("SELECT * FROM Users WHERE user_id = $1", [req.user.user_id]);
        if (usersResult.rows.length === 0) {
            return res.status(404).send("User not found");
        }

        const user = usersResult.rows[0];
        if (user.is_verified === false) {
            return res.status(403).send("Only verified NGOs can claim medicines");
        }
    } catch (err) {
        console.error("❌ Check NGO Verification Error:", err);
        return res.status(500).send(err.message);
    }

    // Start database transaction
    const client = await db.connect();
    try {
        await client.query("BEGIN");

        // Fetch expiry_date to insert in Transfers table
        const medResult = await client.query(
            "SELECT expiry_date, quantity FROM Medicines WHERE medicine_id = $1", 
            [medicine_id]
        );

        if (medResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(400).send("Medicine not found");
        }

        const expiry_date = medResult.rows[0].expiry_date;
        const quantity_transferred = medResult.rows[0].quantity;

        const insertTransfer = `
        INSERT INTO Transfers (medicine_id, ngo_id, quantity_transferred, expiry_date)
        VALUES ($1, $2, $3, $4)
        `;

        await client.query(insertTransfer, [medicine_id, req.user.user_id, quantity_transferred, expiry_date]);

        await client.query("COMMIT");
        return res.json({ message: "Medicine Claimed Successfully" });
    } catch (err) {
        await client.query("ROLLBACK");
        console.error("❌ Claim Transaction Failed, rolled back:", err);
        return res.status(500).json({ message: "Failed to log transfer", error: err.message });
    } finally {
        client.release();
    }
});

// Fetch medicines uploaded by the logged-in donor
router.get("/my-medicines", verifyToken, allowRoles("Donor"), async (req, res) => {
    const donor_id = req.user.user_id;

    try {
        const result = await db.query(
            "SELECT m.*, mi.category FROM Medicines m JOIN Medicines_Info mi ON m.medicine_name = mi.medicine_name WHERE m.donor_id = $1 AND m.quantity > 0", 
            [donor_id]
        );
        return res.json(result.rows);
    } catch (err) {
        console.error("❌ Fetch My Medicines Error:", err);
        return res.status(500).send(err.message);
    }
});

// Fetch all available medicines with donor details and expiry status
router.get("/all-available", verifyToken, async (req, res) => {
    const sql = `
    SELECT 
        m.medicine_id,
        m.medicine_name,
        m.batch_number,
        m.expiry_date,
        m.quantity,
        mi.category,
        u.name AS donor_name,
        u.city
    FROM Medicines m
    JOIN Medicines_Info mi ON m.medicine_name = mi.medicine_name
    JOIN Users u ON m.donor_id = u.user_id
    WHERE m.quantity > 0
    ORDER BY m.medicine_name, m.expiry_date ASC
    `;

    try {
        const result = await db.query(sql);
        const { classifyExpiry } = require("../utils/expiryLogic");
        
        const inventoryWithExpiry = result.rows.map(item => {
            return {
                ...item,
                expiry_status: classifyExpiry(item.expiry_date)
            };
        });

        return res.json(inventoryWithExpiry);
    } catch (err) {
        console.error("❌ Fetch All Available Error:", err);
        return res.status(500).send(err.message);
    }
});

module.exports = router;
