ALTER TABLE contract_templates
  ADD COLUMN IF NOT EXISTS sections jsonb,
  ADD COLUMN IF NOT EXISTS trade_type text;

ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS sections jsonb;
