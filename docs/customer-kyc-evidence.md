# Customer document intake — implementation and release gate

This is an evidence intake workflow, not an automated identity approval or a certification of regulatory compliance. Customer attachments never set a DVS/AML result to verified. A compliance officer must approve the intake policy and assess the customer's identity and risk before release.

## Document policy

The customer catalog in `lib/kyc/evidence.ts` maps eligible documents to the **existing admin AUSTRAC reporting categories**. The reporting enum also contains telephone numbers, membership IDs and credit cards; these are intentionally not offered as standalone primary identity evidence.

- Australian driver licence: separate front and back; licence/card numbers, state, expiry.
- Australian or foreign passport: photograph/personal-details page, current expiry; foreign passports use manual review, not the Australian passport DVS route.
- Government photo ID, proof-of-age card, national identity card and government benefits/concession card: separate front/back and additional address evidence.
- Birth/citizenship certificate: complete certificate and additional address evidence. A reviewer must determine what further evidence is needed to establish that the applicant is the person named.
- Address evidence: a bank statement or electricity/gas/water bill issued within 90 days, or council/government notice within 365 days. These windows are **proposed Zarman intake policy**, not universal statutory limits. Reviewer checks full name, current residential address, issuer, authenticity and issue date; PO boxes are not accepted as a residential address.
- Customers without listed documents should be assessed through an alternative identification procedure, not mark themselves verified. Documents not in English may require an accredited translation; the interface directs customers to support rather than claiming an untranslated upload is sufficient.

Both consent checkboxes remain unchecked by default. The recorded version is `customer-evidence-2026-09-29`. Notice links and the full text must be reviewed alongside the organisation's IDMatch/DVS participation terms and privacy policy.

## Implementation

- Customer UI is English, responsive and keyboard accessible. Private JPG/PNG/PDF uploads are limited to 4 MiB, below the action/hosting envelope. MIME and file signatures are checked server-side. Signature checking is **not malware scanning or authenticity verification**.
- Upload records bind owner, selected identity type, slot, address type, file hash and storage object. Submission rejects wrong-owner/type/slot IDs and reuse of the same content for different requirements. Upload controls retain successful files after a later failure; changing identity type clears the client selection.
- The RPC atomically records evidence and consent, links uploads, updates the profile to pending, and records an audit event. Legacy personal-data saving no longer creates a pending verification without evidence. Existing approved customers cannot resubmit.
- Customer-submitted values remain separate from administrator-verified `compliance_dvs_alt_*` fields. Reviewers can view the latest submission in the KYC drawer and user KYC panel. Admin access is checked on every read; signed file URLs expire after 60 seconds.
- The new bucket is private; restrictive policies deny direct anonymous/authenticated storage access. Only authenticated, authorised server handlers use the service role. No public URL or document contents are placed in telemetry or browser persistence.
- Previously completed/skipped checks are invalidated on a new submission. Failures, risk flags and existing audit history are preserved.

## Required before activation

1. Review and apply `supabase/migrations/20260929_37_customer_kyc_evidence.APPLY_MANUALLY.sql` to the isolated test database first. **It has not been executed by this change.** The new forms fail closed until the tables, bucket and RPC exist.
2. Run authenticated end-to-end tests with synthetic files: each document type, front/back and address selection, upload failure/retry, non-owner access, expired links, approved-account immutability, concurrent submit, admin review and audit rollback. `npm run test:kyc` includes an isolated in-memory PostgreSQL migration/RPC test (RLS, rollback, idempotency and approved-account protection). It does not connect to the project's database or replace browser/end-to-end verification.
3. Approve document freshness rules, alternative-ID/translation process, consent/privacy wording and risk-based CDD with the compliance officer. Collecting document images alone does not satisfy the whole AML/CTF program or establish that a remote applicant is the document holder.
4. Define the privacy/record-retention policy and operational cleanup of **unsubmitted** uploads. Replaced/unselected uploads remain private and unlinked; they must not be retained indefinitely. Submitted evidence must follow the approved retention schedule, not a blanket temporary-file purge. Configure malware scanning/quarantine if required by the security policy before accepting real customer documents.
5. Review the existing admin approval controls and verification-provider integration under the organisation's AML/CTF program. This change does not auto-approve, auto-run DVS, or silently copy customer declarations into verified reporting fields.

## Official sources checked 29 September 2026

- [AUSTRAC — Initial CDD for individuals](https://www.austrac.gov.au/industry-and-business/obligations-and-guidance/your-amlctf-program/customer-due-diligence/initial-customer-due-diligence/initial-customer-due-diligence-guides-customer-type/initial-cdd-individuals): risk-based identity establishment; photographic/non-photographic evidence; independent reliable information and verifying the applicant's link to the identity. Copy retention is not itself a universal requirement.
- [IDMatch — Consent obligations for private sector users](https://www.idmatch.gov.au/guidance-users/consent-obligations-private-sector-users): explicit, informed consent before DVS checks; consent cannot be inferred.
