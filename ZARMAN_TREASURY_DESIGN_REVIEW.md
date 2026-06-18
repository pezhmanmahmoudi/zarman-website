# Zarman Treasury & Accounting Design Review

**Version:** 1.0  
**Date:** 2026-06-16  
**Prepared by:** Principal Software Architect / Treasury Systems Designer  
**Scope:** Full system analysis and proposed architecture for Zarman Treasury, Accounting & Strategy Center

---

## TABLE OF CONTENTS

1. [Current Architecture](#1-current-architecture)
2. [Current Accounting Model](#2-current-accounting-model)
3. [Existing Weaknesses](#3-existing-weaknesses)
4. [Proposed Architecture](#4-proposed-architecture)
5. [Database Changes](#5-database-changes)
6. [Financial Assumptions](#6-financial-assumptions)
7. [Migration Strategy](#7-migration-strategy)
8. [Risk Assessment](#8-risk-assessment)
9. [Formula Definitions](#9-formula-definitions)
10. [Persian Financial Glossary](#10-persian-financial-glossary)

---

## 1. CURRENT ARCHITECTURE

### 1.1 Technology Stack

- **Framework:** Next.js 14+ (App Router, Server Components + Server Actions)
- **Database:** Supabase (PostgreSQL + RLS)
- **Auth:** Supabase Auth with JWT role claims (`admin`, `service_role`)
- **Security Layer:** `requireAdmin()` → role check → RLS capability test → service-role client for writes
- **Caching:** `unstable_cache` with tag-based revalidation (`rates-snapshot-v1`, `system-settings`)

### 1.2 Existing Database Tables

#### `ledger` (Primary accounting table)
```
id               uuid (PK)
transaction_id   text (FK → transactions.id, nullable for manual entries)
date_gregorian   date  "YYYY-MM-DD"
date_jalali      text  "YYYY/MM/DD" (Shamsi)
type             text  "buy_aud" | "sell_aud"
exchange_rate    numeric
amount_aud       numeric
amount_toman     numeric
sender           text
recipient        text
fee_aud          numeric (default 0)
notes            text (nullable)
created_by       uuid (FK → auth.users)
created_at       timestamptz
```

#### `transactions` (Customer-facing orders)
```
id                   uuid (PK)
user_id              uuid (FK → auth.users)
type                 text  "buy_aud" | "sell_aud"
amount_aud           numeric
equivalent_toman     numeric
status               text  "pending" | "approved" | "rejected" | "archived"
created_at           timestamptz
source_of_funds      text
reason_for_transfer  text
payment_link         text (nullable)
```

#### `rates_history` (Exchange rates + system config)
```
id                          integer (PK)
date                        date (UNIQUE — one row per day)
buy_aud                     numeric (Zarman buys AUD: Kadoos pays Toman)
sell_aud                    numeric (Zarman sells AUD: Kadoos receives Toman)
source                      text  "admin"
note                        text
market_active               boolean
pause_message               text
discount_step_volume        numeric (default 1000 AUD)
discount_percent_per_step   numeric (default 0.005)
max_discount_percent        numeric (default 0.25)
fee_threshold               numeric (default 1000 AUD)
applied_fee                 numeric (default 30 AUD)
created_at                  timestamptz
updated_at                  timestamptz (trigger-maintained)
updated_by                  uuid
```

#### `audit_logs`
```
id           uuid (PK)
actor_id     uuid
actor_email  text
action       text
target_type  text
target_id    text
old_value    jsonb
new_value    jsonb
created_at   timestamptz
```

#### `profiles`, `testimonials`, `recipients`  
Standard user management tables — not directly relevant to treasury.

### 1.3 Current Data Flow: Transaction Approval

```
Customer creates transaction
    → stored in `transactions` with status = "pending"
    
Admin reviews → calls approveTransaction(transactionId)
    → status updated to "approved"
    → snapshot inserted into `ledger`:
        - exchange_rate = amount_toman / amount_aud
        - fee_aud calculated from rates_history (applied_fee if below fee_threshold)
        - sender/recipient derived from profiles/recipients join
    → audit_log entry written via service-role
```

**Important:** The `ledger` table is a **snapshot at time of approval**. The exchange rate stored is the transaction's actual rate, not the current market rate. This is correct for accounting purposes.

### 1.4 Current P&L Calculation Location

ALL financial calculations currently live in:

```
app/(panel)/admin/(protected)/ledger/page.tsx
```

Inside the server-side `calcMetrics()` function:

```typescript
function calcMetrics(rows, currentBuyRate) {
  const buyRows  = rows.filter(r => r.type === "buy_aud");
  const sellRows = rows.filter(r => r.type === "sell_aud");

  const sumBuyAud    = buyRows.reduce(...)   // total AUD purchased
  const sumSellAud   = sellRows.reduce(...)  // total AUD sold
  const sumBuyToman  = buyRows.reduce(...)   // total IRT paid for AUD
  const sumSellToman = sellRows.reduce(...)  // total IRT received from AUD sales

  const audBalance     = sumBuyAud - sumSellAud
  const averageBuyRate = sumBuyToman / sumBuyAud     // WAC
  const tradingProfit  = sumSellToman - (sumSellAud * averageBuyRate)
  const totalFeesToman = rows.reduce(fee * rowRate)  // fees converted at each row's rate
  const bookPL         = (currentBuyRate - averageBuyRate) * audBalance
  const netToman       = tradingProfit + totalFeesToman + bookPL
  const netAud         = netToman / currentBuyRate
}
```

### 1.5 Current Account Model

The system currently recognizes TWO conceptual accounts:

| Account | Currency | Role |
|---------|----------|------|
| Kadoos | IRT | Payer for buy_aud; Receiver for sell_aud |
| Zarman | AUD | Receiver for buy_aud; Payer for sell_aud |

The "Pezhman" account is mentioned in the business but does NOT exist in the codebase.

---

## 2. CURRENT ACCOUNTING MODEL

### 2.1 Inventory Methodology: Weighted Average Cost (WAC)

The current system effectively implements **WAC (Weighted Average Cost)**:

$$\text{averageBuyRate} = \frac{\sum \text{amount\_toman (all buys)}}{\sum \text{amount\_aud (all buys)}}$$

**How WAC works here:**
- Every time AUD is purchased (buy_aud), the total IRT cost and total AUD quantity accumulat
- The average cost per AUD = total IRT cost ÷ total AUD purchased
- When AUD is sold, the profit = IRT received − (AUD sold × average cost)

**WAC Advantages:**
1. Simple to calculate and explain
2. Smooths out price volatility over time
3. Accepted accounting standard for fungible commodities
4. No need to track individual purchase lots

**WAC Disadvantages:**
1. Dilutes the cost basis when new inventory is purchased at very different prices
2. Does not reflect the actual cost of specific inventory units sold
3. Can understate or overstate profit if inventory composition changes dramatically

**Finding:** The current `averageBuyRate` calculation is mathematically valid for WAC **only if** it uses the historical total cost of all purchases ever made, divided by all AUD ever purchased. This is correct for total lifetime P&L, but may produce a misleading "current average cost" if significant old inventory at very different prices is still in the WAC pool.

**Recommendation:** Continue using WAC. It is appropriate for this business type. Document it clearly.

### 2.2 Fee Accounting

Fees are stored in AUD (`fee_aud`) per ledger row.

For total fee value in IRT, the current system converts using each row's implied rate:
```
rowRate = amount_toman / amount_aud
feeToman = fee_aud * rowRate
```

This is correct because the fee was charged at the time of that specific transaction.

### 2.3 Mark-to-Market (Book P&L)

$$\text{bookPL} = (\text{currentBuyRate} - \text{averageBuyRate}) \times \text{audBalance}$$

This represents the **unrealized gain or loss** on current AUD inventory relative to its acquisition cost, valued at the current buy rate.

- Positive: Current rate > average acquisition cost → inventory has appreciated
- Negative: Current rate < average acquisition cost → inventory has depreciated

**Issue identified:** The current formula uses `currentBuyRate` (the buy rate, i.e., what Zarman pays to acquire AUD). For mark-to-market valuation of AUD inventory that will be *sold*, the `sell_aud` rate would be more appropriate. However, since the business primarily operates at buy_aud rate and sell_aud is close to buy_aud, the difference is minor. This should be documented.

### 2.4 Net Profit Calculation

Current:
$$\text{netToman} = \text{tradingProfit} + \text{totalFeesToman} + \text{bookPL}$$

**Critical Issue:** This formula **merges realized and unrealized profit** into a single figure without separation. The system currently shows one "net" number that combines:
- Realized trading profit (from completed sales)
- Fee income (realized cash)
- Book P&L (unrealized, mark-to-market)

This is misleading. The owner needs to know these separately.

---

## 3. EXISTING WEAKNESSES

### 3.1 Financial Logic in UI Code (HIGH SEVERITY)
The entire P&L calculation lives inside `ledger/page.tsx`. This means:
- No reusability across other admin pages
- No testability in isolation
- Business logic tightly coupled to rendering
- Any future UI refactor risks breaking financial calculations

### 3.2 Realized and Unrealized Profit Are Merged (HIGH SEVERITY)
`netToman = tradingProfit + totalFeesToman + bookPL`

The current "net profit" figure mixes:
- Realized trading profit (actual cash-equivalent)
- Book P&L (hypothetical, mark-to-market only)

A business making IRT 500M in realized profit but IRT 200M book loss is NOT the same as a business with IRT 300M realized profit. The owner must see these separately to make decisions.

### 3.3 No Pezhman Account (MEDIUM SEVERITY)
The business has two IRT accounts: Kadoos and Pezhman. The current system only tracks Kadoos payments. Pezhman transactions are invisible. This means:
- Iran liquidity is partially invisible to the system
- Account-level attribution is incomplete
- Any settlement or reconciliation between Kadoos and Pezhman is impossible to track

### 3.4 No Owner Loan Tracking (HIGH SEVERITY)
When the owner injects personal capital into the business, there is no way to:
- Record this injection as a liability (loan), not revenue
- Track how much personal money has been put in
- Calculate how much the business owes back to the owner
- Distinguish "the business made money" from "the owner funded the business"

This is critical. Without it, the business cannot measure its true autonomous profitability.

### 3.5 No Expense Tracking (MEDIUM SEVERITY)
Operational expenses (rent, bank fees, software, marketing, etc.) are not tracked anywhere. This means:
- Operating profit is overstated (no expenses deducted)
- Cash flow is not visible
- Monthly cost trend is unknown

### 3.6 No Treasury Settings (MEDIUM SEVERITY)
There are no configurable thresholds for:
- Minimum/maximum AUD inventory
- Minimum IRT liquidity
- Coverage targets
Without these, no automated recommendations or health scoring is possible.

### 3.7 No Forecasting or Strategy Layer (LOW SEVERITY NOW, HIGH LATER)
The system shows historical data only. It has no capability to:
- Project inventory depletion based on current trends
- Alert when inventory is approaching minimum threshold
- Recommend buy/sell/hold based on business conditions

### 3.8 WAC Formula Scope Issue (LOW SEVERITY)
The `averageBuyRate` uses ALL historical purchases as the denominator:
```
averageBuyRate = sumBuyToman / sumBuyAud
```
If a large volume of AUD was purchased at rate X in the past, and new AUD is purchased at rate Y today, the WAC is pulled toward the historical rate. This is mathematically correct for lifetime WAC but can distort the "current" average acquisition cost.

**For this business size and scope, this is acceptable. WAC remains the right methodology.**

### 3.9 Kadoos/Zarman "Balance" Cards Are Payment Totals, Not True Balances (MEDIUM SEVERITY)
The current cards show:
- "Kadoos Payment" = sum of ALL Toman paid by Kadoos across ALL time (for buy_aud)
- "Zarman Payment" = sum of ALL Toman received by Zarman across ALL time (for sell_aud)

These are **cumulative totals, not account balances**. An account balance requires both inflows and outflows. Without tracking Kadoos' AUD receipts back to Iran, or Zarman's AUD outflows to customers, the "balance" is meaningless.

### 3.10 Fee Stored in AUD, Not IRT (COSMETIC)
Fees are stored as `fee_aud` in AUD, then converted to IRT in the calculation. This is acceptable but means fee income is rate-dependent when expressed in IRT. Should be documented.

---

## 4. PROPOSED ARCHITECTURE

### 4.1 Layered Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    UI Layer (React/Next.js)                  │
│  Section 1: Treasury & Strategy Center                      │
│  Section 2: Market & Inventory                              │
│  Section 3: Liquidity                                       │
│  Section 4: Profitability                                   │
│  Section 5: Owner Capital                                   │
│  Section 6: Ledger Table                                    │
└────────────────────────────┬────────────────────────────────┘
                             │ consumes normalized outputs only
                             │
┌────────────────────────────▼────────────────────────────────┐
│                  Business Logic Layer                        │
│                                                             │
│  lib/accounting-engine.ts  ← account balances, P&L         │
│  lib/treasury-engine.ts    ← inventory, liquidity          │
│  lib/strategy-engine.ts    ← recommendations, scoring      │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│                 Data Access Layer                            │
│                                                             │
│  app/actions/admin.actions.ts  ← existing, extended        │
│  app/actions/treasury.actions.ts  ← new treasury actions   │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│                   Supabase (PostgreSQL)                     │
│  ledger, transactions, rates_history (existing)            │
│  owner_loans, expenses, treasury_settings (new)            │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Account Model

```typescript
type Currency = "AUD" | "IRT";

type Account = 
  | "zarman"    // AUD — Australia operational account
  | "kadoos"    // IRT — Iran operational account (primary)
  | "pezhman";  // IRT — Iran operational account (secondary)

// Every ledger entry has explicit payer + receiver:
interface LedgerEntry {
  payer_account: Account;
  receiver_account: Account;
  currency: Currency;
  // ... other fields
}
```

**Default account mapping:**

| Transaction Type | Payer Account | Receiver Account | Description |
|-----------------|---------------|------------------|-------------|
| `buy_aud` | `kadoos` | `zarman` | Kadoos pays IRT → Zarman receives AUD |
| `buy_aud` | `pezhman` | `zarman` | Pezhman pays IRT → Zarman receives AUD |
| `sell_aud` | `zarman` | `kadoos` | Zarman pays AUD → Kadoos receives IRT |
| `sell_aud` | `zarman` | `pezhman` | Zarman pays AUD → Pezhman receives IRT |

### 4.3 Extended Entry Types

Current: only `buy_aud` and `sell_aud`.

New types added to ledger:

| Type | Description |
|------|-------------|
| `trade` | AUD buy/sell (replaces buy_aud/sell_aud — backward compatible via mapping) |
| `expense` | Operational expense payment |
| `owner_loan` | Owner capital injection (not revenue) |
| `adjustment` | Manual correction or balance adjustment |

**Important:** `buy_aud` and `sell_aud` are preserved as-is for backward compatibility. New entries use the `trade` type with `payer_account`/`receiver_account` being more explicit.

### 4.4 Accounting Engine (`lib/accounting-engine.ts`)

Responsibilities:
- Compute WAC (Weighted Average Cost) for current AUD inventory
- Compute realized trading profit (separated from fees and book P&L)
- Compute fee income in IRT
- Compute unrealized P&L (book value vs. current rate)
- Compute operating profit (realized + fees - expenses)
- Compute total profit
- Compute owner loan balance
- Compute working capital

Returns a normalized `AccountingSnapshot` object consumed by UI.

### 4.5 Treasury Engine (`lib/treasury-engine.ts`)

Responsibilities:
- Compute AUD inventory (current balance)
- Compute IRT liquidity per account (kadoos, pezhman)
- Compute total IRT liquidity
- Compute inventory value at current rate
- Compute inventory coverage days
- Compute inventory ratio vs. target
- Compute liquidity ratio vs. minimum
- Compute exposure ratio
- Generate `TreasurySnapshot` object

### 4.6 Strategy Engine (`lib/strategy-engine.ts`)

Responsibilities:
- Evaluate treasury snapshot against configured thresholds
- Generate prioritized recommendations (BUY_AUD / SELL_AUD / HOLD / CAUTION)
- Compute treasury health score (0–100)
- Generate forecasts based on 7/30/90-day trends
- Generate alerts for threshold violations
- All recommendations based on internal business conditions ONLY
- Never predict market rates

---

## 5. DATABASE CHANGES

### 5.1 `ledger` table — ADD columns (backward compatible)

```sql
ALTER TABLE ledger ADD COLUMN IF NOT EXISTS entry_type text 
  DEFAULT 'trade' 
  CHECK (entry_type IN ('trade', 'expense', 'owner_loan', 'adjustment'));

ALTER TABLE ledger ADD COLUMN IF NOT EXISTS payer_account text 
  DEFAULT 'kadoos'
  CHECK (payer_account IN ('zarman', 'kadoos', 'pezhman', 'external'));

ALTER TABLE ledger ADD COLUMN IF NOT EXISTS receiver_account text 
  DEFAULT 'zarman'
  CHECK (receiver_account IN ('zarman', 'kadoos', 'pezhman', 'external'));
```

**Backfill existing data:**
```sql
UPDATE ledger SET entry_type = 'trade' WHERE entry_type IS NULL;
UPDATE ledger SET payer_account = 'kadoos'  WHERE type = 'buy_aud'  AND payer_account IS NULL;
UPDATE ledger SET receiver_account = 'zarman' WHERE type = 'buy_aud' AND receiver_account IS NULL;
UPDATE ledger SET payer_account = 'zarman'  WHERE type = 'sell_aud' AND payer_account IS NULL;
UPDATE ledger SET receiver_account = 'kadoos' WHERE type = 'sell_aud' AND receiver_account IS NULL;
```

### 5.2 New table: `owner_loans`

```sql
CREATE TABLE IF NOT EXISTS owner_loans (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date              date NOT NULL,
  currency          text NOT NULL CHECK (currency IN ('AUD', 'IRT')),
  amount            numeric(20, 2) NOT NULL CHECK (amount > 0),
  account           text NOT NULL CHECK (account IN ('zarman', 'kadoos', 'pezhman')),
  loan_type         text NOT NULL DEFAULT 'injection' 
                    CHECK (loan_type IN ('injection', 'repayment')),
  repayment_status  text NOT NULL DEFAULT 'open'
                    CHECK (repayment_status IN ('open', 'partially_repaid', 'repaid')),
  notes             text,
  created_by        uuid REFERENCES auth.users(id),
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

-- RLS: only service_role can write
ALTER TABLE owner_loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_loans_admin_select" ON owner_loans
  FOR SELECT USING (auth.jwt() ->> 'role' IN ('admin', 'service_role'));
```

### 5.3 New table: `expenses`

```sql
CREATE TABLE IF NOT EXISTS expenses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date            date NOT NULL,
  title           text NOT NULL,
  category        text NOT NULL CHECK (category IN (
                    'rent', 'marketing', 'bank_fees', 'software', 
                    'salary', 'tax', 'office', 'miscellaneous'
                  )),
  currency        text NOT NULL CHECK (currency IN ('AUD', 'IRT')),
  amount          numeric(20, 2) NOT NULL CHECK (amount > 0),
  payer_account   text NOT NULL CHECK (payer_account IN ('zarman', 'kadoos', 'pezhman')),
  status          text NOT NULL DEFAULT 'paid'
                  CHECK (status IN ('pending', 'paid')),
  notes           text,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expenses_admin_select" ON expenses
  FOR SELECT USING (auth.jwt() ->> 'role' IN ('admin', 'service_role'));
```

### 5.4 New table: `treasury_settings`

```sql
CREATE TABLE IF NOT EXISTS treasury_settings (
  id                          integer PRIMARY KEY DEFAULT 1,
  min_aud_inventory           numeric(20, 2) DEFAULT 5000,
  target_aud_inventory        numeric(20, 2) DEFAULT 50000,
  max_aud_inventory           numeric(20, 2) DEFAULT 200000,
  min_irt_liquidity           numeric(20, 0) DEFAULT 5000000000,
  max_aud_exposure            numeric(5, 2) DEFAULT 0.80,
  inventory_coverage_days     integer DEFAULT 14,
  recommendation_sensitivity  text DEFAULT 'medium'
                              CHECK (recommendation_sensitivity IN ('low', 'medium', 'high')),
  updated_by                  uuid REFERENCES auth.users(id),
  updated_at                  timestamptz DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- Insert default row
INSERT INTO treasury_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE treasury_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "treasury_settings_admin_select" ON treasury_settings
  FOR SELECT USING (auth.jwt() ->> 'role' IN ('admin', 'service_role'));
```

### 5.5 Migration Files Required

```
supabase/migrations/
  20260616_01_ledger_add_accounts.sql     ← ADD payer/receiver/entry_type to ledger
  20260616_02_owner_loans.sql             ← CREATE owner_loans table
  20260616_03_expenses.sql               ← CREATE expenses table
  20260616_04_treasury_settings.sql      ← CREATE treasury_settings table
```

---

## 6. FINANCIAL ASSUMPTIONS

### 6.1 Currency Convention
- **AUD** = Australian Dollar (ISO 4217: AUD)
- **IRT** = Iranian Toman (informal; 1 Toman = 10 Rials)
- All exchange rates expressed as IRT per AUD (e.g., rate = 50,000 means 50,000 Toman per 1 AUD)

### 6.2 Business Direction Convention
```
buy_aud:
  - Zarman perspective: purchasing AUD inventory
  - Cash flow: IRT leaves kadoos/pezhman → AUD enters zarman

sell_aud:
  - Zarman perspective: selling AUD inventory to customers
  - Cash flow: AUD leaves zarman → IRT enters kadoos/pezhman
```

### 6.3 Inventory Methodology: Weighted Average Cost (WAC)
All inventory accounting uses WAC.

**Reasoning:**
- AUD is fungible (interchangeable units)
- Volume is small-medium, no need for FIFO lot tracking
- WAC is simpler, defensible, and industry-standard for currency dealers
- No tax authority requires FIFO for currency exchange in Australia (at this scale)

**WAC Formula:**
$$\text{WAC} = \frac{\sum_{i} (\text{amount\_toman}_i)}{\sum_{i} (\text{amount\_aud}_i)} \quad \text{for all buy\_aud entries}$$

### 6.4 Fee Treatment
- Fees are earned income, separate from trading profit
- Fee currency: stored in AUD, expressed in IRT at the transaction's implied rate
- Fees are part of **operating income**, not trading profit

### 6.5 Owner Loan Treatment
- Owner capital injections are **liabilities**, not equity or revenue
- They do NOT affect profit calculations
- They are tracked separately in `owner_loans` table
- `repayment_status` tracks whether the business has returned the capital
- Total outstanding owner balance = sum of injections − sum of repayments

### 6.6 Expense Treatment
- Paid expenses reduce **operating profit**
- Pending expenses are shown separately (not yet deducted from operating profit)
- Expenses in AUD are left in AUD for operating profit calculations
- Expenses in IRT can be converted at the prevailing rate for comparison

### 6.7 Mark-to-Market Rate
- The **buy_aud** rate from `rates_history` (most recent date) is used for mark-to-market
- Rationale: The business acquires AUD at the buy rate, so the current buy rate represents the replacement cost of inventory
- Alternative (sell rate) would represent realization value — both are valid; buy rate is more conservative

---

## 7. MIGRATION STRATEGY

### 7.1 Guiding Principles
1. **Never drop or rename existing columns** — only ADD new columns
2. **Backfill defaults** for all new columns on existing rows
3. **Preserve existing P&L calculations** during transition period
4. **Deploy database changes first**, then code changes
5. **Test on staging before production**

### 7.2 Phase 1 — Database Migrations (No breaking changes)

**Step 1:** Run `20260616_01_ledger_add_accounts.sql`
- Adds `entry_type`, `payer_account`, `receiver_account` to `ledger`
- Backfills existing rows with correct defaults
- All existing queries continue working (new columns have defaults)

**Step 2:** Run `20260616_02_owner_loans.sql`
- Creates `owner_loans` table (new, no impact on existing code)

**Step 3:** Run `20260616_03_expenses.sql`
- Creates `expenses` table (new, no impact on existing code)

**Step 4:** Run `20260616_04_treasury_settings.sql`
- Creates `treasury_settings` with defaults (new, no impact on existing code)

### 7.3 Phase 2 — Business Logic Layer (No UI changes yet)

**Step 5:** Create `lib/accounting-engine.ts`
- Implement `calcAccountingSnapshot(ledgerRows, expenses, ownerLoans, currentBuyRate)`
- Unit-testable pure functions
- Uses same WAC formula as current system (validated for correctness)

**Step 6:** Create `lib/treasury-engine.ts`
- Implement `calcTreasurySnapshot(accountingSnapshot, settings, rateHistory)`

**Step 7:** Create `lib/strategy-engine.ts`
- Implement `generateRecommendation(treasurySnapshot, settings)`

### 7.4 Phase 3 — Server Actions (Parallel to existing)

**Step 8:** Extend `admin.actions.ts` with:
- `getLedgerDataFull()` — returns all data needed for treasury (ledger + expenses + loans + settings)
- `addOwnerLoan()`
- `updateOwnerLoan()`
- `addExpense()`
- `updateExpense()`
- `getTreasurySettings()`
- `updateTreasurySettings()`

### 7.5 Phase 4 — New Treasury Dashboard UI

**Step 9:** Create new page: `app/(panel)/admin/(protected)/treasury/page.tsx`
- Uses the three engines
- Replaces current ledger page's metric cards
- Adds all 6 sections as described in the specification

**Step 10:** Upgrade `app/(panel)/admin/(protected)/ledger/page.tsx`
- Remove `calcMetrics()` from the page (migrate to accounting-engine)
- Add payer/receiver columns to the table
- Add entry type tabs

### 7.6 Rollback Plan
- All database changes are additive (ADD COLUMN, CREATE TABLE)
- New code coexists with old code until explicitly removed
- Old `calcMetrics()` function can be kept as a fallback during transition
- Feature flag via treasury_settings: if table is empty, fall back to old calculations

---

## 8. RISK ASSESSMENT

### 8.1 Data Integrity Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Existing ledger rows missing payer_account | LOW | Backfill script sets correct defaults (buy→kadoos, sell→zarman) |
| WAC calculation diverges after migration | LOW | New engine uses same formula, validated against current output |
| owner_loans accidentally counted as profit | MEDIUM | Engine explicitly excludes owner_loans from all profit calculations |
| Concurrent admin edits to ledger row | LOW | Existing optimistic-lock pattern (refresh on save) adequate |
| Migration fails partway through | MEDIUM | Idempotent SQL (IF NOT EXISTS, ON CONFLICT DO NOTHING) |

### 8.2 Calculation Correctness Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Realized profit formula error | HIGH | Validate against current calcMetrics() for identical output on same data |
| Mark-to-market uses wrong rate (buy vs sell) | LOW | Documented assumption: use buy_aud rate |
| WAC inflated by historical large purchases | LOW | Documented WAC limitation; monitor via average cost card |
| Expense double-counting | MEDIUM | Expenses only deducted once from operating profit; status filter |
| Treasury health score gaming | LOW | Score is internal-only, not customer-facing |

### 8.3 Security Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| New tables without RLS | HIGH | All new tables have RLS enabled in migration |
| Owner loan amounts exposed to non-admin | HIGH | RLS policy restricts to admin/service_role only |
| Treasury settings modifiable by non-admin | MEDIUM | requireAdmin() check on all write actions |
| Strategy engine reading stale cache data | LOW | Tag-based cache invalidation when settings change |

### 8.4 Operational Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Business owner misinterprets forecasts | MEDIUM | All forecasts labeled as estimates; "approximately" wording required |
| Strategy recommendation incorrect due to missing data | MEDIUM | Fallback to CAUTION if critical data is missing |
| Pezhman balance manually entered incorrectly | LOW | Audit logging tracks all manual entries |
| Owner loans not entered (invisible capital) | MEDIUM | UI prominently displays "Outstanding Owner Balance" |

---

## 9. FORMULA DEFINITIONS

All formulas use plain variables matching the database schema.

### 9.1 AUD Inventory

$$\text{AUD Inventory} = \sum_{\text{buy\_aud}} \text{amount\_aud} - \sum_{\text{sell\_aud}} \text{amount\_aud}$$

**Persian:** موجودی دلار = مجموع دلار خریداری‌شده منهای مجموع دلار فروخته‌شده

### 9.2 Weighted Average Cost (WAC)

$$\text{WAC} = \frac{\sum_{\text{buy\_aud}} \text{amount\_toman}}{\sum_{\text{buy\_aud}} \text{amount\_aud}}$$

**Persian:** میانگین هزینه وزنی = مجموع تومان پرداختی برای خرید تقسیم بر مجموع دلار خریداری‌شده

### 9.3 Realized Trading Profit

$$\text{Realized Trading Profit} = \sum_{\text{sell\_aud}} \text{amount\_toman} - \left(\sum_{\text{sell\_aud}} \text{amount\_aud} \times \text{WAC}\right)$$

**Persian:** سود تحقق‌یافته معاملات = تومان دریافتی از فروش منهای هزینه اکتساب همان مقدار دلار

### 9.4 Fee Income (IRT)

$$\text{Fee Income (IRT)} = \sum_{\text{all rows}} \left(\text{fee\_aud}_i \times \frac{\text{amount\_toman}_i}{\text{amount\_aud}_i}\right)$$

**Persian:** درآمد کارمزد = مجموع کارمزدها تبدیل‌شده به تومان با نرخ همان تراکنش

### 9.5 Unrealized Profit/Loss (Book P&L)

$$\text{Unrealized P/L} = (\text{currentBuyRate} - \text{WAC}) \times \text{AUD Inventory}$$

**Persian:** سود/زیان دفتری = اختلاف نرخ روز با میانگین هزینه ضربدر موجودی دلار

### 9.6 Operating Profit

$$\text{Operating Profit} = \text{Realized Trading Profit} + \text{Fee Income (IRT)} - \text{Paid Expenses (IRT equivalent)}$$

**Persian:** سود عملیاتی = سود تحقق‌یافته + کارمزد - هزینه‌های پرداخت‌شده

### 9.7 Total Profit (including unrealized)

$$\text{Total Profit} = \text{Operating Profit} + \text{Unrealized P/L}$$

**Note:** Operating Profit and Total Profit are displayed **separately**. They are never merged in the UI.

### 9.8 Owner Capital

$$\text{Outstanding Owner Balance} = \sum_{\text{injection}} \text{amount} - \sum_{\text{repayment}} \text{amount}$$

**Persian:** بدهی به مالک = مجموع تزریق سرمایه منهای مجموع بازپرداخت‌ها

**Critical:** Owner capital NEVER enters any profit formula.

### 9.9 Working Capital

$$\text{Working Capital (AUD)} = \text{AUD Inventory Value (IRT)} + \text{Total IRT Liquidity} - \text{Outstanding Owner Balance (IRT equivalent)}$$

**Persian:** سرمایه در گردش = ارزش موجودی دلار + نقدینگی تومان - بدهی به مالک

### 9.10 Inventory Value

$$\text{Inventory Value (IRT)} = \text{AUD Inventory} \times \text{currentBuyRate}$$

**Persian:** ارزش موجودی = موجودی دلار ضربدر نرخ خرید روز

### 9.11 Inventory Ratio

$$\text{Inventory Ratio} = \frac{\text{AUD Inventory}}{\text{Target AUD Inventory}}$$

- ≥ 1.0 → Target met or exceeded
- 0.5–1.0 → Below target, monitor
- < 0.5 → Critical, consider purchasing

### 9.12 Liquidity Ratio

$$\text{Liquidity Ratio} = \frac{\text{Total IRT Liquidity}}{\text{Minimum IRT Liquidity}}$$

- ≥ 1.0 → Adequate liquidity
- < 1.0 → Liquidity stress

### 9.13 Exposure Ratio

$$\text{Exposure Ratio} = \frac{\text{Inventory Value (IRT)}}{\text{Inventory Value (IRT)} + \text{Total IRT Liquidity}}$$

- High exposure ratio → most assets are in AUD (currency risk)
- Low exposure ratio → most assets are in IRT (inflation risk)

### 9.14 Inventory Coverage Days

$$\text{Coverage Days} = \frac{\text{AUD Inventory}}{\text{Average Daily AUD Outflow (30-day)}}$$

**Persian:** روزهای پوشش موجودی = موجودی دلار تقسیم بر میانگین خروج روزانه دلار

### 9.15 Treasury Health Score (0–100)

$$\text{Health Score} = w_1 \cdot S_{\text{inventory}} + w_2 \cdot S_{\text{liquidity}} + w_3 \cdot S_{\text{exposure}} + w_4 \cdot S_{\text{profitability}} + w_5 \cdot S_{\text{forecast}}$$

Where:
- $w_1 = 0.30$, $w_2 = 0.25$, $w_3 = 0.20$, $w_4 = 0.15$, $w_5 = 0.10$
- Each $S_x \in [0, 100]$ represents a normalized component score

**Component calculations:**

$$S_{\text{inventory}} = \min\left(100, \frac{\text{AUD Inventory}}{\text{Target AUD Inventory}} \times 100\right)$$

$$S_{\text{liquidity}} = \min\left(100, \frac{\text{Total IRT Liquidity}}{\text{Min IRT Liquidity}} \times 100\right)$$

$$S_{\text{exposure}} = 100 - \left|\text{Exposure Ratio} - 0.5\right| \times 200 \quad \text{(100 at 50/50 balance)}$$

$$S_{\text{profitability}} = \begin{cases} 100 & \text{if Operating Profit} > 0 \\ 50 & \text{if Realized Trading Profit} > 0 \\ 0 & \text{otherwise} \end{cases}$$

$$S_{\text{forecast}} = \begin{cases} 100 & \text{Coverage Days} \geq \text{Target Coverage} \\ \frac{\text{Coverage Days}}{\text{Target Coverage}} \times 100 & \text{otherwise} \end{cases}$$

**Health Score Categories:**
- 80–100 → Excellent (سبز)
- 60–79 → Good (زرد روشن)
- 40–59 → Caution (نارنجی)
- 0–39 → Critical (قرمز)

---

## 10. PERSIAN FINANCIAL GLOSSARY

Every KPI displayed in the dashboard must use these canonical Persian terms:

| English Term | Persian Term | Notes |
|---|---|---|
| AUD Inventory | موجودی دلار | Current AUD held |
| Inventory Value | ارزش موجودی | AUD × current rate |
| Weighted Average Cost | میانگین هزینه وزنی | WAC per AUD |
| Realized Trading Profit | سود تحقق‌یافته معاملات | From completed sales |
| Unrealized Profit/Loss | سود/زیان دفتری | Mark-to-market |
| Fee Income | درآمد کارمزد | Earned transaction fees |
| Operating Profit | سود عملیاتی | After fees, before unrealized |
| Total Profit | سود کل | Operating + unrealized |
| Owner Loan | وام مالک | Not counted as revenue |
| Outstanding Owner Balance | بدهی به مالک | What business owes owner |
| Working Capital | سرمایه در گردش | Liquid + inventory − owner debt |
| Treasury Value | ارزش خزانه | Total asset value |
| Kadoos Balance | موجودی کادوس | IRT in Kadoos account |
| Pezhman Balance | موجودی پژمان | IRT in Pezhman account |
| Iran Liquidity | نقدینگی ایران | Kadoos + Pezhman |
| Inventory Ratio | نسبت موجودی | Current ÷ target |
| Liquidity Ratio | نسبت نقدینگی | Current ÷ minimum |
| Exposure Ratio | نسبت ریسک | AUD value ÷ total assets |
| Coverage Days | روزهای پوشش | Inventory ÷ daily outflow |
| Health Score | امتیاز سلامت خزانه | 0–100 composite score |
| BUY_AUD | خرید دلار توصیه می‌شود | Strategy recommendation |
| SELL_AUD | فروش دلار توصیه می‌شود | Strategy recommendation |
| HOLD | نگهداری | No action recommended |
| CAUTION | احتیاط | Monitor closely |

---

## VALIDATION CHECKLIST

Before implementation begins, confirm:

- [ ] WAC formula produces identical output to current `calcMetrics()` on same data
- [ ] Owner loan amounts DO NOT appear in any profit formula
- [ ] Expense amounts reduce operating profit (paid expenses only)
- [ ] Pezhman balance tracked separately from Kadoos
- [ ] Realized and unrealized profit are NEVER merged
- [ ] Strategy engine never references external market conditions (internal data only)
- [ ] All new DB tables have RLS enabled
- [ ] All new DB migrations are idempotent
- [ ] Audit log entries created for all write operations on new tables
- [ ] Treasury health score formula documented with weights
- [ ] Every dashboard metric has Persian title, description, formula, and data source

---

## IMPLEMENTATION APPROVAL

This design review must be reviewed against actual data from the `ledger` table before implementation proceeds.

**Specifically confirm:**
1. Current `audBalance` from `calcMetrics()` matches `SUM(buy_aud) - SUM(sell_aud)` in SQL
2. Current `averageBuyRate` matches `SUM(amount_toman WHERE type=buy_aud) / SUM(amount_aud WHERE type=buy_aud)`
3. Confirm whether any "Pezhman" entries exist as manual ledger entries with `sender/recipient = "pezhman"` that need reclassification

Once confirmed: **proceed to implementation**.

---

*Document version 1.0 — Zarman Treasury & Accounting Design Review*  
*This document is the internal technical reference for the Zarman Treasury System implementation.*
