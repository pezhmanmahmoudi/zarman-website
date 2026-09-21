# Customer dashboard design implementation

Implemented on 21 September 2026 against the existing customer-request state machine and live Supabase/Resend integrations.

## What changed

- Added a bright Zarman visual system with indigo, violet, blue and restrained cyan brand tokens. Action required, Zarman review, completion and failed states use separate amber, slate, emerald and rose semantics.
- Rebuilt the transfer centerpiece around the unchanged official Zarman SVG. A separate light ribbon follows the Z shape for one 3–4 second opening sequence and then settles. RTL never mirrors the mark, and reduced-motion or the dashboard motion control serves the static state.
- Made the next owner explicit on every customer transfer: **Your turn**, **With Zarman**, **Complete** or **Closed**.
- Made the lifecycle factual and dynamic: awaiting Zarman approval, approved for payment, payment under review, funds received or settlement in progress, and completed. Exact send, receive and locked-rate figures stay visible.
- Reframed the request flow as **Amount & currency → Recipient → Payment & confirmation**. Draft values survive back/forward navigation. Bank transfer is explicit, Standard/Priority remains server-priced, and successful submission shows the server-issued `ZE…` reference before the customer chooses to open the request.
- Added a direct path from copyable bank instructions to receipt upload. The receipt control now supports click, keyboard and drag-and-drop selection with visible pending, success and error states.
- Added Supabase Realtime refresh for customer request lists, request state and new messages. Existing guarded polling and focus refresh remain as a resilience fallback.
- Refined recipients and the two-step account modal in the same visual system. Iranian bank branch city remains separate from residential city.
- Hardened recipient writes on the server with per-direction allowlists, required fields, BSB/account/postcode/email/phone checks, Iranian Shaba validation and optional card/bank-city validation. Ownership and identifiers remain server-controlled.
- Preserved loyalty progression, personalised rates, promo codes, education transfers, own-account recipients, bilingual English/Persian content, English Gregorian workflow dates and the existing customer/admin message history.

## Dependencies

No packages were added or changed. The implementation uses Next Image, current Lucide icons, CSS Modules and the existing Supabase client.

## Validation

- `npm run test:dashboard` — 18/18 passed.
- `npm run test:requests` — 157/157 passed.
- `npm run test:admin` — 66/66 passed.
- `npm run test:converter` — 106 assertions passed.
- `npx tsc --noEmit` — passed.
- Scoped ESLint over every changed TypeScript/JavaScript file — passed with zero findings.
- `npm run build` — passed; all dashboard, request, admin and API routes compiled.

The repository-wide `npm run lint` still reports legacy findings in unrelated admin, reporting, animation and temporary backup files. This dashboard change adds no scoped lint findings. Browser visual review was intentionally skipped at the user's request.

## Release note

The dashboard code depends on `supabase/migrations/20260920_32_recipient_bank_city.sql`. Apply that migration to the target database before promoting this preview. Realtime subscriptions degrade safely to the existing 20–30 second polling if the relevant tables are not enabled in the Supabase realtime publication.
