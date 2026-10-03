# Manual customer emails and final receipts

Request emails send only after an administrator selects **Send email to customer** and saves a stage or customer message, or explicitly clicks **Retry customer email** on a previously requested email. There is no cron endpoint, scheduled sender or automatic retry. Opening or refreshing a request does not send mail. Telegram alerts for new requests are unchanged.

The workflow transaction records the email decision and customer delivery snapshot alongside the request event. A Next.js `after()` callback starts the approved send immediately after the committed response. The browser can advance to the next step without waiting for Resend or PDF generation. A successful request update confirms the workflow change; it does not assert email delivery.

Management recipients, settings and template branches have been removed. The worker and database also reject legacy management jobs and payloads containing extra recipients, CC or BCC. Historical audit records remain in the database; customer delivery history is shown in the admin interface. Unchecked email choices and customer/system events never become sendable emails.

## Deployment

Apply migrations in repository order, including `_24` (immutable receipts), `_28` (structured bank details), `_44` (admin opt-in) and **`20261003_46_customer_only_email_recovery.APPLY_MANUALLY.sql`**. Deploy this application version with `_46`.

The new migration removes management enqueue/settings, retires unsent management jobs, removes global claiming, and adds the selected-delivery retry RPC. It normalizes abandoned customer leases: a never-prepared email becomes pending; an old ambiguous prepared attempt requires reconciliation. Applying it does not send an email or change a financial stage. It neither deletes nor regenerates completion receipts.

The existing request-only worker remains compatible with the old four-argument claim RPC until `_46` is installed. The new Retry button requires `_46`; without it, retries fail closed. Keep the application and database deployment close together so administrators can use the new settings and retry control.

These environment variables are server-only:

| Variable | Purpose |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Database access for sending and verified delivery callbacks. |
| `RESEND_API_KEY` | Key authorized for the verified sending domain. |
| `REQUEST_NOTIFICATIONS_FROM` | Approved sender, e.g. `Zarman Exchange <transfers@your-verified-domain>`. |
| `REQUEST_SITE_URL` | Canonical HTTPS origin, without a path, query, credentials or fragment. |
| `RESEND_WEBHOOK_SECRET` | Signing secret for `/api/webhooks/request-email`, including `whsec_`. |

Sending also uses `NEXT_PUBLIC_SUPABASE_URL`. No cron secret or Vercel plan change is required. Activation validates the sender, site URL, webhook secret and company bank details; there is no management email requirement.

## Sending and recovery

Each callback claims one customer email at a time with a 120-second lease. It stops starting new claims after 20 seconds or 25 messages. Ordinary approved actions process due emails for their request in event order; explicit Retry is restricted to the selected delivery. Existing unresolved earlier emails for the same recipient retain ordering. Database HTTP requests time out after eight seconds and provider requests after twelve seconds.

Before contacting Resend, the worker stores the exact recipient, sender, HTML, plain text, PDF bytes, template version and first-attempt timestamp. Retries reuse those bytes and the same `request-notification/<delivery-id>` idempotency key. Neither retrying an email nor recovering its lease repeats a financial transition.

If a process stops, only its one in-progress email remains leased; unstarted emails are not marked Sending. An expired lease displays **Sending interrupted - check delivery**. Click **Refresh** to obtain current delivery state, then **Retry customer email** for an eligible failed, pending or interrupted email. Retry queues an immediate selected send; if a prior email blocks it, resolve that earlier delivery first. Errors are logged as sanitized operation/code/status metadata, never customer addresses or email bodies.

Resend retains idempotency keys for 24 hours. This implementation uses a conservative 23-hour window. An ambiguous older attempt or exhausted retry budget becomes `reconciliation_required`; inspect the original send in Resend before further action. Never clear `first_attempt_at`, alter a persisted payload, delete a delivery or change its key to bypass this protection. An accepted, delivered, suppressed, opted-out or actively leased email cannot be manually retried. A never-prepared expired lease can be retried safely even if created yesterday.

The October 3 read-only production investigation found the reported completion email's management job leased with a first attempt recorded, and its customer job leased with **no first attempt**. Both leases had expired the previous day. This is consistent with the old batch being interrupted before reaching the customer. `_46` makes that customer delivery eligible for an explicit retry and retires the management job. No production recovery or send was performed during development.

## Delivery confirmation

Configure a Resend webhook for `https://<canonical-host>/api/webhooks/request-email`, subscribed to `email.sent`, `email.delivered`, `email.bounced`, `email.failed`, `email.complained` and `email.suppressed` where available. The endpoint verifies the signature against the original body before database access. It updates delivery records only; it does not trigger sending.

Callbacks can arrive before acknowledgement, out of order or repeatedly. The database deduplicates them and gives suppression/complaints precedence over late delivery callbacks. **Accepted by email service** means Resend accepted the message; **Delivered** requires a delivery callback. Bounce/suppression creates an operations task to check contact details.

## Email design and PDF

There is one English customer email template, irrespective of the account's interface language. The simple white Zarman layout contains a factual heading, greeting and a gray card with recipient, amount and date, followed by a prominent **Transaction code**. This code is the existing request `reference_code`, also shown in the subject and receipt; a UUID or bank settlement reference is never substituted. Names and administrator-written messages retain their original text. Successful-transfer wording is limited to the verified completion receipt. There is no Expected arrival field or estimated-arrival promise. Funding emails show the approved bank details and, for AUD funding, the Commonwealth restriction.

Completion emails attach the existing PDF generated from `exchange_request_completion_receipts`. The receipt design and authenticated dashboard download are unchanged. Accepted names, amounts, rates and fees come from the immutable completion snapshot. Later profile, bank, price or refund changes do not rewrite the receipt. PDFs use the existing local IRANSansX font assets; no runtime font download is required.

Run `node scripts/preview-request-emails.mjs` to generate synthetic English HTML and plain-text examples in `artifacts/request-email-previews`. `node scripts/preview-request-email-sample.mjs` also generates a clearly labelled English design sample and its PDF receipt at `output/pdf/zarman-sample-receipt-en.pdf`. These scripts do not send mail. Already-prepared historical emails keep their exact original bytes for safe idempotent retries; newly prepared emails use the English template.

## Verification

`npm run test:requests` covers customer-only enqueue, explicit opt-in, permissions, selected retry, abandoned leases, immutable payloads/PDFs, deduplication, webhook ordering, templates and admin UI behavior with synthetic data and fake senders. Production delivery requires deployment plus an authorized manual send; offline tests do not establish delivery to a real inbox.

References: [Next.js after](https://nextjs.org/docs/app/api-reference/functions/after), [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys), [Resend send API](https://resend.com/docs/api-reference/emails/send-email), [Gmail email CSS support](https://developers.google.com/workspace/gmail/design/css).
