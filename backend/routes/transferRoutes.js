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
            const transfers = [];

            // Process batches
            for (const batch of medicines) {
                if (remainingToFulfill <= 0) break;
                const deduct = Math.min(batch.quantity, remainingToFulfill);
                transfers.push({
                    medicine_id: batch.medicine_id,
                    deduct: deduct,
                    expiry_date: batch.expiry_date
                });
                remainingToFulfill -= deduct;
            }

            if (remainingToFulfill > 0) {
                return res.status(400).json({ message: "Insufficient stock to fulfill requested amount" });
            }

            // Start Transaction to update all records safely using a dedicated connection
            db.getConnection((err, connection) => {
                if (err) return res.status(500).json({ message: "DB Connection Error", error: err.message });

                connection.beginTransaction(err => {
                    if (err) {
                        connection.release();
                        return res.status(500).json({ message: "Transaction Error", error: err.message });
                    }

                    const processTransfers = (index) => {
                        if (index >= transfers.length) {
                            // After all batch updates, update the request status
                            const updateRequestSql = `
                                UPDATE Requests 
                                SET remaining_quantity = remaining_quantity - ?,
                                    status = IF(remaining_quantity - ? = 0, 'Completed', 'Partially Fulfilled')
                                WHERE request_id = ?
                            `;
                            connection.query(updateRequestSql, [quantity, quantity, request_id], (err) => {
                                if (err) return connection.rollback(() => { connection.release(); res.status(500).json({ message: "Failed to update request", error: err.message }) });
                                
                                connection.commit(err => {
                                    if (err) return connection.rollback(() => { connection.release(); res.status(500).json({ message: "Commit Error", error: err.message }) });
                                    connection.release();
                                    res.json({ message: "Donation successful! Thank you for your support." });
                                });
                            });
                            return;
                        }

                        const t = transfers[index];
                        const logTransferSql = "INSERT INTO Transfers (medicine_id, ngo_id, quantity_transferred, expiry_date) VALUES (?,?,?,?)";
                        connection.query(logTransferSql, [t.medicine_id, request.ngo_id, t.deduct, t.expiry_date], (err) => {
                            if (err) return connection.rollback(() => { connection.release(); res.status(500).json({ message: "Failed to log transfer", error: err.message }) });

                            const updateMedSql = "UPDATE Medicines SET quantity = quantity - ?, status = IF(quantity - ? <= 0, 'Unavailable', 'Available') WHERE medicine_id = ?";
                            connection.query(updateMedSql, [t.deduct, t.deduct, t.medicine_id], (err) => {
                                if (err) return connection.rollback(() => { connection.release(); res.status(500).json({ message: "Failed to update inventory", error: err.message }) });
                                processTransfers(index + 1);
                            });
                        });
                    };

                    processTransfers(0);
                });
            });
        });
    });
});

module.exports = router;
