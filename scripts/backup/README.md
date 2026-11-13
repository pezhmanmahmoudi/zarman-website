# Production backup kit (read-only, verified, encrypted)

`Backup-ZarmanProduction.ps1` takes a complete backup of the production Supabase database and every
Storage file, proves the backup restores to an exact copy, encrypts it, and wipes all plaintext.
It only **reads** from production: no writes, no resets, no deploys, no migrations.

## What is verified before the result can be `PASS`

| Area | Check (any failure = `FAILED`, no archive is produced) |
|---|---|
| Access | Every table, sequence and schema is readable. Unreadable `public` / `auth` / `storage` / `supabase_migrations` data always fails. Unreadable Supabase-managed tables fail unless `-AllowManagedExclusions`; each one is then listed as **not backed up** and the result is `PASS WITH EXCLUSIONS`. |
| Dump | `pg_dump --format=custom --create` of the whole database (all schemas incl. `auth`, `storage`, `realtime`, `vault`, `extensions`) plus `pg_dumpall --roles-only`. Every table must have a data section in the archive. |
| Data | Row count **and content checksum** for every table, taken before and after the dump. After restoring, every table that did not change while dumping must be byte-identical. Tables that changed meanwhile (e.g. Auth refresh tokens) must fall in the before→after range, and are listed. |
| Catalog | ~1,300 objects compared by **definition and permissions**: policies (USING/WITH CHECK, roles, command), functions (full definition, SECURITY DEFINER, `search_path`, EXECUTE grants), triggers, views, indexes, constraints, column lists, table/column/schema grants, default privileges, publications, event triggers, RLS/FORCE RLS flags, and all roles (attributes, memberships, settings). |
| Restore | Temporary local PostgreSQL 17 (127.0.0.1, random password, ICU `en-US` like production). `roles.sql` must apply with zero errors; `pg_restore --exit-on-error --single-transaction` must succeed with zero errors. |
| Storage | Every file in `storage.objects` must be in the Storage API listing with the same size, ETag and content type (and nothing extra), download to exactly its size, have **MD5 = ETag**, be served with its recorded content type, and re-read from disk with the same SHA-256. A name containing characters Windows can't store is saved percent-encoded; the manifest records the original name. |
| Archives | 7-Zip AES-256 with encrypted file names; each archive is tested (all CRCs) and its file count compared; SHA-256 of each archive recorded. |

### The only entries not restore-tested locally

A standard PostgreSQL cannot install three Supabase-only extensions: `hypopg`, `index_advisor` and
`supabase_vault`. Their entries are left out of the local restore **by catalog identity** (the
extension and its own objects, e.g. `vault.secrets`, which is empty), not by matching error messages.
They are still in the dump, and every one is listed in the report. Any other restore error fails the run.

## Protection of the data

- Your database password is typed at a hidden prompt and passed to the PostgreSQL tools only as an environment variable of each child process. It never appears on a command line, in a file or in a log.
- The archive passphrase is typed into 7-Zip's own hidden prompt. It never passes through PowerShell, a command line or a log.
- Temporary plaintext is written only to an **EFS-encrypted**, owner-only folder, then overwritten and deleted. BitLocker is **off** on this PC's C: drive, so EFS is the protection at rest. The script refuses to run if neither EFS nor BitLocker is available, unless you pass `-AcceptUnencryptedDisk`.
- Output goes to `C:\Users\<you>\ZarmanBackups\` with owner-only permissions. The script refuses paths inside the git repository or a OneDrive folder, and `.gitignore` blocks `*.dump`, `*.7z` and `zarman-prod_*`.
- On failure, only the logs are kept for diagnosis, EFS-encrypted in `diagnostics\`. Delete them after review.

## Run it

```powershell
cd C:\Users\z5340863\zarman-next
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\backup\Backup-ZarmanProduction.ps1 -DbHost aws-1-ap-southeast-2.pooler.supabase.com -DbPort 5432
```

Prompts, in order:
1. `Supabase database password (hidden)`: the database password from the Supabase Dashboard.
2. Database archive: 7-Zip shows `Enter password` and then `Verify password`. Type the passphrase each time.
3. Database archive test: 7-Zip shows `Enter password` once more. Type the passphrase (3 attempts allowed).
4. Storage archive: the same three entries.

Use one long passphrase for all of them, and save it in your password manager **before** starting.

## Output

`C:\Users\z5340863\ZarmanBackups\zarman-prod_<yyyy-MM-dd_HHmmss>\`

| File | Contents |
|---|---|
| `…_database.7z` | `full.dump`, `roles.sql`, `schema.sql`, the TOC, before/after/restored checksums, catalog fingerprints, extension and settings inventories, logs |
| `…_storage.7z` | `files\<bucket>\<path>` for every object, `storage-inventory.json`, `storage-manifest.json` (size, MD5, SHA-256 and checks per file) |
| `…_SHA256SUMS.txt` | checksums of both archives |
| `…_REPORT.txt` | result, every check, exclusions, not-restore-tested entries, limitations. Counts and object names only, no customer data |

## Verified backup vs. a restorable Supabase project

`PASS` means the **database and files** are completely and verifiably backed up. It does **not** make a
turnkey clone of the Supabase project. To stand up a new project from it you also need:

- **Role passwords:** Supabase never exports them; set new ones.
- **Auth configuration:** providers, redirect URLs, SMTP, email templates, password/MFA policy, JWT signing keys. Users, password hashes, identities and MFA factors *are* in the dump. Existing sessions and refresh tokens become invalid under new JWT keys, so users sign in again.
- **API keys and app environment variables:** for example, Vercel.
- **Storage files:** upload them through the Storage API to the same bucket and path. The `storage.objects` rows only describe them.
- **Platform settings:** network restrictions, SSL enforcement, custom domains, compute, PITR and daily backups, logs, Realtime and Edge Function settings, the Vault encryption key, and the Supabase-only extensions.

## Re-validating the kit (synthetic data only)

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\backup\tests\Test-BackupKit.ps1
```

This runs the unit tests, then rehearses the whole backup against a throw-away local "fake Supabase" PostgreSQL 17 (same 17 roles, memberships, settings, schemas, ICU locale and extension layout as production) and a mock Storage API with non-ASCII and Windows-illegal file names. Scenarios:

- a full pass;
- an unreadable managed table (fails, then passes with an explicit exclusion);
- an unreadable Auth table (always fails);
- a tampered Storage file;
- an unknown Storage file;
- a restore error;
- the rehearsal switches refused against a non-local host.

Last result: 96 passed, 0 failed.
