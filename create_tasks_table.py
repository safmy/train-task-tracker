#!/usr/bin/env python3
"""
Create the tasks table in Supabase using the REST API
"""

from supabase import create_client
import requests

# Supabase configuration
SUPABASE_URL = "https://fsubmqjevlfpcirgsbhi.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzdWJtcWpldmxmcGNpcmdzYmhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkzNTgyNzgsImV4cCI6MjA2NDkzNDI3OH0.Hfo1kCUCVMvr2ffhLJ3rp7qLMchWYdmBkzOYcorQVQE"

# SQL to create the tasks table
CREATE_TABLE_SQL = """
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

-- Create policy to allow all operations for now (anon key)
CREATE POLICY "Allow all operations" ON tasks FOR ALL USING (true) WITH CHECK (true);
"""

print("="*60)
print("CREATING TASKS TABLE IN SUPABASE")
print("="*60)
print("\nPlease run this SQL in the Supabase SQL Editor:")
print("-"*60)
print(CREATE_TABLE_SQL)
print("-"*60)
print("\nTo access the SQL Editor:")
print("1. Go to: https://supabase.com/dashboard/project/fsubmqjevlfpcirgsbhi")
print("2. Click 'SQL Editor' in the left sidebar")
print("3. Paste the SQL above and click 'Run'")
print("\nAlternatively, if you have the service_role key, update this script.")
