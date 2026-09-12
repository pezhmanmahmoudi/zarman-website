# Editable monthly bank transfer fees

Treasury now has a **کارمزد انتقال‌های بانکی** panel below bank account management.
Choose a Gregorian month, select the accounts to change, enter the actual fee
total and optional statement reference, then post the selected accounts.

The previous UTC month is selected initially. Accounts are never selected
automatically. A posted total is editable in the same panel. Enter the revised
**total**, rather than the difference; the existing expense is updated. Zero
settles the review without an expense, or reverses an existing managed expense.
Fees already entered separately in Operating Expenses are displayed separately
and must not be entered again here.

## Activate

1. Apply `supabase/migrations/20260910_17_editable_bank_fees.sql` in the existing
   Supabase project's SQL editor, or through the project's migration process.
   The previous bank-transfer-fee accrual migration is a prerequisite.
2. Run/deploy the updated Next.js application and reload Treasury.
3. Review the accounts and actual statement amounts before pressing the posting
   button. Installing the migration does **not** post fees or change balances.

The migration is transactional and rerunnable. It adds an empty monthly-posting
table, review/posting functions, permissions and an expense edit guard. Existing
legacy posted accruals without monthly metadata are blocked for reconciliation;
they are not automatically adopted or charged again.

Until the migration is installed, the panel displays a setup message and cannot
post. This implementation session did not apply the migration to production or
post any real fees.

## Posting behavior

- One posting per paying account and month; at most one linked paid expense.
- Only selected toman accounts are posted. Historical actual fees can be entered
  even if no fee estimates were captured for that month.
- Estimated fees remain unchanged for audit. Actual totals are stored separately.
- Versions and pending-row fingerprints reject reviews changed by another edit
  or newly captured fee. All selected accounts post in one transaction.
- New fees arriving after a posting remain pending until reviewed; they never
  silently increase a previously entered actual total.
- Posting updates the expense, captured accruals, audit log and enterprise reports
  together. An error rolls back the whole batch.
- Editing an existing posted expense preserves its original date. New past-month
  expenses use month-end; a current-month expense uses today's UTC date.
- Linked fee expenses point back to this panel from Operating Expenses. Direct
  edits/deletes are blocked to keep the monthly review and cash deduction aligned.
- Browser roles cannot access the fee tables/RPCs directly. Server actions require
  an administrator, and the posting RPC verifies the audit actor again.

The old append-only posting function is disabled; callers must submit a reviewed
account/month total through the new panel.

## Verification

`npm run test:bank-fees` runs the actual SQL migrations in isolated PostgreSQL
using PGlite. No production credentials, data or network connection are used.
The tests cover edited totals, retries, stale reviews, rollback, late accruals,
zero amounts, permissions, expense guards and report refresh.

PGlite serializes a single connection, so the suite uses a deterministic trigger
to exercise late arrivals; it does not prove behavior under multiple concurrent
database connections. Posting rows are locked in a consistent order before
expense mutations to reduce overlapping-batch deadlocks.
