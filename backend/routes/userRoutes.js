const express = require("express");
const router = express.Router();
const db = require("../db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

router.post("/register", async (req,res)=>{

    const {name,email,password,role,city} = req.body;

    const hashedPassword = await bcrypt.hash(password,10);

    const sql = `
    INSERT INTO Users (name,email,password_hash,role,city)
    VALUES (?,?,?,?,?)
    `;

    db.query(sql,[name,email,hashedPassword,role,city],(err,result)=>{
        if(err) return res.send(err);
        res.send("User Registered Successfully");
    });
});
router.post("/login",(req,res)=>{

    const {email,password} = req.body;

    const sql = "SELECT * FROM Users WHERE email=?";

    db.query(sql,[email], async (err,result)=>{

        if(err) return res.send(err);
        if(result.length==0) return res.send("User not found");

        const user = result[0];

        const match = await bcrypt.compare(password,user.password_hash);

        if(!match) return res.send("Invalid Password");

        const token = jwt.sign(
            {user_id:user.user_id, role:user.role},
            "secretkey",
            {expiresIn:"1h"}
        );

        res.json({message:"Login Success", token});
    });
});


module.exports = router;
