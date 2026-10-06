# Customer Telegram notifications

This integration uses a **dedicated customer bot**, separate from internal KYC and new-request notifications. It does not change the existing admin bot.

## Customer experience

- The overview shows identity status until approval. The approval success card stays for the first visible overview visit; later visits show the Telegram card in that same position, with the supplied **Live chatbot** animation and pale Telegram-blue surface. The animation plays once, holds its final frame, and replays on mouse hover, respecting dashboard motion preferences. Connecting and managing notifications expands inside this card. Profile → Notifications uses the identical card and remains available before KYC approval; a compact transaction-summary card links there too.
- The first visible approval notice is acknowledged on the customer's profile, so the preference follows their account across devices. Only an authenticated account can acknowledge its own approved notice. The acknowledgement is cosmetic and never changes KYC status. Existing approved accounts see success once after rollout. If saving fails, the current dashboard session still remembers the view; a later session can show it again.
- Sign in with a verified email, generate a connection link, open Telegram and press Start, then return to the dashboard to confirm the displayed Telegram account.
- Links contain 256-bit random tokens, stored only as SHA-256 hashes, expire after ten minutes and are invalidated on confirmation/cancellation. A link alone cannot activate the connection: confirmation requires the originating authenticated Zarman account.
- All future customer-visible admin request events and admin messages create notifications, independently of the email checkbox. Internal notes, customer messages and old events do not generate Telegram notifications.
- By default Telegram receives a reference, a plain-language event summary and an authenticated-dashboard link. Message text is sent only when the customer enables “Include message text”, both at the time of the event and at delivery. No documents, bank account data or payment-account credentials are attached automatically.
- Customers disconnect in their profile or send `/stop`. Blocking the bot also disables the connection. Reconnecting creates a new connection: queued messages for an old connection are never redirected to a new chat.
- Telegram is an outbound notification channel. Replies and financial actions stay in the authenticated dashboard.

## Activation

1. Create a new bot in **@BotFather**. Use the display name **Zarman Exchange**, an available official username, and the existing Zarman logo. Disable group joining with `/setjoingroups`; configure the bot's privacy-policy URL to the existing Zarman privacy page. Keep ownership with the company's secured Telegram account.
2. Apply `supabase/migrations/20261006_48_customer_telegram.APPLY_MANUALLY.sql` once, after the existing request and message migrations, then `supabase/migrations/20261006_49_identity_notice_seen.APPLY_MANUALLY.sql`. The code workflow does not apply these to a remote database. Telegram tables have RLS and no anonymous/authenticated table or RPC privileges; only the server's service role can use them. Migration 49 separately grants authenticated users a narrow RPC that only marks their own approved identity notice as seen.
3. Set these **server-only** production environment variables. Never use `NEXT_PUBLIC_` for bot secrets or paste secrets into chat, source files or command-line arguments.

   | Variable | Value |
   | --- | --- |
   | `CUSTOMER_TELEGRAM_ENABLED` | `true` only when the migration and production setup are ready |
   | `CUSTOMER_TELEGRAM_BOT_TOKEN` | Token for the dedicated customer bot |
   | `CUSTOMER_TELEGRAM_BOT_USERNAME` | Matching username, without `@` |
   | `CUSTOMER_TELEGRAM_WEBHOOK_SECRET` | 32–256 random URL-safe characters |
   | `REQUEST_SITE_URL` | The canonical production HTTPS origin |
   | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Existing server database configuration |

4. Deploy the code. Do not enable this integration on preview deployments that share the production database/bot. Token rotation for the same bot retains connections; switching to a different bot identity requires disconnecting old connections first.
5. From a trusted environment with those variables injected, run `node scripts/setup-customer-telegram.mjs --configure` once to register the webhook and English/Persian commands/descriptions. For local setup with Node 20.6+ and the same production values in the git-ignored `.env.local`, use `node --env-file=.env.local scripts/setup-customer-telegram.mjs --configure`. This script never sends a customer notification or prints tokens/webhook secrets. Without `--configure`, it only reads the public bot identity and coarse webhook health.
6. Customers select **Connect Telegram** in Overview (or Profile), open Telegram, press **Start**, then return to the same dashboard card and select **Confirm & enable notifications**. Future status updates and team-message notifications are sent after connection. The optional **Include message text** setting also sends the team's message text. If production configuration is unavailable, the card explains that Telegram is temporarily unavailable and offers **Try again** to refresh availability; it does not create links until configuration is ready.

No scheduler, cron service, extra subscription or Vercel Pro plan is required. Sends run directly after each committed admin action through Next.js `after()`. Failed/interrupted sends are retried manually from the admin page.

## Delivery and recovery

The event trigger records delivery intent in the same database transaction as the request event. A unique event ID prevents duplicate notifications when an admin retries a command. The sender claims each unsent record once and rechecks connection status and message-preview consent immediately before sending. Messages from one action are spaced by one second. A bounded send operation handles up to twelve notifications for the request; no notification provider call blocks the financial transaction. A manual retry targets only the selected notification.

Failed sends, including explicit rate-limit rejections, remain visible for a manual retry. Telegram `sendMessage` has no idempotency key: timeouts, ambiguous responses and sends without a confirmed result after two minutes are shown as **Delivery unconfirmed**, not automatically resent. Staff can review and explicitly resend from the request's **Activity & notification history → Customer Telegram** section, with a duplicate warning and audit record. Unsent records can also be picked up on the next admin action for that request. “Sent to Telegram” means Telegram accepted the message, not that the customer read it.

Disconnect cancels unsent work. An API call already in flight when disconnect commits may finish; a sent message cannot be recalled by disconnecting. Missed webhook acknowledgements are deduplicated by bot/update ID. Expired links are removed when the customer opens their settings; old webhook update IDs are removed when new updates arrive. This integration keeps connection and delivery audit records; include these tables in the business's existing retention/export/deletion procedures. Profile/request deletion cascades to the associated records.

Keep request-body/session-replay capture off for the connection flow and webhook. Do not log Telegram payloads or fetch exceptions: Bot API URLs contain the token. Provider health logs use fixed codes only. Set `CUSTOMER_TELEGRAM_ENABLED=false` to stop sends; revoke the dedicated bot token if it is compromised.

Telegram references: [deep links](https://core.telegram.org/bots/features#deep-linking), [webhook secret header](https://core.telegram.org/bots/api#setwebhook), [sendMessage](https://core.telegram.org/bots/api#sendmessage).
