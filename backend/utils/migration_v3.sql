-- 1. Modify Medicines status constraint to support 'Near Expiry'
ALTER TABLE Medicines DROP CONSTRAINT IF EXISTS medicines_status_check;
ALTER TABLE Medicines ADD CONSTRAINT medicines_status_check CHECK (status IN ('Available', 'Unavailable', 'Claimed', 'Expired', 'Near Expiry'));

-- 2. Update classify_expiry stored function to align with the 30-day window
CREATE OR REPLACE FUNCTION classify_expiry(exp_date DATE) 
RETURNS VARCHAR(20) 
AS $$
DECLARE
    days_left INT;
BEGIN
    days_left := exp_date - CURRENT_DATE;
    IF days_left < 0 THEN 
        RETURN 'Expired';
    ELSIF days_left <= 30 THEN 
        RETURN 'Near Expiry';
    ELSE 
        RETURN 'Available';
    END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- 3. Update trigger functions to use classify_expiry
CREATE OR REPLACE FUNCTION before_medicine_insert_fn() 
RETURNS TRIGGER AS $$
BEGIN
    NEW.status := classify_expiry(NEW.expiry_date);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION before_medicine_update_fn() 
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.expiry_date IS DISTINCT FROM OLD.expiry_date THEN
        NEW.status := classify_expiry(NEW.expiry_date);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Create Allocation_Logs table for FEFO audits
CREATE TABLE IF NOT EXISTS Allocation_Logs (
    allocation_id SERIAL PRIMARY KEY,
    transfer_id INT NOT NULL,
    medicine_id INT NOT NULL,
    quantity_allocated INT NOT NULL,
    allocated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_allocation_transfer FOREIGN KEY (transfer_id) REFERENCES Transfers(transfer_id) ON DELETE CASCADE,
    CONSTRAINT fk_allocation_medicine FOREIGN KEY (medicine_id) REFERENCES Medicines(medicine_id) ON DELETE CASCADE
);

-- 5. Add performance indexes for FEFO query scaling
CREATE INDEX IF NOT EXISTS idx_medicines_expiry ON Medicines(expiry_date);
CREATE INDEX IF NOT EXISTS idx_medicines_status ON Medicines(status);
CREATE INDEX IF NOT EXISTS idx_transfers_date ON Transfers(transfer_date);

-- Run scanner scanner procedure immediately to correct any existing records
CREATE OR REPLACE PROCEDURE Expiry_Scanner()
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE Medicines 
    SET status = classify_expiry(expiry_date);
END;
$$;

CALL Expiry_Scanner();
