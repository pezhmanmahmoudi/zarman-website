# Request status emails and final receipts

The request workflow writes email jobs in the same PostgreSQL transaction as each milestone. Submitting a request queues the received confirmation and funding instructions for the verified customer email and each configured management recipient. Funding evidence uploads queue acknowledgements; they never mark funds received. Confirmed funds, processing, completion, refunds and exceptions queue further updates. Internal clearance/overdue alerts go only to management.

Completion creates `exchange_request_completion_receipts` from the accepted quote and verified settlement. The customer and management receive a final PDF with the original names, payout, accepted rate, base fee and separate priority fee. It includes the priority fee status at completion; later refund updates are separate events. The authenticated dashboard download renders the same stored snapshot. No current profile, recipient, bank-account or price lookups are used to rebuild receipts. Bank settlement references and uploaded evidence remain private.

## Deployment configuration

Apply migrations in repository order, including `_18`, `_19`, `_23`, `_24`, `_25` and `_26`. `_24` corrects the earlier notification prepare/acknowledgement RPCs and adds immutable completion receipts; `_25` posts priority cash and earned income to accounting. `_26` permits those managed priority-fee adjustments under the legacy ledger type check and is required before paid-priority funding can succeed. Neither migration application nor application startup sends messages. Keep request and priority settings disabled until the following deployment configuration is in place.

Set these server environment variables in the actual deployment, never with a `NEXT_PUBLIC_` prefix:

| Variable | Purpose |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only database access for the worker and verified webhook. |
| `RESEND_API_KEY` | Existing Resend API key authorized for the verified sending domain. |
| `REQUEST_NOTIFICATIONS_FROM` | Approved sender, for example `Zarman Exchange <transfers@your-verified-domain>`. |
| `REQUEST_SITE_URL` | Canonical HTTPS site origin only, with no path, query, credentials or fragment. |
| `REQUEST_NOTIFICATIONS_CRON_SECRET` | At least 32 random characters, dedicated to this worker. |
| `RESEND_WEBHOOK_SECRET` | Signing secret for the dedicated Resend webhook endpoint, including its `whsec_` prefix. |

The worker also uses the existing `NEXT_PUBLIC_SUPABASE_URL`. Missing or invalid sender, site URL, database credentials or cron authentication fail closed before claiming or sending mail. The webhook endpoint and request activation checks separately require `RESEND_WEBHOOK_SECRET`. Enabling requests must also pass the application configuration checks and have valid management email recipients and company funding instructions in request settings. Confirm both bank instruction fields with finance, including account name, BSB/account or Iranian banking information, before enabling either transfer direction.

## Authenticated scheduling

Configure the hosting scheduler or an external job runner to call `GET /api/cron/request-notifications` every minute with the HTTP header `Authorization: Bearer <REQUEST_NOTIFICATIONS_CRON_SECRET>`. Use a scheduler that supports secret request headers; the URL alone cannot authorize the worker. Do not put the secret in a query string. A default Vercel cron `CRON_SECRET` will not match this dedicated secret automatically: explicitly arrange the authenticated header, or use a scheduler that supports it. This repository does not enable a live schedule or send a test email automatically.

Each run first sweeps deadlines, then claims up to 10 messages one at a time (120-second leases and bounded provider requests). Runs may overlap safely: row leases prevent two workers from owning the same job, and database ordering prevents later events overtaking earlier unsettled events for the same request, audience and recipient. A failed configuration produces HTTP 503, unauthorized calls produce HTTP 401, and successful runs return only aggregate counts. Alert on repeated 503s and old pending messages.

Database HTTP attempts are capped at eight seconds, and the worker stops starting new claims after 20 seconds to leave room within the 60-second route limit. Only the deadline sweep retries once after a transport failure or HTTP 502/503/504; its committed tasks and events are deduplicated. Claim, prepare and acknowledgement calls are never retried within the run. An unresolved failure returns the same generic 503 and logs only the operation, allowlisted error code and status; message bodies, recipients and credentials are excluded.
Database HTTP calls request connection closure after each response to avoid retaining idle serverless sockets; transport failures include only a fixed diagnostic category such as timeout, socket error or invalid response.

## Resend webhook

In the Resend dashboard, create a webhook for `https://<canonical-host>/api/webhooks/request-email` and copy its signing secret into `RESEND_WEBHOOK_SECRET`. Subscribe to `email.sent`, `email.delivered`, `email.bounced`, `email.failed`, `email.complained` and `email.suppressed` where available for the account. The endpoint verifies the signature against the unmodified request body before database access. HTTP 2xx means the verified event was durably recorded; non-2xx requests provider redelivery.

Provider callbacks can arrive before acknowledgement, out of order, or repeatedly. The database deduplicates event IDs and aggregates outcomes rather than trusting arrival order. A bounce or suppression creates an operations task to verify the customer's contact details. `provider_accepted` means Resend accepted the email; `delivered` is recorded only after delivery confirmation. A complaint/suppression takes precedence over a late delivered callback.

## Retries and operations

Before contacting Resend, the worker persists the exact recipient, sender, localized HTML/text, PDF bytes, template version and first-attempt timestamp. Retries reuse that payload and the same `request-notification/<delivery-id>` idempotency key. Network exceptions and temporary provider failures back off with jitter and respect `Retry-After`.

Ambiguous messages older than 23 hours, or after 12 unsuccessful attempts, become `reconciliation_required`; automatic delivery stops for that message and holds later messages for that recipient. Investigate provider acceptance before doing anything that could cause a second send. Never clear `first_attempt_at`, change a persisted payload, delete a job or assign a new key just to retry an uncertain delivery. Terminal validation failures become `failed`; missing contacts must be corrected through a reviewed operations process, not by changing an immutable recipient snapshot. Monitor the management request detail delivery list and the `exchange_request_notification_deliveries` table for `failed`, `suppressed` and `reconciliation_required` states.

Jobs created before `_24` have no historical funding/receipt snapshot. A previously rendered payload remains unchanged; an unrendered legacy funding or completion job fails closed if the required snapshot is absent. Investigate these separately during rollout rather than reconstructing historical instructions or receipts from mutable records. The initial feature defaults to disabled, so a fresh installation has no such jobs.

## Timing and receipts

Australian clearance allowances and the Iranian Satna/Paya notice come from the accepted policy snapshot. Configure current bank guidance operationally; no hardcoded Iranian settlement-cycle schedule promises delivery at a particular time. Priority measures handling after staff confirms cleared funds and required checks, using the accepted Sydney business calendar. Customer proof of payment does not start that clock.

The PDF embeds the site's IRANSansX fonts to preserve Persian names. The `.ttf` files beside the existing web fonts were losslessly decompressed from their corresponding `.woff2` files with `fontTools.ttLib.TTFont` (`font.flavor = None`); no external font or runtime font download is used. Include these font assets in deployment file tracing. PDF metadata is pinned to settlement and mail retries use the persisted attachment bytes.

## Offline validation

Run `node --test scripts/test-request-notifications.mjs` and the customer request database suite before release. The notification tests use synthetic fixtures, ephemeral PGlite and a fake mail sender, with no real credentials, database or messages. They cover public funding instructions, reference requirements, Persian/English templates, signed webhook verification, immutable PDF receipts, retry identity, expired ambiguity, lease ordering, completion validation, audience privacy, early/out-of-order callbacks and database permissions.

Before enabling production requests, separately exercise the staging deployment with authorized test recipients, a scheduler invocation and provider delivery/bounce fixtures. Confirm PDF availability, dashboard ownership checks and current bank instructions there. Deployment configuration and those externally observable delivery checks are operational steps, not something the offline suite can verify.
