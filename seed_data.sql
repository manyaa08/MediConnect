
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


INSERT INTO Users (name, email, password_hash, role, city) VALUES
('MedPlus 16', 'medplus16@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'Donor', 'Hyderabad'),
('Pharmeasy Store 72', 'pharmeasystore72@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'Donor', 'Kolkata'),
('Netmeds Hub 84', 'netmedshub84@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'Donor', 'Delhi'),
('LifeCare Labs 47', 'lifecarelabs47@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'Donor', 'Chennai'),
('HealthKart 10', 'healthkart10@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'Donor', 'Mumbai'),
('Wellness Forever 75', 'wellnessforever75@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'Donor', 'Kolkata'),
('Guardian Pharmacy 32', 'guardianpharmacy32@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'Donor', 'Pune'),
('Religare Wellness 41', 'religarewellness41@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'Donor', 'Pune'),
('Sanjeevani Med 90', 'sanjeevanimed90@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'Donor', 'Kolkata'),
('Apollo Pharmacy 32', 'apollopharmacy32@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'Donor', 'Hyderabad'),
('MedPlus 47', 'medplus47@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'Donor', 'Hyderabad'),
('Pharmeasy Store 79', 'pharmeasystore79@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'Donor', 'Kolkata'),
('Netmeds Hub 19', 'netmedshub19@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'Donor', 'Mumbai'),
('LifeCare Labs 67', 'lifecarelabs67@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'Donor', 'Pune'),
('HealthKart 17', 'healthkart17@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'Donor', 'Chennai'),
('Wellness Forever 8', 'wellnessforever8@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'Donor', 'Bangalore'),
('Guardian Pharmacy 1', 'guardianpharmacy1@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'Donor', 'Mumbai'),
('Religare Wellness 89', 'religarewellness89@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'Donor', 'Kolkata'),
('Sanjeevani Med 91', 'sanjeevanimed91@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'Donor', 'Bangalore'),
('Apollo Pharmacy 8', 'apollopharmacy8@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'Donor', 'Bangalore'),
('Care India 85', 'careindia85@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'NGO', 'Kolkata'),
('Smile NGO 57', 'smilengo57@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'NGO', 'Hyderabad'),
('Health Bridge 87', 'healthbridge87@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'NGO', 'Bangalore'),
('Sanjeevani 71', 'sanjeevani71@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'NGO', 'Mumbai'),
('Helping Hands 2', 'helpinghands2@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'NGO', 'Kolkata'),
('Life Savers 9', 'lifesavers9@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'NGO', 'Chennai'),
('Asha Society 50', 'ashasociety50@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'NGO', 'Delhi'),
('Umeed 50', 'umeed50@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'NGO', 'Delhi'),
('Jeevan Daan 84', 'jeevandaan84@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'NGO', 'Chennai'),
('Hope Foundation 3', 'hopefoundation3@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'NGO', 'Kolkata'),
('Care India 12', 'careindia12@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'NGO', 'Hyderabad'),
('Smile NGO 40', 'smilengo40@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'NGO', 'Delhi'),
('Health Bridge 62', 'healthbridge62@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'NGO', 'Chennai'),
('Sanjeevani 29', 'sanjeevani29@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'NGO', 'Mumbai'),
('Helping Hands 19', 'helpinghands19@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'NGO', 'Hyderabad'),
('Life Savers 78', 'lifesavers78@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'NGO', 'Mumbai'),
('Asha Society 97', 'ashasociety97@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'NGO', 'Bangalore'),
('Umeed 90', 'umeed90@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'NGO', 'Chennai'),
('Jeevan Daan 94', 'jeevandaan94@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'NGO', 'Chennai'),
('Hope Foundation 50', 'hopefoundation50@gmail.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'NGO', 'Chennai');

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
('Digene', 'B5136', '2027-03-29', 438, 15, 'Available'),
('Ibuprofen', 'B2850', '2027-03-15', 266, 7, 'Available'),
('Gelusil', 'B0215', '2026-11-30', 260, 1, 'Available'),
('Betadine', 'B6032', '2027-10-13', 125, 4, 'Available'),
('Digene', 'B9594', '2026-04-02', 398, 8, 'Expired'),
('Omeprazole', 'B5479', '2027-01-31', 83, 16, 'Available'),
('Omeprazole', 'B1256', '2026-08-02', 166, 11, 'Available'),
('Ibuprofen', 'B0770', '2026-03-14', 381, 17, 'Expired'),
('Soframycin', 'B0229', '2026-04-03', 149, 5, 'Expired'),
('Soframycin', 'B9153', '2026-11-19', 285, 15, 'Available'),
('Pantoprazole', 'B8065', '2027-02-26', 310, 19, 'Available'),
('Calcium Sandoz', 'B6698', '2026-12-16', 152, 16, 'Available'),
('Ciplox', 'B7465', '2026-08-10', 116, 9, 'Available'),
('Dolo 650', 'B2622', '2026-06-17', 226, 10, 'Available'),
('Azithromycin', 'B1219', '2026-03-31', 319, 4, 'Expired'),
('Iron Tonic', 'B1390', '2026-06-20', 143, 7, 'Available'),
('Digene', 'B0093', '2026-07-01', 130, 13, 'Available'),
('Dolo 650', 'B4434', '2026-06-20', 113, 1, 'Available'),
('Ciprofloxacin', 'B1610', '2026-06-21', 243, 20, 'Available'),
('Betadine', 'B1315', '2026-11-01', 394, 14, 'Available'),
('Gelusil', 'B1152', '2026-10-28', 187, 4, 'Available'),
('Ciplox', 'B9326', '2027-09-24', 108, 2, 'Available'),
('Ciplox', 'B5620', '2026-06-17', 237, 6, 'Available'),
('Pantoprazole', 'B3605', '2026-08-29', 188, 19, 'Available'),
('Cetirizine', 'B1748', '2028-04-21', 141, 15, 'Available'),
('Multivitamin', 'B8375', '2026-02-13', 322, 18, 'Expired'),
('Soframycin', 'B2662', '2026-02-26', 226, 4, 'Expired'),
('Multivitamin', 'B0308', '2027-02-10', 402, 19, 'Available'),
('Cough Syrup Rx', 'B4158', '2026-09-27', 121, 12, 'Available'),
('Digene', 'B2639', '2028-03-11', 58, 20, 'Available'),
('Omeprazole', 'B5179', '2026-02-19', 74, 8, 'Expired'),
('Calcium Sandoz', 'B8719', '2026-04-03', 93, 4, 'Expired'),
('Calcium Sandoz', 'B2502', '2028-05-03', 416, 11, 'Available'),
('Ciprofloxacin', 'B3267', '2027-08-25', 375, 14, 'Available'),
('Betadine', 'B5357', '2026-06-23', 341, 6, 'Available'),
('Cetirizine', 'B4756', '2027-11-17', 288, 13, 'Available'),
('Ciprofloxacin', 'B9821', '2027-02-15', 241, 17, 'Available'),
('Paracetamol', 'B0135', '2026-06-19', 66, 20, 'Available'),
('Pantoprazole', 'B4711', '2026-02-17', 237, 11, 'Expired'),
('Dolo 650', 'B8229', '2026-06-22', 148, 2, 'Available'),
('Omeprazole', 'B9342', '2026-12-20', 324, 12, 'Available'),
('Calcium Sandoz', 'B8818', '2026-04-16', 445, 8, 'Expired'),
('Cough Syrup Rx', 'B5224', '2027-12-07', 154, 4, 'Available'),
('Omeprazole', 'B6997', '2027-11-07', 384, 8, 'Available'),
('Dolo 650', 'B2857', '2026-06-20', 141, 8, 'Available'),
('Cetirizine', 'B8511', '2027-05-21', 57, 4, 'Available'),
('Omeprazole', 'B8215', '2027-11-16', 253, 20, 'Available'),
('Cetirizine', 'B4051', '2027-10-09', 272, 18, 'Available'),
('Omeprazole', 'B7738', '2026-06-20', 213, 6, 'Available'),
('Cough Syrup Rx', 'B1267', '2027-12-27', 184, 10, 'Available'),
('Multivitamin', 'B3569', '2026-10-19', 367, 1, 'Available'),
('Soframycin', 'B2252', '2027-09-06', 335, 15, 'Available'),
('Ciprofloxacin', 'B2985', '2027-10-10', 97, 20, 'Available'),
('Cough Syrup Rx', 'B4853', '2027-05-29', 55, 18, 'Available'),
('Cough Syrup Rx', 'B9088', '2026-01-26', 145, 1, 'Expired'),
('Dolo 650', 'B9344', '2026-12-14', 406, 14, 'Available'),
('Multivitamin', 'B1319', '2027-01-13', 171, 7, 'Available'),
('Gelusil', 'B4743', '2026-06-20', 248, 12, 'Available'),
('Pantoprazole', 'B3876', '2026-02-04', 411, 14, 'Expired'),
('Dolo 650', 'B5499', '2026-05-09', 365, 10, 'Expired'),
('Multivitamin', 'B1596', '2026-06-22', 363, 7, 'Available'),
('Vitamin C', 'B3934', '2027-11-07', 371, 18, 'Available'),
('Amoxicillin', 'B3062', '2026-04-04', 117, 20, 'Expired'),
('Betadine', 'B2234', '2028-02-01', 180, 3, 'Available'),
('Ciprofloxacin', 'B1655', '2028-02-23', 78, 1, 'Available'),
('Gelusil', 'B8945', '2027-04-08', 358, 3, 'Available'),
('Vitamin C', 'B7366', '2026-12-28', 55, 9, 'Available'),
('Dolo 650', 'B0601', '2027-07-23', 396, 14, 'Available'),
('Calcium Sandoz', 'B5607', '2026-06-22', 413, 17, 'Available'),
('Cetirizine', 'B6170', '2026-06-21', 205, 3, 'Available'),
('Amoxicillin', 'B8576', '2026-06-22', 179, 20, 'Available'),
('Omeprazole', 'B1551', '2026-02-25', 235, 7, 'Expired'),
('Iron Tonic', 'B4310', '2026-07-23', 247, 4, 'Available'),
('Betadine', 'B5610', '2026-06-18', 162, 18, 'Available'),
('Digene', 'B3033', '2027-12-06', 340, 7, 'Available'),
('Pantoprazole', 'B3559', '2027-04-14', 440, 9, 'Available'),
('Ibuprofen', 'B9394', '2026-06-18', 182, 12, 'Available'),
('Digene', 'B8257', '2028-02-19', 283, 16, 'Available'),
('Crocin', 'B2824', '2026-06-19', 401, 13, 'Available'),
('Pantoprazole', 'B7819', '2027-02-17', 279, 2, 'Available'),
('Gelusil', 'B7538', '2027-12-10', 421, 7, 'Available'),
('Vitamin C', 'B3201', '2027-11-03', 307, 9, 'Available'),
('Iron Tonic', 'B1458', '2026-06-19', 148, 8, 'Available'),
('Omeprazole', 'B2757', '2027-05-19', 126, 4, 'Available'),
('Cetirizine', 'B5816', '2026-06-22', 383, 20, 'Available'),
('Ibuprofen', 'B2227', '2027-08-04', 89, 9, 'Available'),
('Ciprofloxacin', 'B2255', '2026-06-16', 170, 18, 'Available'),
('Digene', 'B0428', '2027-02-09', 421, 6, 'Available'),
('Gelusil', 'B6965', '2027-01-18', 229, 9, 'Available'),
('Ibuprofen', 'B1675', '2028-02-21', 114, 10, 'Available'),
('Crocin', 'B2322', '2027-03-19', 56, 9, 'Available'),
('Pantoprazole', 'B8278', '2026-11-17', 134, 15, 'Available'),
('Multivitamin', 'B0278', '2026-01-29', 338, 12, 'Expired'),
('Crocin', 'B6071', '2027-04-10', 316, 10, 'Available'),
('Amoxicillin', 'B3496', '2025-12-31', 365, 2, 'Expired'),
('Ciprofloxacin', 'B7623', '2028-02-24', 291, 3, 'Available'),
('Dolo 650', 'B8610', '2025-12-22', 316, 16, 'Expired'),
('Cetirizine', 'B3654', '2026-06-20', 102, 18, 'Available'),
('Azithromycin', 'B3554', '2026-11-10', 270, 20, 'Available'),
('Calcium Sandoz', 'B9428', '2026-01-28', 360, 7, 'Expired');

INSERT INTO Requests (ngo_id, medicine_name, required_quantity, remaining_quantity, urgency, status) VALUES
(32, 'Omeprazole', 117, 117, 'High', 'Pending'),
(31, 'Azithromycin', 152, 152, 'Low', 'Pending'),
(32, 'Azithromycin', 300, 300, 'Medium', 'Pending'),
(30, 'Cetirizine', 208, 208, 'Medium', 'Pending'),
(35, 'Cetirizine', 86, 86, 'High', 'Pending'),
(29, 'Betadine', 241, 241, 'High', 'Pending'),
(33, 'Azithromycin', 86, 86, 'High', 'Pending'),
(25, 'Omeprazole', 246, 246, 'Medium', 'Pending'),
(31, 'Ciplox', 82, 82, 'High', 'Pending'),
(34, 'Cough Syrup Rx', 103, 103, 'High', 'Pending'),
(30, 'Multivitamin', 201, 201, 'High', 'Pending'),
(35, 'Gelusil', 46, 46, 'High', 'Pending'),
(39, 'Calcium Sandoz', 75, 75, 'Medium', 'Pending'),
(35, 'Vitamin C', 304, 304, 'High', 'Pending'),
(35, 'Calcium Sandoz', 212, 212, 'Medium', 'Pending'),
(27, 'Ciplox', 227, 227, 'Medium', 'Pending'),
(25, 'Vitamin C', 317, 317, 'Low', 'Pending'),
(32, 'Calcium Sandoz', 283, 283, 'Low', 'Pending'),
(34, 'Vitamin C', 117, 117, 'High', 'Pending'),
(37, 'Ciprofloxacin', 73, 73, 'High', 'Pending'),
(37, 'Pantoprazole', 58, 58, 'High', 'Pending'),
(37, 'Gelusil', 222, 222, 'Medium', 'Pending'),
(33, 'Paracetamol', 239, 239, 'Medium', 'Pending'),
(28, 'Pantoprazole', 238, 238, 'High', 'Pending'),
(21, 'Paracetamol', 62, 62, 'Medium', 'Pending'),
(34, 'Multivitamin', 229, 229, 'Medium', 'Pending'),
(28, 'Amoxicillin', 225, 225, 'High', 'Pending'),
(40, 'Soframycin', 167, 167, 'Medium', 'Pending'),
(36, 'Cetirizine', 70, 70, 'Medium', 'Pending'),
(33, 'Paracetamol', 185, 185, 'Low', 'Pending'),
(27, 'Cough Syrup Rx', 21, 21, 'Medium', 'Pending'),
(36, 'Crocin', 68, 68, 'Medium', 'Pending'),
(21, 'Ibuprofen', 225, 225, 'Medium', 'Pending'),
(28, 'Cetirizine', 158, 158, 'High', 'Pending'),
(25, 'Ciprofloxacin', 297, 297, 'Medium', 'Pending'),
(37, 'Cetirizine', 167, 167, 'Medium', 'Pending'),
(32, 'Paracetamol', 63, 63, 'High', 'Pending'),
(38, 'Calcium Sandoz', 163, 163, 'Medium', 'Pending'),
(21, 'Calcium Sandoz', 315, 315, 'High', 'Pending'),
(33, 'Cough Syrup Rx', 234, 234, 'Low', 'Pending'),
(40, 'Calcium Sandoz', 313, 313, 'Medium', 'Pending'),
(34, 'Azithromycin', 148, 148, 'Medium', 'Pending'),
(38, 'Multivitamin', 39, 39, 'Medium', 'Pending'),
(28, 'Crocin', 101, 101, 'Medium', 'Pending'),
(27, 'Calcium Sandoz', 77, 77, 'High', 'Pending'),
(27, 'Paracetamol', 298, 298, 'Medium', 'Pending'),
(29, 'Dolo 650', 144, 144, 'Medium', 'Pending'),
(28, 'Crocin', 251, 251, 'High', 'Pending'),
(36, 'Iron Tonic', 228, 228, 'Low', 'Pending'),
(37, 'Cetirizine', 296, 296, 'Low', 'Pending'),
(34, 'Vitamin C', 143, 143, 'Medium', 'Pending'),
(29, 'Iron Tonic', 72, 72, 'Low', 'Pending'),
(22, 'Digene', 200, 200, 'High', 'Pending'),
(22, 'Soframycin', 78, 78, 'High', 'Pending'),
(25, 'Betadine', 195, 195, 'Low', 'Pending'),
(40, 'Dolo 650', 32, 32, 'Low', 'Pending'),
(31, 'Multivitamin', 258, 258, 'High', 'Pending'),
(24, 'Pantoprazole', 178, 178, 'High', 'Pending'),
(22, 'Cetirizine', 21, 21, 'Low', 'Pending'),
(32, 'Gelusil', 85, 85, 'Medium', 'Pending');

INSERT INTO Transfers (medicine_id, ngo_id, quantity_transferred, transfer_date, expiry_date) VALUES
(54, 37, 58, NOW(), '2026-09-24'),
(67, 24, 18, NOW(), '2026-09-24'),
(28, 24, 47, NOW(), '2026-09-24'),
(97, 27, 15, NOW(), '2026-09-24'),
(64, 27, 49, NOW(), '2026-09-24'),
(42, 30, 45, NOW(), '2026-09-24'),
(65, 23, 16, NOW(), '2026-09-24'),
(47, 39, 44, NOW(), '2026-09-24'),
(94, 37, 38, NOW(), '2026-09-24'),
(82, 25, 20, NOW(), '2026-09-24'),
(64, 22, 29, NOW(), '2026-09-24'),
(38, 24, 29, NOW(), '2026-09-24'),
(91, 23, 57, NOW(), '2026-09-24'),
(60, 22, 30, NOW(), '2026-09-24'),
(41, 29, 16, NOW(), '2026-09-24');

