-- Add total_minutes column to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS total_minutes INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS num_people INTEGER DEFAULT 1;

-- Add total_minutes column to task_completions table
ALTER TABLE task_completions ADD COLUMN IF NOT EXISTS total_minutes INTEGER DEFAULT 0;
ALTER TABLE task_completions ADD COLUMN IF NOT EXISTS num_people INTEGER DEFAULT 1;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_task_completions_total_minutes ON task_completions(total_minutes);
