# MySQL to PostgreSQL Migration Guide (MediConnect Backend)

This guide walks you through setting up, configuring, migrating, and testing the MediConnect backend from MySQL to PostgreSQL.

---

## 1. Installation & Dependencies

To connect to PostgreSQL from Node.js, we use the `pg` library (PostgreSQL client for Node.js). The dependency is already added to `package.json`.

Run the following command in the `backend/` directory to ensure all dependencies are installed:
```bash
npm install
```

---

## 2. PostgreSQL Setup Commands

### Local Setup (Command Line)
1. **Initialize PostgreSQL (if setting up from scratch)**:
   Ensure your PostgreSQL service is running. You can check this in Windows Services or run:
   ```powershell
   pg_ctl -D "C:\Program Files\PostgreSQL\<version>\data" start
   ```

2. **Create the target Database**:
   Log in to the default postgres database:
   ```bash
   psql -U postgres
   ```
   Execute the following SQL command to create the database:
   ```sql
   CREATE DATABASE mediconnect;
   ```

3. **Configure Environment Variables**:
   Update your `backend/.env` file to point to your PostgreSQL database.
   ```env
   PORT=5000
   PGHOST=localhost
   PGPORT=5432
   PGDATABASE=mediconnect
   PGUSER=postgres
   PGPASSWORD=your_password
   ```

---

## 3. Table Creation Script (PostgreSQL / PLpgSQL)

Run the following command to populate the database tables, triggers, and procedures:
```bash
psql -U postgres -d mediconnect -f project_queries.sql
```
*Alternatively, you can run the seed script to import schema along with realistic dummy records:*
```bash
psql -U postgres -d mediconnect -f seed_data.sql
```

### PostgreSQL Schema Definition DDL
The full PostgreSQL schema definition includes tables, foreign keys, trigger functions, and stored procedures:

```sql
-- Drop old tables
DROP TABLE IF EXISTS Transfers CASCADE;
DROP TABLE IF EXISTS Requests CASCADE;
DROP TABLE IF EXISTS Medicines CASCADE;
DROP TABLE IF EXISTS Medicines_Info CASCADE;
DROP TABLE IF EXISTS Users CASCADE;
DROP TABLE IF EXISTS QueryLogs CASCADE;

-- Users Table
CREATE TABLE Users (
    user_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('Donor', 'NGO')),
    city VARCHAR(100),
    is_verified BOOLEAN DEFAULT TRUE
);

-- Medicines Info Table
CREATE TABLE Medicines_Info (
    medicine_name VARCHAR(255) PRIMARY KEY,
    category VARCHAR(100) NOT NULL
);

-- Medicines Table
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

-- Requests Table
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

-- Transfers Table
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

-- Query Logs Table
CREATE TABLE QueryLogs (
    log_id SERIAL PRIMARY KEY,
    action VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 4. Stored Procedures & Triggers Translation

PostgreSQL handles procedures, triggers, and functions using PL/pgSQL language blocks.

### A. Expiry Classification Function
Determines the current classification of a medicine package.
```sql
CREATE OR REPLACE FUNCTION classify_expiry(exp_date DATE) 
RETURNS VARCHAR(20) 
AS $$
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
$$ LANGUAGE plpgsql STABLE;
```

### B. Trigger on Insert/Update Medicines
Autocalculates status flag.
```sql
-- Before insert
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
FOR EACH ROW EXECUTE FUNCTION before_medicine_insert_fn();

-- Before update
CREATE OR REPLACE FUNCTION before_medicine_update_fn() 
RETURNS TRIGGER AS $$
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
```

### C. Transfer Cascade Triggers
Reduces medicine quantity, marks requests as complete, and logs query action.
```sql
-- After transfer
CREATE OR REPLACE FUNCTION after_transfer_insert_fn() 
RETURNS TRIGGER AS $$
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
```

---

## 5. Data Migration Steps (MySQL to PostgreSQL)

If migrating production data from MySQL to PostgreSQL, choose one of these standard methods:

### Method A: pgloader (Recommended, Automatic)
`pgloader` is an open-source tool that migrates a MySQL database directly to a PostgreSQL database, managing type casting and constraints automatically.
1. Run pgloader from command line:
   ```bash
   pgloader mysql://root:password@localhost/mediconnect postgresql://postgres:password@localhost/mediconnect
   ```

### Method B: CSV Export/Import (Manual)
1. **Export MySQL tables to CSV**:
   ```sql
   SELECT * FROM Users INTO OUTFILE '/var/lib/mysql-files/users.csv' FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"' LINES TERMINATED BY '\n';
   ```
2. **Import CSV to PostgreSQL**:
   Use psql `\copy` command to import:
   ```sql
   \copy Users(user_id, name, email, password_hash, role, city) FROM 'users.csv' DELIMITER ',' CSV HEADER;
   ```
3. **Synchronize Serial Sequences**:
   Since SERIAL indexes are imported with raw values, adjust the sequential counter:
   ```sql
   SELECT setval('users_user_id_seq', COALESCE((SELECT MAX(user_id)+1 FROM Users), 1), false);
   SELECT setval('medicines_medicine_id_seq', COALESCE((SELECT MAX(medicine_id)+1 FROM Medicines), 1), false);
   SELECT setval('requests_request_id_seq', COALESCE((SELECT MAX(request_id)+1 FROM Requests), 1), false);
   SELECT setval('transfers_transfer_id_seq', COALESCE((SELECT MAX(transfer_id)+1 FROM Transfers), 1), false);
   ```

---

## 6. Testing Checklist

Use the checklist below to verify every REST API route is working correctly:

### Authentication & Users
- [ ] **User Registration**: `POST /users/register`
  - Body: `{ "name": "Donor Pharma", "email": "pharma@gmail.com", "password": "123", "role": "Donor", "city": "Kolkata" }`
  - Success Response: `201 Created`
- [ ] **User Login**: `POST /users/login`
  - Body: `{ "email": "pharma@gmail.com", "password": "123" }`
  - Success Response: `200 OK` (extract JWT token)

### Medicines (Donor Portal)
- [ ] **Add Medicine**: `POST /medicines/add` (requires Donor Token)
  - Body: `{ "medicine_name": "Paracetamol", "batch_number": "B999", "expiry_date": "2027-12-01", "quantity": 100, "category": "Tablet" }`
  - Verification: Check if `Medicines_Info` resolves duplicates (`ON CONFLICT`).
- [ ] **My Medicines**: `GET /medicines/my-medicines` (requires Donor Token)
  - Success Response: `200 OK` (list of donor's inventory)

### NGO Portal & Requests
- [ ] **Create Request**: `POST /requests/create` (requires NGO Token)
  - Body: `{ "medicine_name": "Paracetamol", "required_quantity": 50, "urgency": "High" }`
  - Success Response: `201 Created`
- [ ] **Matching Needs**: `GET /requests/matching-needs` (requires Donor Token)
  - Success Response: Returns list of NGO requests in the same city matching available donor inventory.

### Fulfillment & Transfers
- [ ] **Fulfill Request**: `POST /requests/fulfill` (requires Donor Token)
  - Body: `{ "request_id": 1, "quantity": 40 }`
  - Verification: Verify that the stored procedure `CALL fulfill_request` is invoked and the transfer is processed using FEFO (First Expired First Out) batches.
  - Cascade check: Check if `quantity` in `Medicines` decreases by 40, and `remaining_quantity` in `Requests` decreases by 40.

### Dashboards
- [ ] **Donor Dashboard**: `GET /dashboard/donor` (requires Donor Token)
  - Verification: Calls `SELECT * FROM get_donor_dashboard($1)` and queries total transfers/available items.
- [ ] **NGO Dashboard**: `GET /dashboard/ngo` (requires NGO Token)
  - Verification: Fetches current requests, received transfers, and near-expiry warnings in parallel.
