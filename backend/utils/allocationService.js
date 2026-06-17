const db = require("../db");

/**
 * Preview FEFO allocation for a donor and medicine
 * Does not write any changes to the database
 */
const previewAllocation = async (donorId, medicineName, quantityRequired) => {
    const sql = `
        SELECT medicine_id, medicine_name, batch_number, expiry_date, quantity, status
        FROM Medicines
        WHERE donor_id = $1 
          AND medicine_name = $2 
          AND status IN ('Available', 'Near Expiry') 
          AND quantity > 0
        ORDER BY expiry_date ASC
    `;

    const result = await db.query(sql, [donorId, medicineName]);
    const batches = result.rows;

    let remaining = quantityRequired;
    const allocations = [];

    for (const batch of batches) {
        if (remaining <= 0) break;
        const allocated = Math.min(batch.quantity, remaining);
        
        // Calculate days left for UX display
        const daysLeft = Math.ceil((new Date(batch.expiry_date) - new Date()) / (1000 * 60 * 60 * 24));

        allocations.push({
            medicine_id: batch.medicine_id,
            batch_number: batch.batch_number,
            expiry_date: batch.expiry_date,
            days_left: daysLeft,
            quantity_allocated: allocated,
            original_quantity: batch.quantity
        });
        remaining -= allocated;
    }

    return {
        allocations,
        remainingUnallocated: remaining,
        canFullyFulfill: remaining === 0
    };
};

/**
 * Allocate inventory from batches using FEFO logic
 * Must be executed within a transaction client holding FOR UPDATE locks
 */
const allocateInventory = async (client, donorId, requestId, quantityRequired) => {
    // 1. Fetch the Request details
    const reqRes = await client.query(
        "SELECT medicine_name, ngo_id, remaining_quantity FROM Requests WHERE request_id = $1",
        [requestId]
    );

    if (reqRes.rows.length === 0) {
        throw new Error("Request not found");
    }

    const request = reqRes.rows[0];
    if (quantityRequired > request.remaining_quantity) {
        throw new Error("Cannot allocate more than requested quantity");
    }

    // 2. Fetch and lock matching medicine batches (Prevent Concurrency Race Conditions)
    const sql = `
        SELECT medicine_id, medicine_name, batch_number, expiry_date, quantity, status
        FROM Medicines
        WHERE donor_id = $1 
          AND medicine_name = $2 
          AND status IN ('Available', 'Near Expiry') 
          AND quantity > 0
        ORDER BY expiry_date ASC
        FOR UPDATE
    `;

    const result = await client.query(sql, [donorId, request.medicine_name]);
    const batches = result.rows;

    const totalAvailable = batches.reduce((sum, b) => sum + b.quantity, 0);
    if (quantityRequired > totalAvailable) {
        throw new Error("Not enough stock available across batches to fulfill allocation");
    }

    let remaining = quantityRequired;
    const allocatedRecords = [];

    // 3. Sequentially allocate quantity (FEFO)
    for (const batch of batches) {
        if (remaining <= 0) break;

        const deduct = Math.min(batch.quantity, remaining);

        // 4. Create Transfer entry (Invoking DB triggers)
        const transferRes = await client.query(
            `INSERT INTO Transfers (medicine_id, ngo_id, request_id, quantity_transferred, expiry_date, status)
             VALUES ($1, $2, $3, $4, $5, 'Donation Submitted')
             RETURNING transfer_id`,
            [batch.medicine_id, request.ngo_id, requestId, deduct, batch.expiry_date]
        );
        
        const transferId = transferRes.rows[0].transfer_id;

        // 5. Log allocation details to Allocation_Logs
        await client.query(
            `INSERT INTO Allocation_Logs (transfer_id, medicine_id, quantity_allocated)
             VALUES ($1, $2, $3)`,
            [transferId, batch.medicine_id, deduct]
        );

        allocatedRecords.push({
            batch_id: batch.medicine_id,
            batch_number: batch.batch_number,
            quantity_allocated: deduct,
            transfer_id: transferId
        });

        remaining -= deduct;
    }

    if (remaining > 0) {
        throw new Error("Failed to fully allocate inventory batches");
    }

    return allocatedRecords;
};

module.exports = {
    previewAllocation,
    allocateInventory
};
