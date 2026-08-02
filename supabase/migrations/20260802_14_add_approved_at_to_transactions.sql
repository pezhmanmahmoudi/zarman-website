-- Track when a transaction was approved so AUSTRAC reports use the approval date.
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;
