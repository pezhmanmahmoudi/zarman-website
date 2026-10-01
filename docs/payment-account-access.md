# Institution payment account details

The transfer flow supports AMC, OET and **Other** (a customer-entered company).
The selector uses **Other** in both languages. No invoice/candidate reference is
collected or required. Existing historical references are preserved.
Username and password are optional; when either is provided, both are required.
Passwords retain their exact characters. Changing recipient, route or institution,
or successfully submitting, clears the in-memory account fields.

## Activation (manual)

1. Review and apply `supabase/migrations/20260930_38_payment_account_access.APPLY_MANUALLY.sql`
   after the existing exchange-request migrations. This change has not been applied
   to a remote database by the code-editing workflow.
   Also apply `20260930_39_optional_institution_reference.APPLY_MANUALLY.sql` to
   remove the old database requirement for an invoice/candidate reference.
2. Configure `PAYMENT_ACCESS_ENCRYPTION_KEY` in the server's secret environment:
   a cryptographically random 32-byte key encoded as standard base64. Never use a
   `NEXT_PUBLIC_` variable or commit this value. Keep the key in the secret manager
   and back it up separately from the database. All server instances need the same key.
3. Restart the server after configuring the environment. If the key or RPC is
   missing, submissions containing credentials fail instead of silently losing them.
   Requests without credentials use the existing submission path.

## Storage and staff access

- AES-256-GCM, fresh 12-byte nonce, authenticated owner/quote binding; versioned envelope.
- Atomic submission RPC saves only encrypted data in a dedicated RLS-enabled table.
  Anonymous/authenticated database roles cannot read it or execute its RPCs.
- A retry cannot overwrite credentials or attach them to an existing request.
- The admin action runs `requireAdmin`; both it and the read RPC require
  `funding_status = confirmed`. A receipt upload or partial funding is insufficient.
- On the admin request detail, **View payment account** loads the values on demand.
  The password starts masked and can be revealed. Customer detail views, quotes,
  transaction snapshots, emails and reporting do not receive these values.
- Credentials are not put in local storage, URL parameters or logs. The server key
  must be retained while encrypted records exist; key rotation requires re-encryption.
- Deleting a request cascades to its encrypted account record. No new timed deletion
  is configured; production retention and access policy remain an operator decision.

Keep request-body capture/session replay disabled or redacted for these fields and
server actions in any deployment observability tooling. Encryption does not make
collecting credentials risk-free; they are decrypted only for the authorised admin.
