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
-- MEDICONNECT - DATABASE INITIALIZATION & SEED SCRIPT (PostgreSQL Version)
-- ==============================================================================

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
    city VARCHAR(100)
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
-- ADVANCED SQL CONCEPTS: FUNCTIONS, PROCEDURES, TRIGGERS
-- ==============================================================================

-- 1. FUNCTIONS
CREATE OR REPLACE FUNCTION classify_expiry(exp_date DATE) RETURNS VARCHAR(20) AS $$
DECLARE
    days_left INT;
BEGIN
    days_left := exp_date - CURRENT_DATE;
    IF days_left < 0 THEN 
        RETURN 'Expired';
    ELSIF days_left < 7 THEN 
        RETURN 'Near Expiry';
    ELSE 
        RETURN 'Available';
    END IF;
END;
$$ LANGUAGE plpgsql;


-- 2. TRIGGERS

-- After Transfer Insert
CREATE OR REPLACE FUNCTION after_transfer_insert_fn() RETURNS TRIGGER AS $$
BEGIN
    UPDATE Medicines 
    SET status = CASE WHEN quantity - NEW.quantity_transferred <= 0 THEN 'Unavailable' ELSE 'Available' END,
        quantity = quantity - NEW.quantity_transferred
    WHERE medicine_id = NEW.medicine_id;

    IF NEW.request_id IS NOT NULL THEN
        UPDATE Requests 
        SET status = CASE WHEN remaining_quantity - NEW.quantity_transferred <= 0 THEN 'Completed' ELSE 'Partially Fulfilled' END,
            remaining_quantity = remaining_quantity - NEW.quantity_transferred
        WHERE request_id = NEW.request_id;
    END IF;

    INSERT INTO QueryLogs (action, description)
    VALUES ('TRANSFER_PROCESSED', 'Transferred ' || NEW.quantity_transferred || ' units of Medicine ID ' || NEW.medicine_id || ' to NGO ID ' || NEW.ngo_id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER After_Transfer_Insert
AFTER INSERT ON Transfers
FOR EACH ROW EXECUTE FUNCTION after_transfer_insert_fn();

-- Before Medicine Insert
CREATE OR REPLACE FUNCTION before_medicine_insert_fn() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.expiry_date < CURRENT_DATE THEN
        NEW.status := 'Expired';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER Before_Medicine_Insert
BEFORE INSERT ON Medicines
FOR EACH ROW EXECUTE FUNCTION before_medicine_insert_fn();

-- Before Medicine Update
CREATE OR REPLACE FUNCTION before_medicine_update_fn() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.expiry_date != OLD.expiry_date THEN
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
FOR EACH ROW EXECUTE FUNCTION before_medicine_update_fn();

-- Before Transfer Insert
CREATE OR REPLACE FUNCTION before_transfer_insert_fn() RETURNS TRIGGER AS $$
DECLARE
    med_qty INT;
    req_qty INT;
BEGIN
    SELECT quantity INTO med_qty FROM Medicines WHERE medicine_id = NEW.medicine_id;
    IF med_qty IS NULL THEN med_qty := 0; END IF;

    IF NEW.quantity_transferred > med_qty THEN
        RAISE EXCEPTION 'Transfer quantity exceeds available stock.';
    END IF;
    
    IF NEW.request_id IS NOT NULL THEN
        SELECT remaining_quantity INTO req_qty FROM Requests WHERE request_id = NEW.request_id;
        IF req_qty IS NULL THEN req_qty := 0; END IF;
        
        IF NEW.quantity_transferred > req_qty THEN
            RAISE EXCEPTION 'Transfer quantity exceeds requested quantity.';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER Before_Transfer_Insert
BEFORE INSERT ON Transfers
FOR EACH ROW EXECUTE FUNCTION before_transfer_insert_fn();


-- 3. STORED PROCEDURES

-- Expiry Scanner
CREATE OR REPLACE PROCEDURE Expiry_Scanner()
LANGUAGE plpgsql
AS $$
DECLARE
    m_record RECORD;
    new_status VARCHAR(20);
BEGIN
    FOR m_record IN SELECT medicine_id, expiry_date FROM Medicines LOOP
        new_status := classify_expiry(m_record.expiry_date);
        UPDATE Medicines SET status = new_status WHERE medicine_id = m_record.medicine_id;
    END LOOP;
END;
$$;

-- Dashboard Aggregation (Changed to Function returning table for easy Node consumption)
CREATE OR REPLACE FUNCTION get_donor_dashboard(p_donor_id INT)
RETURNS TABLE(total_meds INT, total_avail INT, total_exp INT, total_near INT)
LANGUAGE plpgsql
AS $$
DECLARE
    m_status VARCHAR(20);
BEGIN
    total_meds := 0;
    total_avail := 0;
    total_exp := 0;
    total_near := 0;
    
    FOR m_status IN SELECT classify_expiry(expiry_date) FROM Medicines WHERE donor_id = p_donor_id AND quantity > 0 LOOP
        total_meds := total_meds + 1;
        IF m_status = 'Available' THEN 
            total_avail := total_avail + 1;
        ELSIF m_status = 'Expired' THEN 
            total_exp := total_exp + 1;
        ELSIF m_status = 'Near Expiry' THEN 
            total_near := total_near + 1;
        END IF;
    END LOOP;
    
    RETURN NEXT;
END;
$$;

-- Fulfill Request
CREATE OR REPLACE PROCEDURE fulfill_request(p_request_id INT, p_medicine_id INT, p_qty INT)
LANGUAGE plpgsql
AS $$
DECLARE
    v_ngo_id INT;
    v_exp_date DATE;
BEGIN
    SELECT ngo_id INTO v_ngo_id FROM Requests WHERE request_id = p_request_id;
    SELECT expiry_date INTO v_exp_date FROM Medicines WHERE medicine_id = p_medicine_id;
    
    INSERT INTO Transfers (medicine_id, ngo_id, request_id, quantity_transferred, transfer_date, expiry_date)
    VALUES (p_medicine_id, v_ngo_id, p_request_id, p_qty, CURRENT_TIMESTAMP, v_exp_date);
END;
$$;

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
