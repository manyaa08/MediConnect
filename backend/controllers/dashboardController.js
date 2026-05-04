const db = require("../db");

exports.getDonorDashboard = (req, res) => {
  const donor_id = req.user.user_id;

  // 🔹 Summary
  const summarySql = `
  SELECT
    COUNT(DISTINCT m.medicine_id) AS total_medicines_listed,
    COALESCE(SUM(t.quantity_transferred),0) AS total_units_transferred,
    COALESCE(SUM(CASE WHEN m.status='Available' THEN m.quantity ELSE 0 END),0) AS current_available_units
  FROM Medicines m
  LEFT JOIN Transfers t ON m.medicine_id = t.medicine_id
  WHERE m.donor_id = ?;
  `;

  // 🔹 Recent transfers
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

  // 🔥 Inventory query
  const inventorySql = `
  SELECT
    m.medicine_id,
    m.medicine_name,
    m.batch_number,
    m.expiry_date,
    m.quantity,
    mi.category
  FROM Medicines m
  JOIN Medicines_Info mi ON m.medicine_name = mi.medicine_name
  WHERE m.donor_id = ?
  ORDER BY m.medicine_id DESC;
  `;

  // 🔴 Near-expiry count query
  const nearExpiryCountSql = `
  SELECT 
    COUNT(DISTINCT m.medicine_id) AS near_expiry_count,
    COALESCE(SUM(m.quantity), 0) AS near_expiry_units
  FROM Medicines m
  WHERE m.donor_id = ?
    AND DATEDIFF(m.expiry_date, CURRENT_DATE()) BETWEEN 0 AND 7
    AND m.quantity > 0;
  `;

  // Call Stored Procedure for Summary
  db.query('CALL get_donor_dashboard(?)', [donor_id], (err, spResult) => {
    if (err) return res.status(500).send(err.message);

    // The SP result is in spResult[0][0] since it returns a result set
    const spSummary = spResult && spResult[0] ? spResult[0][0] : {};

    // Get Recent Transfers
    db.query(recentTransfersSql, [donor_id], (err, transfersResult) => {
      if (err) return res.status(500).send(err.message);

      // Get Inventory
      db.query(inventorySql, [donor_id], (err, inventoryResult) => {
        if (err) return res.status(500).send(err.message);

        // Get Near-Expiry Count
        db.query(nearExpiryCountSql, [donor_id], (err, nearExpiryCountResult) => {
          if (err) return res.status(500).send(err.message);

          // Optional: keep classifyExpiry purely for frontend badge styling if needed
          const { classifyExpiry } = require('../utils/expiryLogic');
          
          const inventoryWithExpiry = inventoryResult.map(item => {
            return {
              ...item,
              expiry_status: classifyExpiry(item.expiry_date)
            };
          });

          // Get near-expiry details
          const nearExpiryCount = nearExpiryCountResult && nearExpiryCountResult.length > 0 
            ? nearExpiryCountResult[0].near_expiry_count 
            : 0;

          // Use Stored Procedure output with updated near-expiry count
          const enhancedSummary = {
            total_medicines_listed: spSummary.total_meds || 0,
            current_available_units: 0,
            available_count: spSummary.total_avail || 0,
            near_expiry_count: nearExpiryCount,
            expired_count: spSummary.total_exp || 0
          };

          // Fetch units separately for complete data
          db.query("SELECT COALESCE(SUM(quantity_transferred),0) as total_units_transferred, COALESCE(SUM(CASE WHEN status='Available' THEN quantity ELSE 0 END),0) as current_available_units FROM Transfers t RIGHT JOIN Medicines m ON t.medicine_id = m.medicine_id WHERE m.donor_id = ?", [donor_id], (err, unitsRes) => {
              if(!err && unitsRes.length > 0) {
                  enhancedSummary.total_units_transferred = unitsRes[0].total_units_transferred;
                  enhancedSummary.current_available_units = unitsRes[0].current_available_units;
              }

              res.json({
                summary: enhancedSummary,
                recent_transfers: transfersResult,
                inventory: inventoryWithExpiry
              });
          });
        });
      });
    });
  });
};