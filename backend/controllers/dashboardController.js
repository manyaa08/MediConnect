const db = require("../db");

exports.getDonorDashboard = (req, res) => {
  const donor_id = req.user.user_id;

  const summarySql = `
  SELECT
    COUNT(DISTINCT m.medicine_id) AS total_medicines_listed,
    COALESCE(SUM(t.quantity_transferred),0) AS total_units_transferred,
    COALESCE(SUM(CASE WHEN m.status='Available' THEN m.quantity ELSE 0 END),0) AS current_available_units
  FROM Medicines m
  LEFT JOIN Transfers t ON m.medicine_id = t.medicine_id
  WHERE m.donor_id = ?;
  `;

  const recentTransfersSql = `
  SELECT
    t.transfer_id,
    t.quantity_transferred,
    t.transfer_date,
    m.medicine_name,
    u.name AS ngo_name
  FROM Transfers t
  JOIN Medicines m ON t.medicine_id = m.medicine_id
  JOIN Users u ON t.ngo_id = u.user_id
  WHERE m.donor_id = ?
  ORDER BY t.transfer_date DESC
  LIMIT 10;
  `;

  db.query(summarySql, [donor_id], (err, summaryResult) => {
    if (err) return res.send(err);

    db.query(recentTransfersSql, [donor_id], (err, transfersResult) => {
      if (err) return res.send(err);

      res.json({
        summary: summaryResult[0],
        recent_transfers: transfersResult
      });
    });
  });
};
