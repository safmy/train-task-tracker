-- Update schema to store task details directly in task_completions
-- Run this in Supabase SQL Editor

-- Add new columns to task_completions if they don't exist
ALTER TABLE task_completions
ADD COLUMN IF NOT EXISTS task_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Remove the foreign key constraint to task_templates (make it optional)
-- First drop the constraint if it exists
ALTER TABLE task_completions
DROP CONSTRAINT IF EXISTS task_completions_task_template_id_fkey;

-- Make task_template_id nullable
ALTER TABLE task_completions
ALTER COLUMN task_template_id DROP NOT NULL;

-- Drop the unique constraint that requires task_template_id
ALTER TABLE task_completions
DROP CONSTRAINT IF EXISTS task_completions_car_id_task_template_id_key;
