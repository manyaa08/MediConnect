-- 1. Add created_at columns for analytics
ALTER TABLE Medicines ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE Requests ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- 2. Add status column to Transfers for tracking
ALTER TABLE Transfers ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Donation Submitted';

-- 3. Modify Users role constraint to allow 'Admin'
ALTER TABLE Users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE Users ADD CONSTRAINT users_role_check CHECK (role IN ('Donor', 'NGO', 'Admin'));

-- 4. Seed an Admin user (Password is '123')
INSERT INTO Users (name, email, password_hash, role, city)
VALUES ('System Admin', 'admin@mediconnect.com', '$2b$10$9JmPUg8Z3yIX3AoXuXuuUOSy5k9.Wh9JVlGLpkisD5eV8ThOEaUUK', 'Admin', 'Kolkata')
ON CONFLICT (email) DO NOTHING;
