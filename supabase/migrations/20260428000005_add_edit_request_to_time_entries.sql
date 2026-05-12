ALTER TABLE time_entries
  ADD COLUMN IF NOT EXISTS edit_request text,
  ADD COLUMN IF NOT EXISTS edited_clock_in timestamptz,
  ADD COLUMN IF NOT EXISTS edited_clock_out timestamptz;
