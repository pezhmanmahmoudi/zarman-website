# Request status emails and final receipts

Request emails are sent only when an admin approves a stage (or posts a message) with **Send email to customer and management** ticked. The request action writes the email rows in the same PostgreSQL transaction as the milestone, then the same server action immediately claims and sends that request's emails before returning. There is no scheduler or background queue.

After `_44`, events created by customers (submission, receipt upload, replies) and by the system deadline sweep (`actor_id` NULL) are recorded as `skipped` with `admin_email_opt_out`; they are visible in the delivery list but never sent. Telegram still alerts admins about new submissions. Funding evidence never marks funds received.

Completion creates `exchange_request_completion_receipts` from the accepted quote and verified settlement. The customer and management receive a final PDF with the original names, payout, accepted rate, base fee and separate priority fee. It includes the priority fee status at completion; later refund updates are separate events. The authenticated dashboard download renders the same stored snapshot. No current profile, recipient, bank-account or price lookups are used to rebuild receipts. Bank settlement references and uploaded evidence remain private.

## Deployment configuration

Apply migrations in repository order, including `_18`, `_19`, `_23`, `_24`, `_25`, `_26` and `_44`. `_44` restricts sendable rows to admin-approved events, retires never-attempted pending rows from the old scheduled queue (`skipped` / `queue_retired`) and adds the service-role-only `claim_request_notifications_for_request` RPC. `_24` corrects the earlier notification prepare/acknowledgement RPCs and adds immutable completion receipts; `_25` posts priority cash and earned income to accounting. `_26` permits those managed priority-fee adjustments under the legacy ledger type check and is required before paid-priority funding can succeed. Neither migration application nor application startup sends messages. Keep request and priority settings disabled until the following deployment configuration is in place.

Set these server environment variables in the actual deployment, never with a `NEXT_PUBLIC_` prefix:

| Variable | Purpose |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only database access for sending and the verified webhook. |
| `RESEND_API_KEY` | Existing Resend API key authorized for the verified sending domain. |
| `REQUEST_NOTIFICATIONS_FROM` | Approved sender, for example `Zarman Exchange <transfers@your-verified-domain>`. |
| `REQUEST_SITE_URL` | Canonical HTTPS site origin only, with no path, query, credentials or fragment. |
| `RESEND_WEBHOOK_SECRET` | Signing secret for the dedicated Resend webhook endpoint, including its `whsec_` prefix. |

Sending also uses the existing `NEXT_PUBLIC_SUPABASE_URL`. Missing or invalid sender, site URL or database credentials fail closed before claiming or sending mail. `REQUEST_NOTIFICATIONS_CRON_SECRET` is no longer used. The webhook endpoint and request activation checks separately require `RESEND_WEBHOOK_SECRET`. Enabling requests must also pass the application configuration checks and have valid management email recipients and company funding instructions in request settings. Confirm both bank instruction fields with finance, including account name, BSB/account or Iranian banking information, before enabling either transfer direction.

## Immediate sending

After a successful admin action with the email box ticked, the server claims only that request's pending rows (up to 25, 300-second leases) and sends them in event order. Later events wait for earlier unsettled events for the same audience and recipient, so one action can take two claim rounds. Sending stops after 20 seconds of claims. Mail problems never undo the admin action: they are logged with only the operation, allowlisted error code and status (no bodies, recipients or credentials), and the delivery list on the request shows the result.

The deadline sweep (expiry, overdue tasks) runs best-effort whenever an admin opens the request list, because there is no scheduler. Database HTTP attempts are capped at eight seconds; claim, prepare and acknowledgement calls are never retried within one action.
Database HTTP calls request connection closure after each response to avoid retaining idle serverless sockets; transport failures include only a fixed diagnostic category such as timeout, socket error or invalid response.

## Resend webhook

In the Resend dashboard, create a webhook for `https://<canonical-host>/api/webhooks/request-email` and copy its signing secret into `RESEND_WEBHOOK_SECRET`. Subscribe to `email.sent`, `email.delivered`, `email.bounced`, `email.failed`, `email.complained` and `email.suppressed` where available for the account. The endpoint verifies the signature against the unmodified request body before database access. HTTP 2xx means the verified event was durably recorded; non-2xx requests provider redelivery.

Provider callbacks can arrive before acknowledgement, out of order, or repeatedly. The database deduplicates event IDs and aggregates outcomes rather than trusting arrival order. A bounce or suppression creates an operations task to verify the customer's contact details. `provider_accepted` means Resend accepted the email; `delivered` is recorded only after delivery confirmation. A complaint/suppression takes precedence over a late delivered callback.

## Retries and operations

Before contacting Resend, the worker persists the exact recipient, sender, localized HTML/text, PDF bytes, template version and first-attempt timestamp. Retries reuse that payload and the same `request-notification/<delivery-id>` idempotency key. Network exceptions and temporary provider failures stay `pending` and are retried on the next admin action for that request with the email box ticked; there is no automatic retry.

Ambiguous messages older than 23 hours, or after 12 unsuccessful attempts, become `reconciliation_required`; automatic delivery stops for that message and holds later messages for that recipient. Investigate provider acceptance before doing anything that could cause a second send. Never clear `first_attempt_at`, change a persisted payload, delete a job or assign a new key just to retry an uncertain delivery. Terminal validation failures become `failed`; missing contacts must be corrected through a reviewed operations process, not by changing an immutable recipient snapshot. Monitor the management request detail delivery list and the `exchange_request_notification_deliveries` table for `failed`, `suppressed` and `reconciliation_required` states.

Jobs created before `_24` have no historical funding/receipt snapshot. A previously rendered payload remains unchanged; an unrendered legacy funding or completion job fails closed if the required snapshot is absent. Investigate these separately during rollout rather than reconstructing historical instructions or receipts from mutable records. The initial feature defaults to disabled, so a fresh installation has no such jobs.

## Timing and receipts

Australian clearance allowances and the Iranian Satna/Paya notice come from the accepted policy snapshot. Configure current bank guidance operationally; no hardcoded Iranian settlement-cycle schedule promises delivery at a particular time. Priority measures handling after staff confirms cleared funds and required checks, using the accepted Sydney business calendar. Customer proof of payment does not start that clock.

The PDF embeds the site's IRANSansX fonts to preserve Persian names. The `.ttf` files beside the existing web fonts were losslessly decompressed from their corresponding `.woff2` files with `fontTools.ttLib.TTFont` (`font.flavor = None`); no external font or runtime font download is used. Include these font assets in deployment file tracing. PDF metadata is pinned to settlement and mail retries use the persisted attachment bytes.

## Offline validation

Run `node --test scripts/test-request-notifications.mjs` and the customer request database suite before release. The notification tests use synthetic fixtures, ephemeral PGlite and a fake mail sender, with no real credentials, database or messages. They cover public funding instructions, reference requirements, Persian/English templates, signed webhook verification, immutable PDF receipts, retry identity, expired ambiguity, lease ordering, completion validation, audience privacy, early/out-of-order callbacks and database permissions.

Before enabling production requests, separately exercise the staging deployment with authorized test recipients, an admin action with email ticked and provider delivery/bounce fixtures. Confirm PDF availability, dashboard ownership checks and current bank instructions there. Deployment configuration and those externally observable delivery checks are operational steps, not something the offline suite can verify.
