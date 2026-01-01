-- Add phase column to task_completions table
ALTER TABLE task_completions ADD COLUMN IF NOT EXISTS phase VARCHAR(50);

-- Create index for faster phase filtering
CREATE INDEX IF NOT EXISTS idx_task_completions_phase ON task_completions(phase);
