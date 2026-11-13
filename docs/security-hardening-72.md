# Security hardening 72 — deployment runbook

Migration: `supabase/migrations/20261113_72_security_rls_hardening.APPLY_MANUALLY.sql`
Rollback: `supabase/rollbacks/20261113_72_security_rls_hardening.ROLLBACK.sql`
Apply + verify: `scripts/Apply-SecurityMigration72.ps1` (rollback: `-Rollback`; read-only check: `-VerifyOnly`)
Verification (read-only, runs on production as anon / customer / admin / service role): `scripts/verify-security-72.sql`
Tests: `npm run test:security` (69 tests, isolated PGlite replica of production — no network)

## What changes

| Area | Before | After |
|---|---|---|
| `profiles` read | Anyone with the public key could read all profiles (`USING (true)`) | Own row; admins (JWT `app_metadata.role = 'admin'`) read all |
| `profiles` write | Customers could update any column of their own row | No direct writes from API roles. Edits go through the existing server actions (field allow-lists, KYC lock, audit) |
| `transactions` insert/delete | Anyone could insert any transaction (`WITH CHECK (true)`); customers could delete their own approved ones | No direct writes from API roles. Requests go through `submit_exchange_request`; admin writes go through `requireAdmin()` + service role |
| `testimonials` | Public could read pending/rejected; customers could post as `approved` | Public sees approved only; customers insert own `pending` only |
| Homepage names | `testimonials → profiles` embed (needed the public profile read) | `get_public_testimonials()` returns `rating, message, display_name ("First L."), created_at` only |
| Admin JWT | Full write on profiles/transactions/testimonials/promo codes | Read-only. Every admin write already goes through audited server actions |
| Grants | `ALL` (incl. TRUNCATE) to `anon`/`authenticated` on 23 tables | `anon`: SELECT on `rates_history`, `testimonials`. `authenticated`: SELECT where a policy allows, plus INSERT on `testimonials` and CRUD on own `recipients` |
| Functions | `attach_documents_to_profile` (broken, anon-callable SECURITY DEFINER); trigger functions callable over RPC | Dropped; trigger functions revoked from API roles; `search_path` pinned on 14 functions |
| Indexes | 2 duplicate indexes | Duplicates dropped; `testimonials(user_id)` added |
| Policies | 49 multiple-permissive + 41 initplan advisor warnings | One permissive policy per table/command/role; every `auth.*()` call wrapped in `(SELECT …)` |

No table data is read, written or deleted by either the migration or the rollback.

## Approval checklist (production)

1. **Backup.** `scripts/backup/Backup-ZarmanProduction.ps1` must report `RESULT: PASS`; the apply script refuses to run without such a report from the last 24 hours. The migration changes the catalog only, so the rollback script is a complete undo. The backup is a second safety net.
2. **Deploy the app first.** Deploy the app changes (testimonial RPC with fallback, forgot-password without a profile lookup, audit logging). They work against both the old and the new database. The old app's homepage testimonials and forgot-password page do **not** work after the migration, so this order matters.
3. **Apply and verify** in one step:
   `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Apply-SecurityMigration72.ps1`
   It runs as a single transaction with `lock_timeout = 5s`. If any lock is busy, it aborts cleanly with nothing applied, and you can run it again. It is idempotent. It then runs `verify-security-72.sql` and must end with `RESULT: PASS`. If verification fails, it prints the rollback command.
4. **Smoke tests** (below) and **re-check the advisors** (Security and Performance).

Active sessions are not interrupted: customer and admin JWTs keep working. A browser tab that has the *old* forgot-password page open will report "No account found" until it is reloaded.

## Post-apply verification (SQL Editor, read-only)

```sql
-- 1. Policies now in place on the three core tables (expect 4 rows)
select tablename, policyname, cmd, roles from pg_policies
where schemaname = 'public' and tablename in ('profiles','transactions','testimonials') order by 1, 2;

-- 2. Anonymous privileges (expect exactly: rates_history SELECT, testimonials SELECT)
select c.relname, p.priv from pg_class c, unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE']) p(priv)
where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and has_table_privilege('anon', c.oid, p.priv);

-- 3. Simulate the public key (expect: permission denied on profiles; testimonials = approved count)
begin;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select count(*) as approved_visible from public.testimonials;
select rating, display_name from public.get_public_testimonials(3);
rollback;
```

Smoke tests: homepage testimonials show names; register (duplicate email warning still appears); login; customer dashboard (profile, loyalty, request list, live updates); submit feedback (stays pending); forgot-password sends a code; admin Users / KYC / Transactions / Feedback / Audit pages load; admin creates an assisted transaction, edits a customer's name, rejects and archives a transaction, moderates feedback.

## Rollback

1. `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Apply-SecurityMigration72.ps1 -Rollback` (or SQL Editor → paste `supabase/rollbacks/20261113_72_security_rls_hardening.ROLLBACK.sql` → Run). This restores every policy (byte-exact, including the two Persian-named ones), every grant, function and index, and **re-opens the vulnerabilities**.
2. The app does not need to be rolled back. The testimonial fallback and the forgot-password change work against the old schema.

The rollback is tested: `npm run test:security` checks that rollback → catalog matches the original exactly, and that re-applying 72 afterwards works.

## Follow-ups (not in 72; decision needed)

- **Admin MFA at the database.** Admin RLS reads accept a password-only (`aal1`) admin token, so `ADMIN_MFA_REQUIRED` is enforced in the app but not when the API is called directly with that token. Only 2 of 4 admin accounts have a verified factor, so enforcing `aal2` in RLS now would lock 2 admins out. Enrol all admins first, then add `(SELECT auth.jwt() ->> 'aal') = 'aal2'` to the admin branches.
- **Role revocation lag.** Removing `app_metadata.role` takes effect in server actions immediately (`getUser()`), but an already-issued JWT keeps admin *read* access until it expires (`jwt_exp = 3600 s`).
- **Registration enumeration.** `check_user_exists` (anon) still reveals whether an email or phone number is registered, by design of the current register form. Consider moving it into a rate-limited server action.
- **Leaked-password protection** is disabled in Auth settings (Security Advisor).
- **Compute headroom.** The pre-upgrade slowdown matched resource starvation (see the report). If the memory-commitment warning persists under normal traffic, consider the next compute size.
