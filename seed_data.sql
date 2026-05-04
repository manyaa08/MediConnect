
-- ==============================================================================
-- MEDICONNECT - DATABASE INITIALIZATION & SEED SCRIPT
-- ==============================================================================
CREATE DATABASE IF NOT EXISTS mediconnect;
USE mediconnect;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS Transfers;
DROP TABLE IF EXISTS Requests;
DROP TABLE IF EXISTS Medicines;
DROP TABLE IF EXISTS Medicines_Info;
DROP TABLE IF EXISTS Users;
DROP TABLE IF EXISTS QueryLogs;

SET FOREIGN_KEY_CHECKS = 1;

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

DELIMITER $$
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
DELIMITER ;

-- ==============================================================================
-- ADVANCED SQL CONCEPTS: FUNCTIONS, PROCEDURES, CURSORS, TRIGGERS
-- ==============================================================================

DELIMITER $$

-- 1. FUNCTIONS
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

-- 2. TRIGGERS
DROP TRIGGER IF EXISTS Before_Medicine_Insert$$
CREATE TRIGGER Before_Medicine_Insert
BEFORE INSERT ON Medicines
FOR EACH ROW
BEGIN
    IF NEW.expiry_date < CURRENT_DATE() THEN
        SET NEW.status = 'Expired';
    END IF;
    -- Note: IF not expired, we leave it as default or use whatever is provided
END$$

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

-- 3. STORED PROCEDURES (WITH CURSORS & COMPLEX LOGIC)

-- Expiry Scanner (Cursor)
DROP PROCEDURE IF EXISTS Expiry_Scanner$$
CREATE PROCEDURE Expiry_Scanner()
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE m_id INT;
    DECLARE m_exp DATE;
    DECLARE new_status VARCHAR(20);
    
    DECLARE med_cursor CURSOR FOR SELECT medicine_id, expiry_date FROM Medicines;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
    
    OPEN med_cursor;
    
    scan_loop: LOOP
        FETCH med_cursor INTO m_id, m_exp;
        IF done THEN
            LEAVE scan_loop;
        END IF;
        
        SET new_status = classify_expiry(m_exp);
        UPDATE Medicines SET status = new_status WHERE medicine_id = m_id;
    END LOOP;
    
    CLOSE med_cursor;
END$$

-- Dashboard Aggregation (Cursor)
DROP PROCEDURE IF EXISTS get_donor_dashboard$$
CREATE PROCEDURE get_donor_dashboard(IN p_donor_id INT)
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE m_status VARCHAR(20);
    DECLARE total_meds INT DEFAULT 0;
    DECLARE total_avail INT DEFAULT 0;
    DECLARE total_exp INT DEFAULT 0;
    DECLARE total_near INT DEFAULT 0;
    
    DECLARE stat_cursor CURSOR FOR 
        SELECT classify_expiry(expiry_date) 
        FROM Medicines 
        WHERE donor_id = p_donor_id AND quantity > 0;
        
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
    
    OPEN stat_cursor;
    
    stat_loop: LOOP
        FETCH stat_cursor INTO m_status;
        IF done THEN
            LEAVE stat_loop;
        END IF;
        
        SET total_meds = total_meds + 1;
        IF m_status = 'Available' THEN SET total_avail = total_avail + 1;
        ELSEIF m_status = 'Expired' THEN SET total_exp = total_exp + 1;
        ELSEIF m_status = 'Near Expiry' THEN SET total_near = total_near + 1;
        END IF;
    END LOOP;
    
    CLOSE stat_cursor;
    
    SELECT total_meds, total_avail, total_exp, total_near;
END$$

-- Fulfill Request (Transaction)
DROP PROCEDURE IF EXISTS fulfill_request$$
CREATE PROCEDURE fulfill_request(IN p_request_id INT, IN p_medicine_id INT, IN p_qty INT)
BEGIN
    DECLARE v_ngo_id INT;
    DECLARE v_exp_date DATE;
    
    -- Start Transaction
    START TRANSACTION;
    
    -- Get Request NGO and Medicine Expiry
    SELECT ngo_id INTO v_ngo_id FROM Requests WHERE request_id = p_request_id;
    SELECT expiry_date INTO v_exp_date FROM Medicines WHERE medicine_id = p_medicine_id;
    
    -- Insert Transfer (Triggers will handle decrementing Medicines and Requests)
    INSERT INTO Transfers (medicine_id, ngo_id, request_id, quantity_transferred, transfer_date, expiry_date)
    VALUES (p_medicine_id, v_ngo_id, p_request_id, p_qty, NOW(), v_exp_date);
    
    COMMIT;
END$$

DELIMITER ;

-- ==============================================================================
-- INSERT DUMMY DATA
-- ==============================================================================

INSERT INTO Users (name, email, password_hash, role, city) VALUES
('MedPlus 4', 'medplus4@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'Donor', 'Mumbai'),
('Pharmeasy Store 50', 'pharmeasystore50@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'Donor', 'Kolkata'),
('Netmeds Hub 61', 'netmedshub61@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'Donor', 'Delhi'),
('LifeCare Labs 94', 'lifecarelabs94@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'Donor', 'Kolkata'),
('HealthKart 49', 'healthkart49@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'Donor', 'Chennai'),
('Wellness Forever 4', 'wellnessforever4@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'Donor', 'Pune'),
('Guardian Pharmacy 42', 'guardianpharmacy42@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'Donor', 'Kolkata'),
('Religare Wellness 59', 'religarewellness59@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'Donor', 'Hyderabad'),
('Sanjeevani Med 83', 'sanjeevanimed83@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'Donor', 'Pune'),
('Apollo Pharmacy 9', 'apollopharmacy9@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'Donor', 'Chennai'),
('MedPlus 69', 'medplus69@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'Donor', 'Mumbai'),
('Pharmeasy Store 69', 'pharmeasystore69@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'Donor', 'Bangalore'),
('Netmeds Hub 91', 'netmedshub91@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'Donor', 'Chennai'),
('LifeCare Labs 30', 'lifecarelabs30@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'Donor', 'Bangalore'),
('HealthKart 83', 'healthkart83@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'Donor', 'Chennai'),
('Wellness Forever 12', 'wellnessforever12@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'Donor', 'Delhi'),
('Guardian Pharmacy 64', 'guardianpharmacy64@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'Donor', 'Delhi'),
('Religare Wellness 21', 'religarewellness21@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'Donor', 'Mumbai'),
('Sanjeevani Med 64', 'sanjeevanimed64@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'Donor', 'Chennai'),
('Apollo Pharmacy 43', 'apollopharmacy43@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'Donor', 'Kolkata'),
('Care India 8', 'careindia8@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'NGO', 'Mumbai'),
('Smile NGO 0', 'smilengo0@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'NGO', 'Pune'),
('Health Bridge 44', 'healthbridge44@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'NGO', 'Pune'),
('Sanjeevani 61', 'sanjeevani61@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'NGO', 'Hyderabad'),
('Helping Hands 44', 'helpinghands44@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'NGO', 'Chennai'),
('Life Savers 81', 'lifesavers81@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'NGO', 'Delhi'),
('Asha Society 89', 'ashasociety89@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'NGO', 'Delhi'),
('Umeed 4', 'umeed4@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'NGO', 'Pune'),
('Jeevan Daan 42', 'jeevandaan42@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'NGO', 'Kolkata'),
('Hope Foundation 71', 'hopefoundation71@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'NGO', 'Bangalore'),
('Care India 47', 'careindia47@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'NGO', 'Chennai'),
('Smile NGO 23', 'smilengo23@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'NGO', 'Delhi'),
('Health Bridge 78', 'healthbridge78@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'NGO', 'Mumbai'),
('Sanjeevani 41', 'sanjeevani41@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'NGO', 'Kolkata'),
('Helping Hands 76', 'helpinghands76@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'NGO', 'Pune'),
('Life Savers 60', 'lifesavers60@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'NGO', 'Kolkata'),
('Asha Society 31', 'ashasociety31@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'NGO', 'Pune'),
('Umeed 56', 'umeed56@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'NGO', 'Pune'),
('Jeevan Daan 28', 'jeevandaan28@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'NGO', 'Bangalore'),
('Hope Foundation 48', 'hopefoundation48@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'NGO', 'Mumbai');

INSERT INTO Medicines_Info (medicine_name, category) VALUES
('Paracetamol', 'Tablet'),
('Amoxicillin', 'Capsule'),
('Cough Syrup Rx', 'Syrup'),
('Vitamin C', 'Tablet'),
('Ibuprofen', 'Tablet'),
('Cetirizine', 'Tablet'),
('Azithromycin', 'Capsule'),
('Ciprofloxacin', 'Tablet'),
('Omeprazole', 'Capsule'),
('Pantoprazole', 'Tablet'),
('Multivitamin', 'Capsule'),
('Calcium Sandoz', 'Tablet'),
('Iron Tonic', 'Syrup'),
('Dolo 650', 'Tablet'),
('Crocin', 'Tablet'),
('Digene', 'Tablet'),
('Gelusil', 'Syrup'),
('Betadine', 'Ointment'),
('Soframycin', 'Ointment'),
('Ciplox', 'Drops');

INSERT INTO Medicines (medicine_name, batch_number, expiry_date, quantity, donor_id, status) VALUES
('Azithromycin', 'B5066', '2026-01-25', 417, 18, 'Expired'),
('Dolo 650', 'B8381', '2026-10-23', 441, 4, 'Available'),
('Ibuprofen', 'B6801', '2027-12-08', 93, 14, 'Available'),
('Dolo 650', 'B7274', '2026-03-16', 355, 15, 'Expired'),
('Gelusil', 'B4652', '2026-08-13', 313, 10, 'Available'),
('Omeprazole', 'B4593', '2027-08-29', 445, 5, 'Available'),
('Ciplox', 'B0389', '2027-05-01', 369, 3, 'Available'),
('Digene', 'B3614', '2026-09-26', 341, 19, 'Available'),
('Soframycin', 'B2326', '2026-08-03', 79, 2, 'Available'),
('Dolo 650', 'B4980', '2026-05-08', 419, 9, 'Available'),
('Calcium Sandoz', 'B5833', '2026-05-06', 191, 10, 'Available'),
('Ibuprofen', 'B0590', '2027-06-07', 231, 17, 'Available'),
('Betadine', 'B7398', '2026-05-21', 421, 9, 'Available'),
('Vitamin C', 'B5841', '2026-01-06', 352, 13, 'Expired'),
('Multivitamin', 'B4435', '2026-05-10', 391, 12, 'Available'),
('Vitamin C', 'B5412', '2027-10-30', 296, 7, 'Available'),
('Digene', 'B9648', '2026-08-04', 211, 19, 'Available'),
('Digene', 'B5042', '2027-10-27', 365, 12, 'Available'),
('Calcium Sandoz', 'B7330', '2026-10-08', 288, 20, 'Available'),
('Soframycin', 'B8461', '2027-12-28', 79, 15, 'Available'),
('Ciplox', 'B1833', '2027-12-27', 200, 17, 'Available'),
('Soframycin', 'B7359', '2025-11-10', 307, 8, 'Expired'),
('Ibuprofen', 'B3672', '2026-05-11', 258, 4, 'Available'),
('Cetirizine', 'B9754', '2027-05-31', 320, 4, 'Available'),
('Cough Syrup Rx', 'B6382', '2027-06-23', 68, 11, 'Available'),
('Pantoprazole', 'B0277', '2026-05-10', 175, 7, 'Available'),
('Soframycin', 'B8193', '2026-05-06', 428, 16, 'Available'),
('Soframycin', 'B0001', '2027-11-28', 71, 8, 'Available'),
('Vitamin C', 'B7044', '2027-08-30', 405, 19, 'Available'),
('Paracetamol', 'B9726', '2026-05-05', 231, 12, 'Available'),
('Omeprazole', 'B4510', '2026-07-11', 390, 18, 'Available'),
('Ibuprofen', 'B8012', '2026-11-28', 388, 2, 'Available'),
('Paracetamol', 'B0680', '2028-03-04', 192, 15, 'Available'),
('Soframycin', 'B2694', '2026-05-24', 389, 1, 'Available'),
('Amoxicillin', 'B7288', '2026-02-19', 267, 15, 'Expired'),
('Crocin', 'B6543', '2026-05-06', 78, 18, 'Available'),
('Iron Tonic', 'B3849', '2025-11-06', 419, 20, 'Expired'),
('Calcium Sandoz', 'B5272', '2027-04-03', 447, 7, 'Available'),
('Gelusil', 'B0071', '2026-05-29', 363, 20, 'Available'),
('Multivitamin', 'B2935', '2027-11-02', 340, 19, 'Available'),
('Dolo 650', 'B3311', '2025-11-11', 389, 14, 'Expired'),
('Cetirizine', 'B8454', '2026-05-10', 59, 5, 'Available'),
('Cough Syrup Rx', 'B5754', '2026-10-12', 349, 19, 'Available'),
('Dolo 650', 'B2252', '2026-04-15', 244, 10, 'Expired'),
('Cough Syrup Rx', 'B2008', '2026-09-02', 133, 10, 'Available'),
('Ciprofloxacin', 'B3636', '2025-11-28', 408, 10, 'Expired'),
('Crocin', 'B6000', '2028-02-11', 384, 14, 'Available'),
('Ciplox', 'B2047', '2026-04-16', 431, 8, 'Expired'),
('Soframycin', 'B1516', '2026-01-25', 108, 5, 'Expired'),
('Dolo 650', 'B1748', '2027-09-18', 331, 8, 'Available'),
('Cetirizine', 'B2077', '2026-04-25', 66, 19, 'Expired'),
('Iron Tonic', 'B5345', '2026-05-06', 445, 15, 'Available'),
('Ciplox', 'B5730', '2026-07-10', 433, 5, 'Available'),
('Gelusil', 'B5865', '2027-07-23', 242, 15, 'Available'),
('Crocin', 'B7406', '2026-11-01', 217, 15, 'Available'),
('Calcium Sandoz', 'B0207', '2026-04-18', 225, 7, 'Expired'),
('Pantoprazole', 'B0801', '2026-11-19', 181, 9, 'Available'),
('Ciprofloxacin', 'B8652', '2026-05-09', 112, 9, 'Available'),
('Multivitamin', 'B2110', '2027-02-15', 326, 17, 'Available'),
('Crocin', 'B7337', '2027-09-13', 107, 5, 'Available'),
('Vitamin C', 'B0886', '2026-05-06', 407, 9, 'Available'),
('Ciplox', 'B5286', '2026-05-07', 246, 5, 'Available'),
('Pantoprazole', 'B0557', '2026-05-07', 223, 9, 'Available'),
('Gelusil', 'B6111', '2025-12-01', 313, 5, 'Expired'),
('Cetirizine', 'B9565', '2026-08-04', 298, 8, 'Available'),
('Crocin', 'B5113', '2026-05-08', 200, 11, 'Available'),
('Amoxicillin', 'B1322', '2026-11-29', 93, 15, 'Available'),
('Crocin', 'B9754', '2026-01-22', 84, 13, 'Expired'),
('Ibuprofen', 'B3745', '2025-12-11', 214, 13, 'Expired'),
('Azithromycin', 'B1319', '2027-06-16', 391, 18, 'Available'),
('Vitamin C', 'B1720', '2026-06-14', 185, 4, 'Available'),
('Amoxicillin', 'B7989', '2026-05-10', 121, 6, 'Available'),
('Iron Tonic', 'B4711', '2026-02-04', 367, 14, 'Expired'),
('Soframycin', 'B2430', '2027-04-19', 398, 16, 'Available'),
('Calcium Sandoz', 'B7580', '2027-01-07', 322, 5, 'Available'),
('Paracetamol', 'B4982', '2026-05-06', 81, 5, 'Available'),
('Ibuprofen', 'B8614', '2028-01-31', 353, 8, 'Available'),
('Gelusil', 'B4358', '2026-07-15', 368, 15, 'Available'),
('Amoxicillin', 'B8919', '2026-05-06', 117, 15, 'Available'),
('Pantoprazole', 'B9055', '2025-11-14', 137, 14, 'Expired'),
('Amoxicillin', 'B5718', '2026-12-07', 333, 5, 'Available'),
('Dolo 650', 'B9080', '2025-12-12', 379, 2, 'Expired'),
('Calcium Sandoz', 'B2058', '2027-11-28', 326, 15, 'Available'),
('Soframycin', 'B6105', '2026-02-14', 311, 9, 'Expired'),
('Ibuprofen', 'B1848', '2026-04-21', 141, 4, 'Expired'),
('Ibuprofen', 'B3638', '2027-07-24', 167, 2, 'Available'),
('Ciprofloxacin', 'B9487', '2027-06-14', 394, 18, 'Available'),
('Digene', 'B3721', '2026-11-06', 330, 5, 'Available'),
('Multivitamin', 'B1422', '2026-05-09', 59, 3, 'Available'),
('Pantoprazole', 'B3666', '2025-11-14', 143, 13, 'Expired'),
('Crocin', 'B5225', '2025-11-07', 279, 15, 'Expired'),
('Ibuprofen', 'B3874', '2026-08-10', 394, 6, 'Available'),
('Crocin', 'B2022', '2025-11-28', 235, 5, 'Expired'),
('Pantoprazole', 'B5398', '2027-08-06', 406, 11, 'Available'),
('Cough Syrup Rx', 'B5376', '2026-05-07', 141, 6, 'Available'),
('Calcium Sandoz', 'B8083', '2026-01-17', 127, 10, 'Expired'),
('Paracetamol', 'B2354', '2025-11-12', 197, 15, 'Expired'),
('Cetirizine', 'B9254', '2026-05-09', 374, 4, 'Available'),
('Azithromycin', 'B9731', '2027-05-21', 233, 5, 'Available'),
('Pantoprazole', 'B5479', '2025-12-04', 65, 7, 'Expired');

INSERT INTO Requests (ngo_id, medicine_name, required_quantity, remaining_quantity, urgency, status) VALUES
(32, 'Crocin', 113, 113, 'High', 'Pending'),
(34, 'Iron Tonic', 316, 316, 'Low', 'Pending'),
(40, 'Amoxicillin', 251, 251, 'Medium', 'Pending'),
(34, 'Crocin', 148, 148, 'High', 'Pending'),
(22, 'Multivitamin', 26, 26, 'High', 'Pending'),
(33, 'Ibuprofen', 310, 310, 'Medium', 'Pending'),
(26, 'Digene', 115, 115, 'Medium', 'Pending'),
(25, 'Betadine', 318, 318, 'Low', 'Pending'),
(26, 'Dolo 650', 87, 87, 'Low', 'Pending'),
(40, 'Ciplox', 283, 283, 'High', 'Pending'),
(26, 'Cough Syrup Rx', 202, 202, 'Medium', 'Pending'),
(30, 'Betadine', 91, 91, 'High', 'Pending'),
(30, 'Paracetamol', 179, 179, 'Medium', 'Pending'),
(21, 'Digene', 300, 300, 'High', 'Pending'),
(40, 'Crocin', 155, 155, 'Low', 'Pending'),
(39, 'Vitamin C', 72, 72, 'High', 'Pending'),
(40, 'Cough Syrup Rx', 251, 251, 'Medium', 'Pending'),
(31, 'Vitamin C', 154, 154, 'Low', 'Pending'),
(22, 'Cetirizine', 286, 286, 'High', 'Pending'),
(36, 'Paracetamol', 25, 25, 'Medium', 'Pending'),
(36, 'Omeprazole', 195, 195, 'High', 'Pending'),
(26, 'Soframycin', 239, 239, 'Medium', 'Pending'),
(26, 'Gelusil', 218, 218, 'Medium', 'Pending'),
(38, 'Soframycin', 265, 265, 'High', 'Pending'),
(22, 'Multivitamin', 86, 86, 'High', 'Pending'),
(25, 'Cough Syrup Rx', 73, 73, 'Low', 'Pending'),
(31, 'Gelusil', 293, 293, 'Low', 'Pending'),
(24, 'Crocin', 38, 38, 'High', 'Pending'),
(21, 'Ibuprofen', 39, 39, 'Medium', 'Pending'),
(37, 'Calcium Sandoz', 252, 252, 'Low', 'Pending'),
(33, 'Vitamin C', 121, 121, 'Medium', 'Pending'),
(28, 'Ciprofloxacin', 125, 125, 'High', 'Pending'),
(38, 'Gelusil', 164, 164, 'Medium', 'Pending'),
(21, 'Omeprazole', 173, 173, 'High', 'Pending'),
(31, 'Azithromycin', 299, 299, 'Low', 'Pending'),
(23, 'Iron Tonic', 285, 285, 'Medium', 'Pending'),
(21, 'Omeprazole', 170, 170, 'High', 'Pending'),
(37, 'Ciplox', 224, 224, 'High', 'Pending'),
(39, 'Pantoprazole', 310, 310, 'Low', 'Pending'),
(40, 'Ciplox', 218, 218, 'Low', 'Pending'),
(34, 'Cetirizine', 280, 280, 'Medium', 'Pending'),
(33, 'Ibuprofen', 189, 189, 'Low', 'Pending'),
(24, 'Crocin', 139, 139, 'Medium', 'Pending'),
(30, 'Iron Tonic', 166, 166, 'High', 'Pending'),
(34, 'Betadine', 255, 255, 'Medium', 'Pending'),
(35, 'Ibuprofen', 304, 304, 'High', 'Pending'),
(35, 'Digene', 246, 246, 'Low', 'Pending'),
(36, 'Cough Syrup Rx', 318, 318, 'High', 'Pending'),
(23, 'Amoxicillin', 109, 109, 'Medium', 'Pending'),
(28, 'Amoxicillin', 284, 284, 'High', 'Pending'),
(35, 'Cough Syrup Rx', 208, 208, 'High', 'Pending'),
(21, 'Cetirizine', 70, 70, 'High', 'Pending'),
(29, 'Multivitamin', 261, 261, 'High', 'Pending'),
(24, 'Calcium Sandoz', 307, 307, 'Medium', 'Pending'),
(26, 'Cetirizine', 255, 255, 'Low', 'Pending'),
(34, 'Azithromycin', 23, 23, 'Medium', 'Pending'),
(30, 'Cetirizine', 64, 64, 'Low', 'Pending'),
(27, 'Soframycin', 30, 30, 'Low', 'Pending'),
(33, 'Omeprazole', 121, 121, 'Low', 'Pending'),
(28, 'Crocin', 285, 285, 'High', 'Pending');

INSERT INTO Transfers (medicine_id, ngo_id, quantity_transferred, transfer_date, expiry_date) VALUES
(22, 38, 15, NOW(), '2026-08-12'),
(34, 35, 53, NOW(), '2026-08-12'),
(13, 31, 41, NOW(), '2026-08-12'),
(28, 33, 36, NOW(), '2026-08-12'),
(3, 34, 39, NOW(), '2026-08-12'),
(92, 33, 47, NOW(), '2026-08-12'),
(47, 29, 55, NOW(), '2026-08-12'),
(82, 38, 45, NOW(), '2026-08-12'),
(51, 28, 49, NOW(), '2026-08-12'),
(64, 35, 21, NOW(), '2026-08-12'),
(81, 33, 39, NOW(), '2026-08-12'),
(80, 27, 14, NOW(), '2026-08-12'),
(1, 24, 21, NOW(), '2026-08-12'),
(90, 35, 53, NOW(), '2026-08-12'),
(9, 33, 12, NOW(), '2026-08-12');

