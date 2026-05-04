
-- 1. DATABASE & TABLE CREATION

CREATE DATABASE IF NOT EXISTS mediconnect;
USE mediconnect;

CREATE TABLE Users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('Donor', 'NGO') NOT NULL,
    city VARCHAR(100)
);

CREATE TABLE Medicines_Info (
    medicine_name VARCHAR(255) PRIMARY KEY,
    category VARCHAR(100) NOT NULL
);

CREATE TABLE Medicines (
    medicine_id INT AUTO_INCREMENT PRIMARY KEY,
    medicine_name VARCHAR(255) NOT NULL,
    batch_number VARCHAR(100),
    expiry_date DATE NOT NULL,
    quantity INT NOT NULL,
    donor_id INT NOT NULL,
    status ENUM('Available', 'Unavailable', 'Claimed', 'Expired') DEFAULT 'Available',
    CONSTRAINT fk_medicine_info FOREIGN KEY (medicine_name) REFERENCES Medicines_Info(medicine_name) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_medicine_donor FOREIGN KEY (donor_id) REFERENCES Users(user_id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE Requests (
    request_id INT AUTO_INCREMENT PRIMARY KEY,
    ngo_id INT NOT NULL,
    medicine_name VARCHAR(255) NOT NULL,
    required_quantity INT NOT NULL,
    remaining_quantity INT NOT NULL,
    urgency VARCHAR(50) DEFAULT 'Normal',
    status ENUM('Pending', 'Partially Fulfilled', 'Completed', 'Fulfilled') DEFAULT 'Pending',
    CONSTRAINT fk_request_ngo FOREIGN KEY (ngo_id) REFERENCES Users(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_request_med_info FOREIGN KEY (medicine_name) REFERENCES Medicines_Info(medicine_name) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE Transfers (
    transfer_id INT AUTO_INCREMENT PRIMARY KEY,
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
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    action VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. FUNCTIONS, TRIGGERS, AND PROCEDURES

DELIMITER $$

-- A. STORED FUNCTIONS
-- classify_expiry: Reusable logic to determine medicine status
DROP FUNCTION IF EXISTS classify_expiry$$
CREATE FUNCTION classify_expiry(exp_date DATE) RETURNS VARCHAR(20) DETERMINISTIC
BEGIN
    DECLARE days_left INT;
    SET days_left = DATEDIFF(exp_date, CURRENT_DATE());
    IF days_left < 0 THEN RETURN 'Expired';
    ELSEIF days_left < 7 THEN RETURN 'Near Expiry';
    ELSE RETURN 'Available';
    END IF;
END$$

-- B. TRIGGERS
-- Auto-Set default status on insert
DROP TRIGGER IF EXISTS Before_Medicine_Insert$$
CREATE TRIGGER Before_Medicine_Insert
BEFORE INSERT ON Medicines
FOR EACH ROW
BEGIN
    IF NEW.expiry_date < CURRENT_DATE() THEN
        SET NEW.status = 'Expired';
    END IF;
END$$

-- Recalculate status if expiry_date is changed
DROP TRIGGER IF EXISTS Before_Medicine_Update$$
CREATE TRIGGER Before_Medicine_Update
BEFORE UPDATE ON Medicines
FOR EACH ROW
BEGIN
    IF NEW.expiry_date != OLD.expiry_date THEN
        IF NEW.expiry_date < CURRENT_DATE() THEN
            SET NEW.status = 'Expired';
        ELSE
            SET NEW.status = 'Available';
        END IF;
    END IF;
END$$

-- Validation before executing a transfer
DROP TRIGGER IF EXISTS Before_Transfer_Insert$$
CREATE TRIGGER Before_Transfer_Insert
BEFORE INSERT ON Transfers
FOR EACH ROW
BEGIN
    DECLARE med_qty INT;
    DECLARE req_qty INT;
    
    SELECT quantity INTO med_qty FROM Medicines WHERE medicine_id = NEW.medicine_id;
    IF med_qty IS NULL THEN SET med_qty = 0; END IF;

    IF NEW.quantity_transferred > med_qty THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Transfer quantity exceeds available stock.';
    END IF;
    
    IF NEW.request_id IS NOT NULL THEN
        SELECT remaining_quantity INTO req_qty FROM Requests WHERE request_id = NEW.request_id;
        IF req_qty IS NULL THEN SET req_qty = 0; END IF;
        
        IF NEW.quantity_transferred > req_qty THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Transfer quantity exceeds requested quantity.';
        END IF;
    END IF;
END$$

-- Automate tracking and cascading updates after transfer
DROP TRIGGER IF EXISTS After_Transfer_Insert$$
CREATE TRIGGER After_Transfer_Insert
AFTER INSERT ON Transfers
FOR EACH ROW
BEGIN
    UPDATE Medicines 
    SET status = IF(quantity - NEW.quantity_transferred <= 0, 'Unavailable', 'Available'),
        quantity = quantity - NEW.quantity_transferred
    WHERE medicine_id = NEW.medicine_id;

    IF NEW.request_id IS NOT NULL THEN
        UPDATE Requests 
        SET status = IF(remaining_quantity - NEW.quantity_transferred <= 0, 'Completed', 'Partially Fulfilled'),
            remaining_quantity = remaining_quantity - NEW.quantity_transferred
        WHERE request_id = NEW.request_id;
    END IF;

    INSERT INTO QueryLogs (action, description)
    VALUES ('TRANSFER_PROCESSED', CONCAT('Transferred ', NEW.quantity_transferred, ' units of Medicine ID ', NEW.medicine_id, ' to NGO ID ', NEW.ngo_id));
END$$

-- C. SET-BASED PROCEDURES (Optimized - no cursors)
-- Expiry_Scanner: Batch process to update all medicine statuses (SET-BASED)
DROP PROCEDURE IF EXISTS Expiry_Scanner$$
CREATE PROCEDURE Expiry_Scanner()
BEGIN
    UPDATE Medicines 
    SET status = classify_expiry(expiry_date);
END$$

-- get_donor_dashboard: Compute advanced aggregates (SET-BASED)
DROP PROCEDURE IF EXISTS get_donor_dashboard$$
CREATE PROCEDURE get_donor_dashboard(IN p_donor_id INT)
BEGIN
    SELECT 
        COUNT(*) AS total_meds,
        SUM(CASE WHEN classify_expiry(expiry_date) = 'Available' THEN 1 ELSE 0 END) AS total_avail,
        SUM(CASE WHEN classify_expiry(expiry_date) = 'Expired' THEN 1 ELSE 0 END) AS total_exp,
        SUM(CASE WHEN classify_expiry(expiry_date) = 'Near Expiry' THEN 1 ELSE 0 END) AS total_near
    FROM Medicines 
    WHERE donor_id = p_donor_id AND quantity > 0;
END$$

-- D. OPTIMIZED PROCEDURES
-- fulfill_request: Simplified with automatic trigger-based updates
DROP PROCEDURE IF EXISTS fulfill_request$$
CREATE PROCEDURE fulfill_request(IN p_request_id INT, IN p_medicine_id INT, IN p_qty INT)
BEGIN
    INSERT INTO Transfers (medicine_id, ngo_id, request_id, quantity_transferred, transfer_date, expiry_date)
    SELECT p_medicine_id, r.ngo_id, p_request_id, p_qty, NOW(), m.expiry_date
    FROM Requests r
    JOIN Medicines m ON m.medicine_id = p_medicine_id
    WHERE r.request_id = p_request_id;
END$$

DELIMITER ;

-- ==============================================================================
-- 3. CATEGORIZED QUERIES FOR REPORT
-- ==============================================================================

-- A. BASIC QUERIES
SELECT * FROM Medicines;
SELECT * FROM Requests;
SELECT * FROM Requests WHERE ngo_id = ? AND remaining_quantity > 0;
SELECT * FROM Requests WHERE request_id = ?;

-- B. JOINS
-- Medicines + Info
SELECT m.*, mi.category 
FROM Medicines m 
JOIN Medicines_Info mi ON m.medicine_name = mi.medicine_name 
WHERE m.quantity > 0;

-- Transfers + Medicines + NGO
SELECT 
    t.transfer_id,
    t.quantity_transferred,
    t.transfer_date,
    t.expiry_date,
    m.medicine_name,
    u.name AS donor_name
FROM Transfers t
LEFT JOIN Medicines m ON t.medicine_id = m.medicine_id
LEFT JOIN Users u ON m.donor_id = u.user_id
WHERE t.ngo_id = ?
ORDER BY t.transfer_date DESC;

-- C. AGGREGATIONS
-- Count medicines per donor
SELECT donor_id, COUNT(medicine_id) AS total_medicines 
FROM Medicines 
GROUP BY donor_id;

-- Total quantity transferred
SELECT COALESCE(SUM(quantity_transferred),0) AS total_units_transferred 
FROM Transfers t 
JOIN Medicines m ON t.medicine_id = m.medicine_id 
WHERE m.donor_id = ?;

-- Expiry distribution
SELECT status, COUNT(*) AS count 
FROM Medicines 
GROUP BY status;

-- D. SUBQUERIES
-- Medicines not yet requested
SELECT * FROM Medicines 
WHERE medicine_name NOT IN (SELECT medicine_name FROM Requests);

-- Donors with highest contributions
SELECT name FROM Users 
WHERE user_id IN (
    SELECT donor_id FROM Medicines 
    GROUP BY donor_id 
    HAVING SUM(quantity) > 500
);

-- E. ADVANCED QUERIES
-- Match requests with available medicines
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
GROUP BY m.medicine_name, r.request_id, r.required_quantity, r.remaining_quantity, r.urgency, u.name, u.city;

-- F. NEAR-EXPIRY QUERIES
-- Get all near-expiry medicines for a donor (to display in dashboard)
SELECT 
    m.medicine_id,
    m.medicine_name,
    m.batch_number,
    m.expiry_date,
    m.quantity,
    mi.category,
    DATEDIFF(m.expiry_date, CURRENT_DATE()) AS days_left,
    'Near Expiry' AS expiry_status
FROM Medicines m
JOIN Medicines_Info mi ON m.medicine_name = mi.medicine_name
WHERE m.donor_id = ?
  AND DATEDIFF(m.expiry_date, CURRENT_DATE()) BETWEEN 0 AND 7
  AND m.quantity > 0
ORDER BY m.expiry_date ASC;

-- Count near-expiry medicines for a donor
SELECT 
    COUNT(DISTINCT m.medicine_id) AS near_expiry_count,
    COALESCE(SUM(m.quantity), 0) AS near_expiry_units
FROM Medicines m
WHERE m.donor_id = ?
  AND DATEDIFF(m.expiry_date, CURRENT_DATE()) BETWEEN 0 AND 7
  AND m.quantity > 0;

-- Prioritize near-expiry medicines in matching (prioritize urgent + near-expiry)
SELECT 
    m.medicine_id,
    m.medicine_name,
    SUM(m.quantity) AS total_available,
    r.request_id,
    r.required_quantity,
    r.remaining_quantity,
    DATEDIFF(m.expiry_date, CURRENT_DATE()) AS days_left,
    CASE WHEN DATEDIFF(m.expiry_date, CURRENT_DATE()) <= 7 THEN 1 ELSE 0 END AS is_near_expiry,
    r.urgency,
    u.name AS ngo_name,
    u.city
FROM Medicines m
JOIN Requests r ON m.medicine_name = r.medicine_name
JOIN Users u ON r.ngo_id = u.user_id
WHERE m.status = 'Available'
  AND m.quantity > 0
  AND r.remaining_quantity > 0
  AND u.city = (SELECT city FROM Users WHERE user_id = ?)
ORDER BY is_near_expiry DESC, m.expiry_date ASC, r.urgency DESC;

-- Get received medicines nearing expiry for NGO dashboard
SELECT 
    t.transfer_id,
    t.quantity_transferred,
    t.transfer_date,
    t.expiry_date,
    m.medicine_name,
    u.name AS donor_name,
    DATEDIFF(t.expiry_date, CURRENT_DATE()) AS days_left,
    'Near Expiry' AS status
FROM Transfers t
LEFT JOIN Medicines m ON t.medicine_id = m.medicine_id
LEFT JOIN Users u ON m.donor_id = u.user_id
WHERE t.ngo_id = ?
  AND DATEDIFF(t.expiry_date, CURRENT_DATE()) BETWEEN 0 AND 7
ORDER BY t.expiry_date ASC;

-- Count received near-expiry medicines for NGO
SELECT 
    COUNT(DISTINCT t.transfer_id) AS ngo_near_expiry_count,
    COALESCE(SUM(t.quantity_transferred), 0) AS ngo_near_expiry_units
FROM Transfers t
WHERE t.ngo_id = ?
  AND DATEDIFF(t.expiry_date, CURRENT_DATE()) BETWEEN 0 AND 7;
