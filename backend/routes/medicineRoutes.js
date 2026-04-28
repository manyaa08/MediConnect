const express = require("express");
const router = express.Router();
const db = require("../db");
const verifyToken = require("../middleware/authMiddleware");
const allowRoles = require("../middleware/roleMiddleware");

router.post("/add", verifyToken, allowRoles("Donor"), (req, res) => {
    const donor_id = req.user.user_id;
    const { medicine_name, batch_number, expiry_date, quantity, category } = req.body;

    const infoSql = `INSERT IGNORE INTO Medicines_Info (medicine_name, category) VALUES (?, ?)`;
    const medSql = `
    INSERT INTO Medicines 
    (donor_id, medicine_name, batch_number, expiry_date, quantity, status)
    VALUES (?,?,?,?,?, 'Available')
    `;

    db.query(infoSql, [medicine_name, category], (err) => {
        if (err) {
            console.error("❌ Add Medicine_Info Error:", err);
            return res.status(500).json({ message: "Database Error", error: err.message });
        }
        
        db.query(medSql, [donor_id, medicine_name, batch_number, expiry_date, quantity], (err, result) => {
            if (err) {
                console.error("❌ Add Medicine Error:", err);
                return res.status(500).json({ message: "Database Error", error: err.message });
            }
            res.status(201).json({ message: "Medicine Added Successfully", medicine_id: result.insertId });
        });
    });
});

router.get("/available", (req, res) => {
    db.query("SELECT m.*, mi.category FROM Medicines m JOIN Medicines_Info mi ON m.medicine_name = mi.medicine_name WHERE m.status='Available' AND m.quantity > 0", (err, result) => {
        if (err) {
            console.error("❌ Fetch Available Error:", err);
            return res.status(500).json({ message: "Database Error", error: err.message });
        }
        res.json(result);
    });
});

router.post("/claim",verifyToken, allowRoles("NGO"), (req,res)=>{

    const {medicine_id, ngo_id} = req.body; // ngo_id should likely match req.user.user_id

    // Check if verified NGO
    db.query("SELECT * FROM Users WHERE user_id=?", [req.user.user_id], (err, users) => {
        if(err) return res.status(500).send(err.message);
        
        // Assume default is 1 if column doesn't exist, but if it exists and is 0 (false)
        if(users.length > 0 && users[0].is_verified === 0) {
            return res.status(403).send("Only verified NGOs can claim medicines");
        }

        db.beginTransaction((err)=>{
            if(err) return res.status(500).send(err.message);

            // Fetch expiry_date to insert in Transfers table
            db.query("SELECT expiry_date, quantity FROM Medicines WHERE medicine_id=?", [medicine_id], (err, medResult) => {
                if(err || medResult.length === 0) {
                    return db.rollback(()=> res.status(400).send("Medicine not found"));
                }
                const expiry_date = medResult[0].expiry_date;
                const quantity_transferred = medResult[0].quantity;

                const insertTransfer = `
                INSERT INTO Transfers (medicine_id, ngo_id, quantity_transferred, expiry_date)
                VALUES (?,?,?,?)
                `;

                db.query(insertTransfer, [medicine_id, req.user.user_id, quantity_transferred, expiry_date], (err) => {
                    if (err) {
                        return db.rollback(() => res.status(500).json({ message: "Failed to log transfer", error: err.message }));
                    }

                    const updateMedicine = `
                    UPDATE Medicines SET status='Claimed', quantity=0
                    WHERE medicine_id=? AND status='Available'
                    `;

                    db.query(updateMedicine, [medicine_id], (err, updateRes) => {
                        if (err) {
                            return db.rollback(() => res.status(500).json({ message: "Failed to update medicine status", error: err.message }));
                        }

                        if (updateRes.affectedRows === 0) {
                            return db.rollback(() => res.status(400).json({ message: "Medicine already claimed or unavailable" }));
                        }

                        db.commit((err) => {
                            if (err) {
                                return db.rollback(() => res.status(500).json({ message: "Commit error", error: err.message }));
                            }
                            res.json({ message: "Medicine Claimed Successfully (Transaction Safe)" });
                        });
                    });
                });
            });
        });
    });
});

router.get("/my-medicines", verifyToken, allowRoles("Donor"), (req,res)=>{

  const donor_id = req.user.user_id;

  db.query("SELECT m.*, mi.category FROM Medicines m JOIN Medicines_Info mi ON m.medicine_name = mi.medicine_name WHERE m.donor_id=? AND m.quantity > 0", [donor_id], (err,result)=>{
    if(err) return res.status(500).send(err.message);
    res.json(result);
  });

});

router.get("/all-available", verifyToken, (req,res)=>{

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
  WHERE m.status='Available' AND m.quantity > 0
  ORDER BY m.medicine_name, m.expiry_date ASC
  `;

  db.query(sql,(err,result)=>{
    if(err) return res.status(500).send(err.message);
    res.json(result);
  });

});


module.exports = router;
