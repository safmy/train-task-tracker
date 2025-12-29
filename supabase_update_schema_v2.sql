-- Update schema to support train grouping (3 CAR + 4 CAR = 7 cars)
-- Run this in Supabase SQL Editor

-- Add train_name column to group units that form a complete train
ALTER TABLE train_units
ADD COLUMN IF NOT EXISTS train_name VARCHAR(100);

-- Add index for faster querying by train_name
CREATE INDEX IF NOT EXISTS idx_train_units_train_name ON train_units(train_name);
