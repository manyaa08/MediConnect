-- 1. DATABASE CREATION QUERIES

CREATE DATABASE IF NOT EXISTS mediconnect;
USE mediconnect;


-- 2. TABLE CREATION QUERIES

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
    status ENUM('Available', 'Unavailable', 'Claimed') DEFAULT 'Available',
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
    quantity_transferred INT NOT NULL,
    transfer_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expiry_date DATE NOT NULL,
    CONSTRAINT fk_transfer_medicine FOREIGN KEY (medicine_id) REFERENCES Medicines(medicine_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_transfer_ngo FOREIGN KEY (ngo_id) REFERENCES Users(user_id) ON DELETE CASCADE ON UPDATE CASCADE
);


-- 3. DATA INSERTION QUERIES

INSERT INTO Users (name, email, password_hash, role, city) VALUES 
('ABC Pharmacy', 'abc@gmail.com', 'hashed_pwd_here', 'Donor', 'Delhi');

INSERT IGNORE INTO Medicines_Info (medicine_name, category) VALUES 
('Paracetamol', 'Tablet');

INSERT INTO Medicines (medicine_name, batch_number, expiry_date, quantity, donor_id, status) VALUES 
('Paracetamol', 'B001', '2026-12-31', 100, 1, 'Available');

INSERT INTO Requests (ngo_id, medicine_name, required_quantity, remaining_quantity, urgency, status) VALUES 
(3, 'Paracetamol', 80, 80, 'High', 'Pending');

INSERT INTO Transfers (medicine_id, ngo_id, quantity_transferred, transfer_date, expiry_date) VALUES 
(1, 3, 20, NOW(), '2026-12-31');


-- 4. DATA RETRIEVAL QUERIES (SELECT)

SELECT * FROM Requests WHERE ngo_id = ?;

SELECT * FROM Requests WHERE request_id = ?;

SELECT m.*, mi.category 
FROM Medicines m 
JOIN Medicines_Info mi ON m.medicine_name = mi.medicine_name 
WHERE m.status='Available' AND m.quantity > 0;

SELECT m.*, mi.category 
FROM Medicines m 
JOIN Medicines_Info mi ON m.medicine_name = mi.medicine_name 
WHERE m.donor_id=? AND m.quantity > 0;

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


-- 5. UPDATE QUERIES

UPDATE Medicines 
SET quantity = quantity - ?, 
    status = IF(quantity <= 0, 'Unavailable', 'Available') 
WHERE medicine_id = ?;

UPDATE Requests 
SET remaining_quantity = remaining_quantity - ?, 
    status = IF(remaining_quantity - ? <= 0, 'Completed', 'Partially Fulfilled') 
WHERE request_id = ?;


-- 6. DELETE / TRUNCATE QUERIES

SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE Transfers;
TRUNCATE TABLE Requests;
TRUNCATE TABLE Medicines;
TRUNCATE TABLE Medicines_Info;
TRUNCATE TABLE Users;

SET FOREIGN_KEY_CHECKS = 1;


-- 7. ADVANCED QUERIES

SELECT
    COUNT(DISTINCT m.medicine_id) AS total_medicines_listed,
    COALESCE(SUM(t.quantity_transferred),0) AS total_units_transferred,
    COALESCE(SUM(CASE WHEN m.status='Available' THEN m.quantity ELSE 0 END),0) AS current_available_units
FROM Medicines m
LEFT JOIN Transfers t ON m.medicine_id = t.medicine_id
WHERE m.donor_id = ?;

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


-- 8. TRIGGERS / PROCEDURES

DELIMITER $$

CREATE TRIGGER After_Transfer_Insert
AFTER INSERT ON Transfers
FOR EACH ROW
BEGIN
    UPDATE Medicines 
    SET quantity = quantity - NEW.quantity_transferred,
        status = IF(quantity - NEW.quantity_transferred <= 0, 'Unavailable', 'Available')
    WHERE medicine_id = NEW.medicine_id;

    UPDATE Requests 
    SET remaining_quantity = remaining_quantity - NEW.quantity_transferred,
        status = IF(remaining_quantity - NEW.quantity_transferred <= 0, 'Completed', 'Partially Fulfilled')
    WHERE ngo_id = NEW.ngo_id 
      AND medicine_name = (SELECT medicine_name FROM Medicines WHERE medicine_id = NEW.medicine_id)
      AND remaining_quantity > 0
    LIMIT 1;
END$$

DELIMITER ;


-- 9. AUTHENTICATION-RELATED QUERIES

INSERT INTO Users (name, email, password_hash, role, city) 
VALUES (?, ?, ?, ?, ?);

SELECT * FROM Users WHERE email = ?;
