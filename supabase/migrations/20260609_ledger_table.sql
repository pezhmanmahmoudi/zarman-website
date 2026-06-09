-- ============================================================
-- Ledger table: financial snapshot of every approved transaction
-- Auto-populated on transaction approval; fully editable by admin
-- ============================================================

CREATE TABLE IF NOT EXISTS ledger (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id   uuid        REFERENCES transactions(id) ON DELETE SET NULL,

  date_gregorian   date        NOT NULL DEFAULT CURRENT_DATE,
  date_jalali      text        NOT NULL DEFAULT '', -- stored as "YYYY/MM/DD"

  type             text        NOT NULL CHECK (type IN ('buy_aud', 'sell_aud')),
  exchange_rate    numeric(20,4) NOT NULL DEFAULT 0,
  amount_aud       numeric(20,4) NOT NULL DEFAULT 0,
  amount_toman     numeric(20,0) NOT NULL DEFAULT 0,

  sender           text        NOT NULL DEFAULT '',
  recipient        text        NOT NULL DEFAULT '',
  fee_aud          numeric(20,4) NOT NULL DEFAULT 0,

  notes            text,
  created_by       uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS ledger_date_gregorian_idx  ON ledger(date_gregorian DESC);
CREATE INDEX IF NOT EXISTS ledger_transaction_id_idx  ON ledger(transaction_id);
CREATE INDEX IF NOT EXISTS ledger_type_idx            ON ledger(type);

-- Auto-update updated_at on every write
CREATE OR REPLACE FUNCTION set_ledger_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ledger_updated_at ON ledger;
CREATE TRIGGER trg_ledger_updated_at
  BEFORE UPDATE ON ledger
  FOR EACH ROW EXECUTE FUNCTION set_ledger_updated_at();
