const fs = require('fs');
const path = require('path');

const usersCount = 40;
const medicinesInfoCount = 20;
const medicinesCount = 100;
const requestsCount = 60;
const transfersCount = 15;

const hash = '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK'; // '123'

const cities = ['Delhi', 'Mumbai', 'Bangalore', 'Chennai', 'Kolkata', 'Hyderabad', 'Pune'];
const roles = ['Donor', 'NGO'];

const firstNames = ['Amit', 'Priya', 'Rahul', 'Neha', 'Vikram', 'Sneha', 'Rohan', 'Pooja', 'Anil', 'Kavita', 'Suresh', 'Anita'];
const lastNames = ['Sharma', 'Verma', 'Gupta', 'Singh', 'Patel', 'Kumar', 'Joshi', 'Reddy', 'Rao', 'Das'];

const ngoNames = ['Hope Foundation', 'Care India', 'Smile NGO', 'Health Bridge', 'Sanjeevani', 'Helping Hands', 'Life Savers', 'Asha Society', 'Umeed', 'Jeevan Daan'];
const pharmaNames = ['Apollo Pharmacy', 'MedPlus', 'Pharmeasy Store', 'Netmeds Hub', 'LifeCare Labs', 'HealthKart', 'Wellness Forever', 'Guardian Pharmacy', 'Religare Wellness', 'Sanjeevani Med'];

const categories = ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Ointment', 'Drops'];

const medNames = [
    { name: 'Paracetamol', cat: 'Tablet' }, { name: 'Amoxicillin', cat: 'Capsule' },
    { name: 'Cough Syrup Rx', cat: 'Syrup' }, { name: 'Vitamin C', cat: 'Tablet' },
    { name: 'Ibuprofen', cat: 'Tablet' }, { name: 'Cetirizine', cat: 'Tablet' },
    { name: 'Azithromycin', cat: 'Capsule' }, { name: 'Ciprofloxacin', cat: 'Tablet' },
    { name: 'Omeprazole', cat: 'Capsule' }, { name: 'Pantoprazole', cat: 'Tablet' },
    { name: 'Multivitamin', cat: 'Capsule' }, { name: 'Calcium Sandoz', cat: 'Tablet' },
    { name: 'Iron Tonic', cat: 'Syrup' }, { name: 'Dolo 650', cat: 'Tablet' },
    { name: 'Crocin', cat: 'Tablet' }, { name: 'Digene', cat: 'Tablet' },
    { name: 'Gelusil', cat: 'Syrup' }, { name: 'Betadine', cat: 'Ointment' },
    { name: 'Soframycin', cat: 'Ointment' }, { name: 'Ciplox', cat: 'Drops' }
];

const urgencies = ['High', 'Medium', 'Low'];

function randomDate(start, end) {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

let sql = `
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

`;

// Generate Users
let usersSQL = "INSERT INTO Users (name, email, password_hash, role, city) VALUES\n";
let donors = [];
let ngos = [];

for (let i = 1; i <= usersCount; i++) {
    const isDonor = i <= 20;
    const role = isDonor ? 'Donor' : 'NGO';
    let name = isDonor ? pharmaNames[i % pharmaNames.length] + ' ' + Math.floor(Math.random() * 100) : ngoNames[i % ngoNames.length] + ' ' + Math.floor(Math.random() * 100);
    const email = (name.replace(/\s/g, '').toLowerCase()) + '@gmail.com';
    const city = cities[Math.floor(Math.random() * cities.length)];
    
    if (isDonor) donors.push(i);
    else ngos.push(i);

    usersSQL += `('${name}', '${email}', '${hash}', '${role}', '${city}')${i === usersCount ? ';' : ','}\n`;
}
sql += usersSQL + "\n";

// Generate Medicines Info
let medInfoSQL = "INSERT INTO Medicines_Info (medicine_name, category) VALUES\n";
medNames.forEach((med, idx) => {
    medInfoSQL += `('${med.name}', '${med.cat}')${idx === medNames.length - 1 ? ';' : ','}\n`;
});
sql += medInfoSQL + "\n";

// Generate Medicines
let medicinesSQL = "INSERT INTO Medicines (medicine_name, batch_number, expiry_date, quantity, donor_id, status) VALUES\n";
let currentDate = new Date();
for (let i = 1; i <= medicinesCount; i++) {
    const med = medNames[Math.floor(Math.random() * medNames.length)].name;
    const batch = 'B' + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    
    let expDate;
    const rand = Math.random();
    if (rand < 0.2) {
        // Expired (last 6 months)
        expDate = randomDate(new Date(currentDate.getTime() - 180 * 24 * 60 * 60 * 1000), currentDate);
    } else if (rand < 0.4) {
        // Near Expiry (next 7 days)
        expDate = randomDate(currentDate, new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000));
    } else {
        // Available
        expDate = randomDate(new Date(currentDate.getTime() + 10 * 24 * 60 * 60 * 1000), new Date(currentDate.getTime() + 730 * 24 * 60 * 60 * 1000));
    }
    
    const formattedDate = expDate.toISOString().split('T')[0];
    const qty = Math.floor(Math.random() * 400) + 50;
    const donorId = donors[Math.floor(Math.random() * donors.length)];
    let status = expDate < currentDate ? 'Expired' : 'Available';

    medicinesSQL += `('${med}', '${batch}', '${formattedDate}', ${qty}, ${donorId}, '${status}')${i === medicinesCount ? ';' : ','}\n`;
}
sql += medicinesSQL + "\n";

// Generate Requests
let requestsSQL = "INSERT INTO Requests (ngo_id, medicine_name, required_quantity, remaining_quantity, urgency, status) VALUES\n";
for (let i = 1; i <= requestsCount; i++) {
    const ngoId = ngos[Math.floor(Math.random() * ngos.length)];
    const med = medNames[Math.floor(Math.random() * medNames.length)].name;
    const reqQty = Math.floor(Math.random() * 300) + 20;
    const urgency = urgencies[Math.floor(Math.random() * urgencies.length)];

    requestsSQL += `(${ngoId}, '${med}', ${reqQty}, ${reqQty}, '${urgency}', 'Pending')${i === requestsCount ? ';' : ','}\n`;
}
sql += requestsSQL + "\n";

// Generate Transfers
let transfersSQL = "INSERT INTO Transfers (medicine_id, ngo_id, quantity_transferred, transfer_date, expiry_date) VALUES\n";
for (let i = 1; i <= transfersCount; i++) {
    // We assume some match. Since this is dummy data and the trigger handles it, 
    // we'll just insert random valid associations. 
    // Wait, the trigger requires corresponding Request by ngo_id and medicine_name to exist, otherwise it just won't update any request.
    // It's better to pick an existing Request to fulfill.
    
    // Simplification: We'll just leave it empty or add generic transfers that might not link perfectly
    // For demo purposes, we can let some transfers exist. We can also let the trigger fail if no request is found? No, trigger doesn't fail, it has LIMIT 1.
    const medId = Math.floor(Math.random() * medicinesCount) + 1;
    const ngoId = ngos[Math.floor(Math.random() * ngos.length)];
    const qty = Math.floor(Math.random() * 50) + 10;
    const expDate = new Date(currentDate.getTime() + 100 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    transfersSQL += `(${medId}, ${ngoId}, ${qty}, NOW(), '${expDate}')${i === transfersCount ? ';' : ','}\n`;
}
sql += transfersSQL + "\n";

const outputPath = path.join(__dirname, '../seed_data.sql');
fs.writeFileSync(outputPath, sql);
console.log('Seed data generated successfully at ' + outputPath);
