-- Migration: Add AUSTRAC-required fields to transactions table
-- source_of_funds: mandatory for AML/CTF compliance reporting
-- reason_for_transfer: mandatory for AML/CTF compliance reporting

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS source_of_funds TEXT,
  ADD COLUMN IF NOT EXISTS reason_for_transfer TEXT;
