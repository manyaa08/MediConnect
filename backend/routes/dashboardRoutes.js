const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/authMiddleware");
const allowRoles = require("../middleware/roleMiddleware");
const { getDonorDashboard } = require("../controllers/dashboardController");
const db = require("../db");

router.get("/donor", verifyToken, allowRoles("Donor"), getDonorDashboard);

router.get("/ngo", verifyToken, allowRoles("NGO"), (req,res)=>{

  const ngo_id = req.user.user_id;

  const requestsQuery = `
  SELECT request_id, medicine_name, required_quantity,
         remaining_quantity, urgency, status
  FROM Requests
  WHERE ngo_id = ? AND remaining_quantity > 0`;

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
  WHERE t.ngo_id = ?
  ORDER BY t.transfer_date DESC
  `;

  // 🔴 Near-expiry received medicines count
  const nearExpiryReceivedQuery = `
  SELECT 
    COUNT(DISTINCT t.transfer_id) AS ngo_near_expiry_count,
    COALESCE(SUM(t.quantity_transferred), 0) AS ngo_near_expiry_units
  FROM Transfers t
  WHERE t.ngo_id = ?
    AND DATEDIFF(t.expiry_date, CURRENT_DATE()) BETWEEN 0 AND 7
  `;

  db.query(requestsQuery,[ngo_id],(err,requests)=>{
    if(err) return res.status(500).send(err.message);

    db.query(receivedQuery,[ngo_id],(err,received)=>{
      if(err) return res.status(500).send(err.message);

      // Get near-expiry count
      db.query(nearExpiryReceivedQuery,[ngo_id],(err,nearExpiryResult)=>{
        if(err) return res.status(500).send(err.message);

        const nearExpiryData = nearExpiryResult && nearExpiryResult.length > 0 
          ? nearExpiryResult[0] 
          : { ngo_near_expiry_count: 0, ngo_near_expiry_units: 0 };

        res.json({
          requests,
          received,
          near_expiry_summary: nearExpiryData
        });
      });
    });
  });

});

module.exports = router;
