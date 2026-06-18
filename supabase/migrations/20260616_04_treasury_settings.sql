-- ============================================================
-- Migration 04: Create treasury_settings table
-- Purpose:
--   Single configurable row that defines business thresholds
--   used by the Treasury Engine and Strategy Engine.
--
-- Design decisions (documented from design review):
--
--   1. Exactly ONE row enforced via CHECK (id = 1).
--      INSERT OR IGNORE at the bottom creates defaults.
--
--   2. Health score WEIGHTS are fixed in code (not here).
--      Settings control THRESHOLDS — what "healthy" means.
--      This preserves score integrity across time periods.
--
--   3. recommendation_sensitivity controls alert aggression,
--      not the health score formula itself.
--
--   4. Inventory scoring uses a BELL CURVE approach:
--      Score is highest near target_aud_inventory.
--      Both shortages AND surpluses reduce the score.
--      max_aud_inventory is the upper bound for penalty onset.
--
--   5. cash_runway_target_months: target months of expenses
--      that should be covered by available IRT liquidity.
--      Cash Runway = Available IRT Liquidity / Avg Monthly IRT Expenses
-- ============================================================

CREATE TABLE IF NOT EXISTS treasury_settings (
  id                            integer     PRIMARY KEY DEFAULT 1,

  -- ── AUD Inventory Thresholds ──────────────────────────────────────────
  --   min:    below this triggers BUY_AUD recommendation
  --   target: optimal operating level (highest health score here)
  --   max:    above this triggers SELL_AUD recommendation
  min_aud_inventory             numeric(20, 2) NOT NULL DEFAULT 5000,
  target_aud_inventory          numeric(20, 2) NOT NULL DEFAULT 30000,
  max_aud_inventory             numeric(20, 2) NOT NULL DEFAULT 150000,

  -- ── IRT Liquidity Threshold ───────────────────────────────────────────
  --   Below this level → liquidity alert → may block buy_aud
  min_irt_liquidity             numeric(20, 0) NOT NULL DEFAULT 4000000000,

  -- ── Exposure Limit ────────────────────────────────────────────────────
  --   Maximum fraction of total assets that should be held in AUD.
  --   Above this → SELL_AUD signal regardless of inventory levels.
  --   0.80 = 80% of total assets in AUD is the warning threshold.
  max_aud_exposure              numeric(5, 4) NOT NULL DEFAULT 0.8000
                                CHECK (max_aud_exposure > 0 AND max_aud_exposure <= 1),

  -- ── Inventory Coverage Target ─────────────────────────────────────────
  --   How many days of sales the current AUD inventory should cover.
  --   Used in: Coverage Days = Inventory / Avg Daily AUD Outflow
  inventory_coverage_target_days integer NOT NULL DEFAULT 14
                                CHECK (inventory_coverage_target_days > 0),

  -- ── Cash Runway Target ────────────────────────────────────────────────
  --   How many months of expenses the IRT liquidity should cover.
  --   Cash Runway = Available IRT Liquidity / Avg Monthly IRT Expenses
  --   Displayed as: "موجودی X ماه هزینه را پوشش می‌دهد"
  cash_runway_target_months     integer NOT NULL DEFAULT 3
                                CHECK (cash_runway_target_months > 0),

  -- ── Strategy Sensitivity ─────────────────────────────────────────────
  --   Controls how quickly the strategy engine escalates recommendations.
  --   low:    only alert on hard threshold breaches
  --   medium: alert when approaching thresholds (±15%)
  --   high:   alert on any trend deviation (±5%)
  recommendation_sensitivity    text NOT NULL DEFAULT 'medium'
                                CHECK (recommendation_sensitivity IN ('low', 'medium', 'high')),

  -- ── Metadata ──────────────────────────────────────────────────────────
  updated_by                    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at                    timestamptz NOT NULL DEFAULT now(),

  -- Enforce exactly one configuration row
  CONSTRAINT treasury_settings_single_row CHECK (id = 1)
);

-- ── Auto-update updated_at ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_treasury_settings_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_treasury_settings_updated_at ON treasury_settings;
CREATE TRIGGER trg_treasury_settings_updated_at
  BEFORE UPDATE ON treasury_settings
  FOR EACH ROW EXECUTE FUNCTION fn_treasury_settings_set_updated_at();

-- ── Seed default row ──────────────────────────────────────────────────────
--   Idempotent: does nothing if the row already exists.
INSERT INTO treasury_settings (id)
  VALUES (1)
  ON CONFLICT (id) DO NOTHING;

-- ── Row Level Security ────────────────────────────────────────────────────
ALTER TABLE treasury_settings ENABLE ROW LEVEL SECURITY;

-- Admin and service_role can read settings
CREATE POLICY "treasury_settings_admin_select"
  ON treasury_settings FOR SELECT
  USING (
    (auth.jwt() ->> 'role') IN ('admin', 'service_role')
    OR auth.role() = 'service_role'
  );

-- Only service_role can write (all writes go through requireAdmin() server actions)
CREATE POLICY "treasury_settings_service_update"
  ON treasury_settings FOR UPDATE
  USING (auth.role() = 'service_role');

-- INSERT is blocked for all roles (the seed row above is the only insert ever needed)
-- No INSERT policy means INSERT is denied to all except service_role implicit bypass.
-- The seed INSERT above runs during migration with superuser privileges.
