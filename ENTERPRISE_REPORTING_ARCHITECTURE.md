# Enterprise Reporting Module Architecture

## Constraints

- `ledger` remains the immutable financial source of truth.
- Existing accounting, treasury, transaction, and admin APIs are unchanged.
- Reporting is a read model. It never posts, edits, or corrects financial entries.
- Existing `requireAdmin()` authorization protects every reporting query and refresh.
- Service-role credentials remain server-only.

## Ownership boundaries

```text
Ledger and supporting journals
        |
        v
PostgreSQL aggregate refresh
        |
        +-- reports_daily
        +-- reports_monthly
        +-- reports_yearly
        +-- report_account_daily
        +-- report_customer_daily
        |
        v
Reporting repository (validated, bounded queries)
        |
        v
Pure Report Engine (period comparison and presentation models)
        |
        v
Admin Server Component -> lazy client charts / CSV export / linked drilldowns
```

Existing accounting behavior and APIs remain unchanged. The database refresh follows the same ordered-ledger WAC and realized-profit contract to persist reporting facts; report UI code contains no accounting formulas.

## Database migration

1. Create `reports_daily` as the canonical aggregate read model, including income, expense, cash-flow, inventory, rate, volume, and transaction facts.
2. Create `reports_monthly` and `reports_yearly` rollups for long-range queries.
3. Create `report_account_daily` for bank-account statements and treasury movement analysis.
4. Create `report_customer_daily` for customer cohorts, retention, and top-customer analysis without scanning transactions.
5. Add period, account, and customer composite indexes for bounded range queries.
6. Enable RLS and grant reads only to authenticated administrators; refresh functions remain server-only.
7. Add an idempotent refresh function and refresh-state table so financial writes mark reports stale and a scheduled/admin refresh rebuilds the read model transactionally.
8. Backfill existing ledger history once during deployment, then refresh incrementally.

## Query and performance model

- Dashboard queries are bounded to validated ISO date ranges with a maximum span.
- This month, last month, quarter, year, and custom ranges all resolve server-side.
- Current and previous periods are queried together for KPI trends.
- Daily rows power short-range charts; monthly/yearly rows power long ranges.
- Account statements use keyset-compatible indexed ordering and pagination.
- Aggregate freshness is persisted in PostgreSQL; a successful refresh revalidates the reports route.
- Charts are dynamically imported and receive compact serializable datasets only.

## Drilldown contract

Every KPI and table metric carries a drilldown URL:

`report metric -> /admin/ledger?start=...&end=...&type=... -> transaction -> user -> KYC -> audit log`

Existing destination pages remain authoritative. The reporting module only composes links and filters.

## Failure behavior

- Missing aggregate data produces an explicit “report refresh required” state, never invented zero balances.
- A failed refresh does not alter ledger data and leaves the last successful snapshot available.
- Aggregate freshness and last refresh timestamp are visible in the report header.
