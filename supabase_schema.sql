-- Supabase Schema for Train Task Tracker
-- Run this in the Supabase SQL Editor

-- Teams table
CREATE TABLE teams (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    color VARCHAR(7) DEFAULT '#3B82F6', -- Hex color for visual identification
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Car types table (DM 3 CAR, Trailer 3 Car, UNDM 3 CAR, etc.)
CREATE TABLE car_types (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(50), -- '3 CAR' or '4 CAR'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Task templates - master list of tasks for each car type
CREATE TABLE task_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    car_type_id UUID REFERENCES car_types(id) ON DELETE CASCADE,
    task_name VARCHAR(255) NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Train units (e.g., 96084, 96094, 96021)
CREATE TABLE train_units (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    unit_number VARCHAR(50) NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cars - specific cars within a unit
CREATE TABLE cars (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    unit_id UUID REFERENCES train_units(id) ON DELETE CASCADE,
    car_type_id UUID REFERENCES car_types(id),
    car_number VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(unit_id, car_number)
);

-- Task completions - tracking who completed what
CREATE TABLE task_completions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    car_id UUID REFERENCES cars(id) ON DELETE CASCADE,
    task_template_id UUID REFERENCES task_templates(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
    completed_by TEXT[], -- Array of initials
    completed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(car_id, task_template_id)
);

-- Create indexes for better query performance
CREATE INDEX idx_task_completions_car_id ON task_completions(car_id);
CREATE INDEX idx_task_completions_team_id ON task_completions(team_id);
CREATE INDEX idx_task_completions_status ON task_completions(status);
CREATE INDEX idx_cars_unit_id ON cars(unit_id);
CREATE INDEX idx_task_templates_car_type_id ON task_templates(car_type_id);

-- Enable Row Level Security (optional, can be configured based on auth needs)
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE car_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE train_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE cars ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_completions ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (adjust based on your auth requirements)
CREATE POLICY "Allow public read on teams" ON teams FOR SELECT USING (true);
CREATE POLICY "Allow public insert on teams" ON teams FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on teams" ON teams FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on teams" ON teams FOR DELETE USING (true);

CREATE POLICY "Allow public read on car_types" ON car_types FOR SELECT USING (true);
CREATE POLICY "Allow public insert on car_types" ON car_types FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on car_types" ON car_types FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on car_types" ON car_types FOR DELETE USING (true);

CREATE POLICY "Allow public read on task_templates" ON task_templates FOR SELECT USING (true);
CREATE POLICY "Allow public insert on task_templates" ON task_templates FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on task_templates" ON task_templates FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on task_templates" ON task_templates FOR DELETE USING (true);

CREATE POLICY "Allow public read on train_units" ON train_units FOR SELECT USING (true);
CREATE POLICY "Allow public insert on train_units" ON train_units FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on train_units" ON train_units FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on train_units" ON train_units FOR DELETE USING (true);

CREATE POLICY "Allow public read on cars" ON cars FOR SELECT USING (true);
CREATE POLICY "Allow public insert on cars" ON cars FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on cars" ON cars FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on cars" ON cars FOR DELETE USING (true);

CREATE POLICY "Allow public read on task_completions" ON task_completions FOR SELECT USING (true);
CREATE POLICY "Allow public insert on task_completions" ON task_completions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on task_completions" ON task_completions FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on task_completions" ON task_completions FOR DELETE USING (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for task_completions
CREATE TRIGGER update_task_completions_updated_at
    BEFORE UPDATE ON task_completions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default car types
INSERT INTO car_types (name, category) VALUES
    ('DM 3 CAR', '3 CAR'),
    ('Trailer 3 Car', '3 CAR'),
    ('UNDM 3 CAR', '3 CAR'),
    ('DM 4 Car', '4 CAR'),
    ('Trailer 4 Car', '4 CAR'),
    ('Special Trailer 4 Car', '4 CAR'),
    ('UNDM 4 Car', '4 CAR');

-- Insert default teams (can be modified as needed)
INSERT INTO teams (name, color) VALUES
    ('Team A', '#3B82F6'),
    ('Team B', '#10B981'),
    ('Team C', '#F59E0B'),
    ('Team D', '#EF4444'),
    ('Night Shift', '#8B5CF6');
