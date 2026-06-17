-- Add is_verified column to Users table if not already present
ALTER TABLE Users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT TRUE;
