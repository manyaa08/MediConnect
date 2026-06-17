const express = require("express");
const router = express.Router();
const db = require("../db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// User registration
router.post("/register", async (req, res) => {
    console.log("✅ HIT /register route");
    const { name, email, password, role, city } = req.body;

    if (!name || !email || !password || !role || !city) {
        return res.status(400).json({ message: "All fields are required" });
    }

    try {
        console.log("Hashing password...");
        const hashedPassword = await bcrypt.hash(password, 10);

        console.log("🚀 BEFORE DB QUERY");
        const sql = `
        INSERT INTO Users (name, email, password_hash, role, city)
        VALUES ($1, $2, $3, $4, $5)
        `;

        await db.query(sql, [name, email, hashedPassword, role, city]);
        console.log("🔥 DB INSERT SUCCESS");
        return res.status(201).json({ message: "User Registered Successfully" });
    } catch (err) {
        console.error("❌ Registration Error:", err);
        return res.status(500).json({ message: "Registration failed", error: err.message });
    }
});

// User login
router.post("/login", async (req, res) => {
    console.log("✅ HIT /login route", req.body);
    const { email, password } = req.body;

    if (!email || !password) {
        console.log("Missing fields");
        return res.status(400).json({ message: "Email and password are required" });
    }

    try {
        const sql = "SELECT * FROM Users WHERE email = $1";
        console.log("🚀 BEFORE DB QUERY");
        const result = await db.query(sql, [email]);
        console.log("🔥 DB SELECT SUCCESS");

        console.log("DB Result length:", result.rows.length);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        const user = result.rows[0];
        console.log("User found, comparing password...");
        const match = await bcrypt.compare(password, user.password_hash);
        console.log("Password match result:", match);

        if (!match) {
            return res.status(401).json({ message: "Invalid Password" });
        }

        console.log("Signing JWT...");
        const token = jwt.sign(
            { user_id: user.user_id, role: user.role },
            "secretkey",
            { expiresIn: "1h" }
        );

        console.log("Sending successful login response!");
        return res.json({
            message: "Login Success",
            token,
            user: {
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (err) {
        console.error("❌ Login Error:", err);
        return res.status(500).json({ message: "Login failed", error: err.message });
    }
});

module.exports = router;
