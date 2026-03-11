const express = require("express");
const router = express.Router();
const db = require("../db");
const verifyToken = require("../middleware/authMiddleware");
const allowRoles = require("../middleware/roleMiddleware");

router.post("/add", verifyToken, allowRoles("Donor"), (req,res)=>{
    const donor_id = req.user.user_id;
    const { medicine_name, batch_number, expiry_date, quantity, category} = req.body;

    const sql = `
    INSERT INTO Medicines 
    (donor_id, medicine_name, batch_number, expiry_date, quantity, category)
    VALUES (?,?,?,?,?,?)
    `;

    db.query(sql,[donor_id, medicine_name, batch_number, expiry_date, quantity, category],(err,result)=>{
        if(err) return res.send(err);
        res.send("Medicine Added Successfully");
    });
});

router.get("/available",(req,res)=>{
    db.query("SELECT * FROM Medicines WHERE status='Available'",(err,result)=>{
        if(err) return res.send(err);
        res.send(result);
    });
});

router.post("/claim",verifyToken, allowRoles("NGO"), (req,res)=>{

    const {medicine_id, ngo_id} = req.body;

    db.beginTransaction((err)=>{
        if(err) return res.send(err);

        const insertTransfer = `
        INSERT INTO Transfers (medicine_id, ngo_id)
        VALUES (?,?)
        `;

        db.query(insertTransfer,[medicine_id,ngo_id],(err)=>{
            if(err){
                return db.rollback(()=> res.send(err));
            }

            const updateMedicine = `
            UPDATE Medicines SET status='Claimed'
            WHERE medicine_id=?
            `;

            db.query(updateMedicine,[medicine_id],(err)=>{
                if(err){
                    return db.rollback(()=> res.send(err));
                }

                db.commit((err)=>{
                    if(err){
                        return db.rollback(()=> res.send(err));
                    }
                    res.send("Medicine Claimed Successfully (Transaction Safe)");
                });
            });

        });
    });

});

router.get("/my-medicines", verifyToken, allowRoles("Donor"), (req,res)=>{

  const donor_id = req.user.user_id;

  db.query("SELECT * FROM Medicines WHERE donor_id=?", [donor_id], (err,result)=>{
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
      m.category,
      u.name AS donor_name,
      u.city
  FROM Medicines m
  JOIN Users u ON m.donor_id = u.user_id
  WHERE m.status='Available'
  ORDER BY m.medicine_name, m.expiry_date ASC
  `;

  db.query(sql,(err,result)=>{
    if(err) return res.status(500).send(err.message);
    res.json(result);
  });

});


module.exports = router;
