const express = require("express");
const router = express.Router();
const db = require("../db");
const verifyToken = require("../middleware/authMiddleware");
const allowRoles = require("../middleware/roleMiddleware");

// NGO posts a request
router.post("/create", verifyToken, allowRoles("NGO"), (req, res) => {
    const { medicine_name, required_quantity, urgency } = req.body;
    const ngo_id = req.user.user_id;

    const infoSql = `INSERT IGNORE INTO Medicines_Info (medicine_name, category) VALUES (?, 'Other')`;
    
    db.query(infoSql, [medicine_name], (err) => {
        if (err) {
            console.error("❌ Add Medicine_Info Error:", err);
            return res.status(500).json({ message: "Database Error", error: err.message });
        }

        const sql = `
        INSERT INTO Requests 
        (ngo_id, medicine_name, required_quantity, remaining_quantity, urgency)
        VALUES (?,?,?,?,?)
        `;

        db.query(sql, [ngo_id, medicine_name, required_quantity, required_quantity, urgency], (err) => {
            if (err) {
                console.error("❌ Create Request Error:", err);
                return res.status(500).json({ message: "Database Error", error: err.message });
            }
            res.status(201).json({ message: "Request Created Successfully" });
        });
    });
});

router.get("/my-requests", verifyToken, allowRoles("NGO"), (req, res) => {
    const ngo_id = req.user.user_id;

    db.query("SELECT * FROM Requests WHERE ngo_id=?", [ngo_id], (err, result) => {
        if (err) {
            console.error("❌ Fetch My Requests Error:", err);
            return res.status(500).json({ message: "Database Error", error: err.message });
        }
        res.json(result);
    });
});

router.get("/matching-needs", verifyToken, allowRoles("Donor"), (req, res) => {
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
    WHERE m.donor_id = ?
    AND m.status = 'Available'
    AND m.quantity > 0
    AND d.city = u.city
    AND r.remaining_quantity > 0
    GROUP BY m.medicine_name, r.request_id, r.required_quantity, r.remaining_quantity, r.urgency, u.name, u.city
    `;

    db.query(sql, [donor_id], (err, result) => {
        if (err) {
            console.error("❌ Fetch Matching Needs Error:", err);
            return res.status(500).json({ message: "Database Error", error: err.message });
        }
        res.json(result);
    });
});

router.post("/fulfill", verifyToken, allowRoles("Donor"), (req,res)=>{

  const donor_id = req.user.user_id;
  const {request_id, quantity} = req.body;

  if(!quantity || quantity <= 0)
    return res.status(400).send("Invalid quantity");

  db.query(
    "SELECT * FROM Requests WHERE request_id=?",
    [request_id],
    (err, requestResult)=>{
      if(err) return res.status(500).send(err.message);
      if(requestResult.length===0)
        return res.status(404).send("Request not found");

      const request = requestResult[0];

      if(quantity > request.remaining_quantity)
        return res.status(400).send("Quantity exceeds remaining need");

      db.query(
        `SELECT * FROM Medicines
         WHERE donor_id=? 
         AND medicine_name=? 
         AND status='Available'
         AND quantity > 0
         ORDER BY expiry_date ASC`,
        [donor_id, request.medicine_name],
        (err, medicines)=>{

          if(err) return res.status(500).send(err.message);
          if(medicines.length===0)
            return res.status(400).send("No stock available");

          let remaining = quantity;
          let index = 0;

          function processNextBatch() {
            if (remaining <= 0) {
              return res.json({ message: "Request fulfilled successfully (FEFO)" });
            }

            if (index >= medicines.length) {
              return res.status(400).send("Not enough stock across batches");
            }

            const batch = medicines[index++];
            const deduct = Math.min(batch.quantity, remaining);

            // Use the Advanced SQL Stored Procedure!
            db.query(
              "CALL fulfill_request(?, ?, ?)",
              [request_id, batch.medicine_id, deduct],
              (err) => {
                if (err) {
                  console.error("Fulfill Request SP Error:", err);
                  return res.status(500).send("Database error during fulfillment");
                }
                remaining -= deduct;
                processNextBatch(); // Move to next batch if needed
              }
            );
          }

          processNextBatch();
        }
      );
    }
  );
});



module.exports = router;
