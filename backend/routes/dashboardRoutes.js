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
  WHERE ngo_id = ?`;

  const receivedQuery = `
  SELECT 
t.medicine_id,
t.quantity_transferred,
t.transfer_date,
t.expiry_date,
m.medicine_name
FROM Transfers t
LEFT JOIN Medicines m ON t.medicine_id = m.medicine_id
WHERE t.ngo_id = ?
`;

  db.query(requestsQuery,[ngo_id],(err,requests)=>{
    if(err) return res.status(500).send(err.message);

    db.query(receivedQuery,[ngo_id],(err,received)=>{
      if(err) return res.status(500).send(err.message);

      res.json({
        requests,
        received
      });
    });
  });

});

module.exports = router;
