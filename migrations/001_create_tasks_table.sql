-- Create tasks table for tracking train maintenance tasks
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/fsubmqjevlfpcirgsbhi/sql

CREATE TABLE IF NOT EXISTS tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    unit_id UUID REFERENCES train_units(id) ON DELETE CASCADE,
    car_type_id UUID REFERENCES car_types(id),
    task_number VARCHAR(50),
    phase VARCHAR(100),
    task_name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
    completed_by VARCHAR(100),
    completed_date TIMESTAMP WITH TIME ZONE,
    overhaul_iroc VARCHAR(50),
    position VARCHAR(50),
    scope_delayed BOOLEAN DEFAULT FALSE,
    wi_reference VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tasks_unit_id ON tasks(unit_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_car_type_id ON tasks(car_type_id);

-- Enable Row Level Security
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations for anonymous users
DROP POLICY IF EXISTS "Allow all operations" ON tasks;
CREATE POLICY "Allow all operations" ON tasks FOR ALL USING (true) WITH CHECK (true);

-- Grant necessary permissions
GRANT ALL ON tasks TO anon;
GRANT ALL ON tasks TO authenticated;
