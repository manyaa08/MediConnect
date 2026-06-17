-- ==============================================================================
-- MEDICONNECT - DATABASE INITIALIZATION & SCHEMA DEFINITION (PostgreSQL Version)
-- ==============================================================================

-- 1. DATABASE & TABLE CREATION
-- Note: In PostgreSQL, database creation is typically handled separately.
-- The following commands assume we are connected to the target database.

DROP TABLE IF EXISTS Transfers CASCADE;
DROP TABLE IF EXISTS Requests CASCADE;
DROP TABLE IF EXISTS Medicines CASCADE;
DROP TABLE IF EXISTS Medicines_Info CASCADE;
DROP TABLE IF EXISTS Users CASCADE;
DROP TABLE IF EXISTS QueryLogs CASCADE;

CREATE TABLE Users (
    user_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('Donor', 'NGO')),
    city VARCHAR(100),
    is_verified BOOLEAN DEFAULT TRUE
);

CREATE TABLE Medicines_Info (
    medicine_name VARCHAR(255) PRIMARY KEY,
    category VARCHAR(100) NOT NULL
);

CREATE TABLE Medicines (
    medicine_id SERIAL PRIMARY KEY,
    medicine_name VARCHAR(255) NOT NULL,
    batch_number VARCHAR(100),
    expiry_date DATE NOT NULL,
    quantity INT NOT NULL,
    donor_id INT NOT NULL,
    status VARCHAR(50) DEFAULT 'Available' CHECK (status IN ('Available', 'Unavailable', 'Claimed', 'Expired')),
    CONSTRAINT fk_medicine_info FOREIGN KEY (medicine_name) REFERENCES Medicines_Info(medicine_name) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_medicine_donor FOREIGN KEY (donor_id) REFERENCES Users(user_id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE Requests (
    request_id SERIAL PRIMARY KEY,
    ngo_id INT NOT NULL,
    medicine_name VARCHAR(255) NOT NULL,
    required_quantity INT NOT NULL,
    remaining_quantity INT NOT NULL,
    urgency VARCHAR(50) DEFAULT 'Normal',
    status VARCHAR(50) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Partially Fulfilled', 'Completed', 'Fulfilled')),
    CONSTRAINT fk_request_ngo FOREIGN KEY (ngo_id) REFERENCES Users(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_request_med_info FOREIGN KEY (medicine_name) REFERENCES Medicines_Info(medicine_name) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE Transfers (
    transfer_id SERIAL PRIMARY KEY,
    medicine_id INT NOT NULL,
    ngo_id INT NOT NULL,
    request_id INT NULL,
    quantity_transferred INT NOT NULL,
    transfer_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expiry_date DATE NOT NULL,
    CONSTRAINT fk_transfer_medicine FOREIGN KEY (medicine_id) REFERENCES Medicines(medicine_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_transfer_ngo FOREIGN KEY (ngo_id) REFERENCES Users(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_transfer_request FOREIGN KEY (request_id) REFERENCES Requests(request_id) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE QueryLogs (
    log_id SERIAL PRIMARY KEY,
    action VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 2. FUNCTIONS, TRIGGERS, AND PROCEDURES (PL/pgSQL)
-- ==============================================================================

-- A. STORED FUNCTIONS
-- classify_expiry: Determine medicine status based on days to expiry
CREATE OR REPLACE FUNCTION classify_expiry(exp_date DATE) 
RETURNS VARCHAR(20) 
AS $$
DECLARE
    days_left INT;
    result_status VARCHAR(20);
BEGIN
    days_left := exp_date - CURRENT_DATE;
    IF days_left < 0 THEN 
        result_status := 'Expired';
    ELSIF days_left < 7 THEN 
        result_status := 'Near Expiry';
    ELSE 
        result_status := 'Available';
    END IF;
    RETURN result_status;
END;
$$ LANGUAGE plpgsql STABLE;

-- B. TRIGGERS

-- 1. Before_Medicine_Insert: Auto-set default status on insert if already expired
CREATE OR REPLACE FUNCTION before_medicine_insert_fn() 
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.expiry_date < CURRENT_DATE THEN
        NEW.status := 'Expired';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER Before_Medicine_Insert
BEFORE INSERT ON Medicines
FOR EACH ROW
EXECUTE FUNCTION before_medicine_insert_fn();

-- 2. Before_Medicine_Update: Recalculate status if expiry_date changes
CREATE OR REPLACE FUNCTION before_medicine_update_fn() 
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.expiry_date IS DISTINCT FROM OLD.expiry_date THEN
        IF NEW.expiry_date < CURRENT_DATE THEN
            NEW.status := 'Expired';
        ELSE
            NEW.status := 'Available';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER Before_Medicine_Update
BEFORE UPDATE ON Medicines
FOR EACH ROW
EXECUTE FUNCTION before_medicine_update_fn();

-- 3. Before_Transfer_Insert: Validation before executing transfer
CREATE OR REPLACE FUNCTION before_transfer_insert_fn() 
RETURNS TRIGGER AS $$
DECLARE
    med_qty INT;
    req_qty INT;
BEGIN
    SELECT quantity INTO med_qty FROM Medicines WHERE medicine_id = NEW.medicine_id;
    IF med_qty IS NULL THEN 
        med_qty := 0; 
    END IF;

    IF NEW.quantity_transferred > med_qty THEN
        RAISE EXCEPTION 'Transfer quantity exceeds available stock.';
    END IF;
    
    IF NEW.request_id IS NOT NULL THEN
        SELECT remaining_quantity INTO req_qty FROM Requests WHERE request_id = NEW.request_id;
        IF req_qty IS NULL THEN 
            req_qty := 0; 
        END IF;
        
        IF NEW.quantity_transferred > req_qty THEN
            RAISE EXCEPTION 'Transfer quantity exceeds requested quantity.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER Before_Transfer_Insert
BEFORE INSERT ON Transfers
FOR EACH ROW
EXECUTE FUNCTION before_transfer_insert_fn();

-- 4. After_Transfer_Insert: Automate tracking & cascading updates after transfer
CREATE OR REPLACE FUNCTION after_transfer_insert_fn() 
RETURNS TRIGGER AS $$
BEGIN
    -- Update medicine quantity and status
    UPDATE Medicines 
    SET status = CASE WHEN quantity - NEW.quantity_transferred <= 0 THEN 'Unavailable' ELSE 'Available' END,
        quantity = quantity - NEW.quantity_transferred
    WHERE medicine_id = NEW.medicine_id;

    -- Update request if linked
    IF NEW.request_id IS NOT NULL THEN
        UPDATE Requests 
        SET status = CASE WHEN remaining_quantity - NEW.quantity_transferred <= 0 THEN 'Completed' ELSE 'Partially Fulfilled' END,
            remaining_quantity = remaining_quantity - NEW.quantity_transferred
        WHERE request_id = NEW.request_id;
    END IF;

    -- Log transaction
    INSERT INTO QueryLogs (action, description)
    VALUES ('TRANSFER_PROCESSED', 'Transferred ' || NEW.quantity_transferred || ' units of Medicine ID ' || NEW.medicine_id || ' to NGO ID ' || NEW.ngo_id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER After_Transfer_Insert
AFTER INSERT ON Transfers
FOR EACH ROW
EXECUTE FUNCTION after_transfer_insert_fn();


-- C. STORED PROCEDURES (PL/pgSQL)

-- Expiry_Scanner: Batch process to update all medicine statuses (set-based)
CREATE OR REPLACE PROCEDURE Expiry_Scanner()
AS $$
BEGIN
    UPDATE Medicines 
    SET status = classify_expiry(expiry_date);
END;
$$ LANGUAGE plpgsql;

-- get_donor_dashboard: Compute advanced aggregates (Rewritten as Table function for Node PG connection compatibility)
CREATE OR REPLACE FUNCTION get_donor_dashboard(p_donor_id INT)
RETURNS TABLE (
    total_meds INT,
    total_avail INT,
    total_exp INT,
    total_near INT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(COUNT(*), 0)::INT AS total_meds,
        COALESCE(SUM(CASE WHEN classify_expiry(expiry_date) = 'Available' THEN 1 ELSE 0 END), 0)::INT AS total_avail,
        COALESCE(SUM(CASE WHEN classify_expiry(expiry_date) = 'Expired' THEN 1 ELSE 0 END), 0)::INT AS total_exp,
        COALESCE(SUM(CASE WHEN classify_expiry(expiry_date) = 'Near Expiry' THEN 1 ELSE 0 END), 0)::INT AS total_near
    FROM Medicines 
    WHERE donor_id = p_donor_id AND quantity > 0;
END;
$$ LANGUAGE plpgsql STABLE;

-- fulfill_request: Inserts transfer entry (Triggers execute logic)
CREATE OR REPLACE PROCEDURE fulfill_request(p_request_id INT, p_medicine_id INT, p_qty INT)
AS $$
BEGIN
    INSERT INTO Transfers (medicine_id, ngo_id, request_id, quantity_transferred, transfer_date, expiry_date)
    SELECT p_medicine_id, r.ngo_id, p_request_id, p_qty, CURRENT_TIMESTAMP, m.expiry_date
    FROM Requests r
    JOIN Medicines m ON m.medicine_id = p_medicine_id
    WHERE r.request_id = p_request_id;
END;
$$ LANGUAGE plpgsql;


-- ==============================================================================
-- 3. CATEGORIZED QUERIES FOR REPORT (PostgreSQL Version)
-- ==============================================================================

-- A. BASIC QUERIES
-- SELECT * FROM Medicines;
-- SELECT * FROM Requests;
-- SELECT * FROM Requests WHERE ngo_id = $1 AND remaining_quantity > 0;
-- SELECT * FROM Requests WHERE request_id = $1;

-- B. JOINS
-- Medicines + Info
-- SELECT m.*, mi.category FROM Medicines m JOIN Medicines_Info mi ON m.medicine_name = mi.medicine_name WHERE m.quantity > 0;

-- Transfers + Medicines + NGO
-- SELECT t.transfer_id, t.quantity_transferred, t.transfer_date, t.expiry_date, m.medicine_name, u.name AS donor_name
-- FROM Transfers t LEFT JOIN Medicines m ON t.medicine_id = m.medicine_id LEFT JOIN Users u ON m.donor_id = u.user_id
-- WHERE t.ngo_id = $1 ORDER BY t.transfer_date DESC;

-- C. AGGREGATIONS
-- Count medicines per donor: SELECT donor_id, COUNT(medicine_id) AS total_medicines FROM Medicines GROUP BY donor_id;
-- Total quantity transferred: SELECT COALESCE(SUM(quantity_transferred),0) AS total_units_transferred FROM Transfers t JOIN Medicines m ON t.medicine_id = m.medicine_id WHERE m.donor_id = $1;
-- Expiry distribution: SELECT status, COUNT(*) AS count FROM Medicines GROUP BY status;

-- D. SUBQUERIES
-- Medicines not yet requested: SELECT * FROM Medicines WHERE medicine_name NOT IN (SELECT medicine_name FROM Requests);
-- Donors with highest contributions: SELECT name FROM Users WHERE user_id IN (SELECT donor_id FROM Medicines GROUP BY donor_id HAVING SUM(quantity) > 500);

-- E. ADVANCED QUERIES / MATCHING (PostgreSQL Compatibility)
-- Match requests with available medicines
-- SELECT m.medicine_name, SUM(m.quantity) AS total_available, r.request_id, r.required_quantity, r.remaining_quantity, r.urgency, u.name AS ngo_name, u.city
-- FROM Medicines m JOIN Requests r ON m.medicine_name = r.medicine_name JOIN Users u ON r.ngo_id = u.user_id JOIN Users d ON m.donor_id = d.user_id
-- WHERE m.donor_id = $1 AND m.status = 'Available' AND m.quantity > 0 AND d.city = u.city AND r.remaining_quantity > 0
-- GROUP BY m.medicine_name, r.request_id, r.required_quantity, r.remaining_quantity, r.urgency, u.name, u.city;

-- F. NEAR-EXPIRY QUERIES
-- Get all near-expiry medicines for a donor
-- SELECT m.medicine_id, m.medicine_name, m.batch_number, m.expiry_date, m.quantity, mi.category, (m.expiry_date - CURRENT_DATE) AS days_left, 'Near Expiry' AS expiry_status
-- FROM Medicines m JOIN Medicines_Info mi ON m.medicine_name = mi.medicine_name WHERE m.donor_id = $1 AND (m.expiry_date - CURRENT_DATE) BETWEEN 0 AND 7 AND m.quantity > 0 ORDER BY m.expiry_date ASC;

-- Count near-expiry medicines for a donor
-- SELECT COUNT(DISTINCT m.medicine_id) AS near_expiry_count, COALESCE(SUM(m.quantity), 0) AS near_expiry_units
-- FROM Medicines m WHERE m.donor_id = $1 AND (m.expiry_date - CURRENT_DATE) BETWEEN 0 AND 7 AND m.quantity > 0;
