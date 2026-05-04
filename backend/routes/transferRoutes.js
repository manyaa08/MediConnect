const express = require("express");
const router = express.Router();
const db = require("../db");
const verifyToken = require("../middleware/authMiddleware");
const allowRoles = require("../middleware/roleMiddleware");

// Fulfill a request (Partial/Complete)
router.post("/create", verifyToken, allowRoles("Donor"), (req, res) => {
    console.log("🚀 TRANSFER API HIT");
    const donor_id = req.user.user_id;
    const { request_id, quantity } = req.body;

    if (!quantity || quantity <= 0) {
        return res.status(400).json({ message: "Invalid quantity" });
    }

    db.query("SELECT * FROM Requests WHERE request_id = ?", [request_id], (err, requestResult) => {
        if (err) return res.status(500).json({ message: "Database Error", error: err.message });
        if (requestResult.length === 0) return res.status(404).json({ message: "Request not found" });

        const request = requestResult[0];
        if (quantity > request.remaining_quantity) {
            return res.status(400).json({ message: "Cannot fulfill more than required" });
        }

        // FEFO: Fetch medicines available for this donor matching the request name
        const medSql = `
            SELECT * FROM Medicines 
            WHERE donor_id = ? AND medicine_name = ? AND status = 'Available' AND quantity > 0
            ORDER BY expiry_date ASC
        `;

        db.query(medSql, [donor_id, request.medicine_name], (err, medicines) => {
            if (err) return res.status(500).json({ message: "Database Error", error: err.message });
            if (medicines.length === 0) return res.status(400).json({ message: "No stock available for this medicine" });

            let totalAvailable = 0;
            for (const batch of medicines) {
                totalAvailable += batch.quantity;
            }
            
            if (quantity > totalAvailable) {
                return res.status(400).json({ message: "Cannot donate more than available stock" });
            }

            let remainingToFulfill = quantity;
            let index = 0;

            function processNextBatch() {
                if (remainingToFulfill <= 0) {
                    return res.json({ message: "Donation successful! Thank you for your support." });
                }

                if (index >= medicines.length) {
                    return res.status(400).json({ message: "Insufficient stock across all batches" });
                }

                const batch = medicines[index++];
                const deduct = Math.min(batch.quantity, remainingToFulfill);

                db.query(
                    "CALL fulfill_request(?, ?, ?)",
                    [request_id, batch.medicine_id, deduct],
                    (err) => {
                        if (err) {
                            console.error("Fulfill Request SP Error:", err);
                            return res.status(500).json({ message: "Database error during fulfillment", error: err.message });
                        }
                        remainingToFulfill -= deduct;
                        processNextBatch();
                    }
                );
            }

            processNextBatch();
        });
    });
});

module.exports = router;
