-- Update schema to support train number (T1, T33, etc.) and phase
-- Run this in Supabase SQL Editor

-- Add train_number and phase columns to train_units
ALTER TABLE train_units
ADD COLUMN IF NOT EXISTS train_number INTEGER,
ADD COLUMN IF NOT EXISTS phase VARCHAR(50),
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE;

-- Create index for faster querying
CREATE INDEX IF NOT EXISTS idx_train_units_train_number ON train_units(train_number);
CREATE INDEX IF NOT EXISTS idx_train_units_phase ON train_units(phase);
