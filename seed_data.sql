-- ==============================================================================
-- MEDICONNECT - DATABASE INITIALIZATION & SEED SCRIPT
-- ==============================================================================
-- This script safely drops existing tables, creates a fully normalized
-- (BCNF) schema from scratch, and inserts realistic dummy data.
-- ==============================================================================

CREATE DATABASE IF NOT EXISTS mediconnect;
USE mediconnect;

-- ------------------------------------------------------------------------------
-- 1. DROP EXISTING TABLES (Safely bypassing Foreign Key constraints)
-- ------------------------------------------------------------------------------
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS Transfers;
DROP TABLE IF EXISTS Requests;
DROP TABLE IF EXISTS Medicines;
DROP TABLE IF EXISTS Medicines_Info;
DROP TABLE IF EXISTS Users;
DROP TABLE IF EXISTS QueryLogs;

SET FOREIGN_KEY_CHECKS = 1;

-- ------------------------------------------------------------------------------
-- 2. CREATE NORMALIZED TABLES (BCNF)
-- ------------------------------------------------------------------------------

-- Users Table
CREATE TABLE Users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('Donor', 'NGO') NOT NULL,
    city VARCHAR(100)
);

-- Medicines_Info Table (BCNF Decomposition)
-- Resolves the dependency: medicine_name -> category
CREATE TABLE Medicines_Info (
    medicine_name VARCHAR(255) PRIMARY KEY,
    category VARCHAR(100) NOT NULL
);

-- Medicines Table
CREATE TABLE Medicines (
    medicine_id INT AUTO_INCREMENT PRIMARY KEY,
    medicine_name VARCHAR(255) NOT NULL,
    batch_number VARCHAR(100),
    expiry_date DATE NOT NULL,
    quantity INT NOT NULL,
    donor_id INT NOT NULL,
    status ENUM('Available', 'Unavailable', 'Claimed') DEFAULT 'Available',
    CONSTRAINT fk_medicine_info FOREIGN KEY (medicine_name) REFERENCES Medicines_Info(medicine_name) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_medicine_donor FOREIGN KEY (donor_id) REFERENCES Users(user_id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- Requests Table
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

-- Transfers Table
CREATE TABLE Transfers (
    transfer_id INT AUTO_INCREMENT PRIMARY KEY,
    medicine_id INT NOT NULL,
    ngo_id INT NOT NULL,
    quantity_transferred INT NOT NULL,
    transfer_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expiry_date DATE NOT NULL,
    CONSTRAINT fk_transfer_medicine FOREIGN KEY (medicine_id) REFERENCES Medicines(medicine_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_transfer_ngo FOREIGN KEY (ngo_id) REFERENCES Users(user_id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- Optional Logging Table (for triggers)
CREATE TABLE QueryLogs (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    action VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 3. TRIGGERS (Automating Inventory & Requests)
-- ------------------------------------------------------------------------------
DELIMITER $$

-- Trigger: AFTER INSERT on Transfers
-- Purpose: Automatically reduce medicine quantity and request remaining quantity.
CREATE TRIGGER After_Transfer_Insert
AFTER INSERT ON Transfers
FOR EACH ROW
BEGIN
    -- 1. Reduce Medicine Quantity and Update Status
    UPDATE Medicines 
    SET quantity = quantity - NEW.quantity_transferred,
        status = IF(quantity - NEW.quantity_transferred <= 0, 'Unavailable', 'Available')
    WHERE medicine_id = NEW.medicine_id;

    -- 2. Reduce Request Remaining Quantity and Update Status
    -- We map the transfer to the corresponding request by NGO and Medicine Name
    UPDATE Requests 
    SET remaining_quantity = remaining_quantity - NEW.quantity_transferred,
        status = IF(remaining_quantity - NEW.quantity_transferred <= 0, 'Completed', 'Partially Fulfilled')
    WHERE ngo_id = NEW.ngo_id 
      AND medicine_name = (SELECT medicine_name FROM Medicines WHERE medicine_id = NEW.medicine_id)
      AND remaining_quantity > 0
    LIMIT 1; -- Ensures we only deduct from one active request at a time

    -- 3. Log the operation
    INSERT INTO QueryLogs (action, description)
    VALUES ('TRANSFER_PROCESSED', CONCAT('Transferred ', NEW.quantity_transferred, ' units of Medicine ID ', NEW.medicine_id, ' to NGO ID ', NEW.ngo_id));
END$$

DELIMITER ;

-- ------------------------------------------------------------------------------
-- 4. INSERT CLEAN DUMMY DATA
-- ------------------------------------------------------------------------------

-- Password Hash for '123' generated using bcrypt (10 rounds)
-- $2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK

-- Insert Users
INSERT INTO Users (name, email, password_hash, role, city) VALUES
('ABC Pharmacy', 'abc@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'Donor', 'Delhi'),
('LifeCare Labs', 'lifecare@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'Donor', 'Mumbai'),
('XYZ NGO', 'xyz@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'NGO', 'Delhi'),
('Health for All', 'health@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'NGO', 'Mumbai');

-- Insert Medicines Info (BCNF applied)
INSERT INTO Medicines_Info (medicine_name, category) VALUES
('Paracetamol', 'Tablet'),
('Amoxicillin', 'Capsule'),
('Cough Syrup Rx', 'Syrup'),
('Vitamin C', 'Tablet');

-- Insert Medicines Inventory
INSERT INTO Medicines (medicine_name, batch_number, expiry_date, quantity, donor_id, status) VALUES
('Paracetamol', 'B001', '2026-12-31', 100, 1, 'Available'),
('Amoxicillin', 'B002', '2025-10-15', 50, 1, 'Available'),
('Cough Syrup Rx', 'SYR099', '2025-05-20', 30, 2, 'Available'),
('Vitamin C', 'VIT123', '2027-01-01', 200, 2, 'Available');

-- Insert Requests
INSERT INTO Requests (ngo_id, medicine_name, required_quantity, remaining_quantity, urgency, status) VALUES
(3, 'Paracetamol', 80, 80, 'High', 'Pending'),
(3, 'Amoxicillin', 30, 30, 'Medium', 'Pending'),
(4, 'Vitamin C', 50, 50, 'Low', 'Pending');

-- Insert Transfers (Fulfilling Paracetamol partially using the Trigger)
-- Because of the trigger, this INSERT will automatically deduct from Medicines and Requests!
INSERT INTO Transfers (medicine_id, ngo_id, quantity_transferred, transfer_date, expiry_date) VALUES
(1, 3, 20, NOW(), '2026-12-31');

-- After this transfer, Paracetamol quantity will become 80.
-- Request remaining_quantity will become 60, status 'Partially Fulfilled'.
