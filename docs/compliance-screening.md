# Compliance screening (DVS · sanctions · PEP)

Implements the AML/CTF program's three-stage check with free internal engines first and the
paid vendor (NameScan) only on demand.

## One-time setup
1. Apply, in order, in the Supabase SQL editor:
   * `supabase/migrations/20261031_69_compliance_screening.APPLY_MANUALLY.sql` (tables, profile PEP fields)
   * `supabase/migrations/20261031_70_dfat_low_relevance.APPLY_MANUALLY.sql` (`sanctions_entries.low_relevance`)

   Until _69 is applied the compliance panel shows a "not set up" message and the approval gate is
   skipped (it fails closed on any other error).
2. Admin → **Compliance lists** → upload the DFAT `Australian_Sanctions_Consolidated_List.xlsx`
   (or `node --env-file=.env.local scripts/load-dfat.mjs "<path>.xlsx" [--force]`).
3. Build the PEP list from Wikidata (free, CC0):
   `node --env-file=.env.local scripts/import-pep-wikidata.mjs` (dry run), then add `--apply`.
4. Optional one-offs: `scripts/backfill-pep-declaration.mjs` (record "No" for customers asked
   verbally) and `scripts/screen-everyone.mjs` (screen every customer and recipient now).

## Stages
| Stage | Customer | Beneficiary |
|---|---|---|
| 1 DVS | Method chosen by admin on the customer page (RapidID / manual) | n/a |
| 2 Sanctions | Internal DFAT list (automatic) and/or NameScan (on demand) | same |
| 3 PEP | Tick 1 internal search (always) · tick 2 self-declaration (asked at KYC) · tick 3 vendor (only when needed) | internal search; vendor optional |

Vendor PEP is *required* when the category is above A, the internal search hit, or the customer
declared PEP. A documented waiver (with reason) satisfies it.

## Categories (`lib/compliance/risk-category.ts`)
* **A**: bank under 10,000 / cash under 7,000, no red flags.
* **B**: bank 10,000–19,999.99, cash 7,000–9,999.99, or manually raised.
* **C**: bank ≥ 20,000, cash ≥ 10,000, rolling 12-month total ≥ 100,000, an unresolved sanctions/PEP
  match or PEP declaration, or manually raised. Needs a recorded ECDD approval.

Approval and settlement commands (`await_funds`, `resume_funded_request`, `finalize_funds`,
`start_processing`, `reconcile_complete`, `complete`) are blocked until every party is screened,
no match is awaiting review, the PEP self-declaration is on record, any required vendor PEP check is
done/waived, and category C has ECDD approval. A confirmed sanctions match is a hard stop.

## Where results appear
* **Transaction page**: one tick in the header (cleared / action needed) and a *Compliance screening*
  drawer at the bottom with the result grid, only the actions still needed, and a link to the customer.
* **Customer page → Compliance checks**: Identity · Sanctions · PEP for the customer, plus each saved
  recipient's result in the recipients panel.
* **Compliance lists** (`/admin/compliance`): list status, DFAT upload and every open review.

Stored results are reused: opening a page only re-screens when the name or date of birth changed, or
the list was replaced while the request is still open. "Re-run" is always an explicit click.

## When DFAT publishes a new list
Upload it (re-upload the same file with "Reload even if unchanged" to force). Every customer and
recipient is re-screened in memory (free). Only *new* potential matches enter **Open reviews**;
people already cleared against the same listed entries are not asked again. Open requests re-screen
the next time they are viewed; completed ones keep their history.

## Low-relevance listings (China, Russia, Pakistan)
No DFAT row is ever dropped. Groups whose nationality (else address or place of birth) is China,
Russia or Pakistan, and whose text has no Iran link (Iran, Iranian, IRGC, Tehran, Isfahan,
Bandar Abbas), are stored with `low_relevance = true`. They only raise a hit on a strong match:
score ≥ 95% **and** either a matching year of birth or an identical name; a different date of birth
never reports. All other rows use the normal thresholds. Configured in
`DFAT_LOW_RELEVANCE_COUNTRIES` (`lib/compliance/dfat-import.ts`) and `STRICT_MIN_SCORE`
(`lib/compliance/name-matching.ts`).

## Matching
1. **Normalise**: Persian/English transliteration variants collapse to one key
   (Mohammad/Muhammad/Mohamad, Hossein/Hussein, Qasem/Ghasem); Persian script matches DFAT's
   original-script rows.
2. **Compare word by word, in any order**: each name part finds its best partner in the listed name.
3. **Weight by rarity**: common given names (Mohammad, Ali…) count little; a rare surname counts a lot,
   so sharing only common first names is not a match.
4. **Corroborate with year of birth**: a matching year raises confidence; a different year hides a
   merely similar name but never an almost-identical one.
5. **Thresholds**: sanctions from 78%, PEP from 85% (`SANCTIONS_SEARCH` / `PEP_SEARCH` in
   `lib/compliance/name-matching.ts`).

The admin records each hit as *false positive* or *confirmed* with a reason (audit-logged); cleared
results carry over to later screens of the same person against the same listed entries.

Tests: `npm run test:compliance`.
