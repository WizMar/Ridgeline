ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS hourly_rate numeric DEFAULT 0;
