const express = require("express");
const router = express.Router();
const db = require("../db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

router.post("/register", async (req,res)=>{
    console.log("✅ HIT /register route");  // 👈 ADD THIS

    const {name,email,password,role,city} = req.body;

    if(!name || !email || !password || !role || !city){
        return res.status(400).json({ message: "All fields are required" });
    }

    console.log("Hashing password...");
    const hashedPassword = await bcrypt.hash(password,10);

    console.log("🚀 BEFORE DB QUERY"); // 👈 ADD THIS

    const sql = `
    INSERT INTO users (name,email,password_hash,role,city)
    VALUES (?,?,?,?,?)
    `;

    db.query(sql,[name,email,hashedPassword,role,city],(err,result)=>{
        console.log("🔥 INSIDE DB CALLBACK"); // 👈 ADD THIS

        if(err) {
            console.error("DB Error:", err);
            return res.status(500).json({ message: "Registration failed" });
        }

        return res.status(201).json({ message: "User Registered Successfully" });
    });
});


router.post("/login",(req,res)=>{
    console.log("✅ HIT /login route", req.body);
    const {email,password} = req.body;

    if(!email || !password){
        console.log("Missing fields");
        return res.status(400).json({ message: "Email and password are required" });
    }

    const sql = "SELECT * FROM users WHERE email=?";
    console.log("🚀 BEFORE DB QUERY");

    db.query(sql,[email], async (err,result)=>{
        console.log("🔥 INSIDE DB CALLBACK");
        if(err) {
            console.error("DB Error:", err);
            return res.status(500).json({ message: "Login failed" });
        }
        
        console.log("DB Result length:", result.length);
        if(result.length==0) return res.status(404).json({ message: "User not found" });

        const user = result[0];
        console.log("User found, comparing password...");

        const match = await bcrypt.compare(password,user.password_hash);
        console.log("Password match result:", match);

        if(!match) return res.status(401).json({ message: "Invalid Password" });

        console.log("Signing JWT...");
        const token = jwt.sign(
            {user_id:user.user_id, role:user.role},
            "secretkey",
            {expiresIn:"1h"}
        );

        console.log("Sending successful login response!");
        res.json({
            message: "Login Success",
            token,
            user: {
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    });
});

module.exports = router;
