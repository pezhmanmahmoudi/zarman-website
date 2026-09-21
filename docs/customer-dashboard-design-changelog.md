# Customer dashboard design implementation

Implemented on 21 September 2026 against the existing customer-request state machine and live Supabase/Resend integrations.

## What changed

- Added a bright Zarman visual system with indigo, violet, blue and restrained cyan brand tokens. Action required, Zarman review, completion and failed states use separate amber, slate, emerald and rose semantics.
- Rebuilt the transfer centerpiece around the unchanged official Zarman SVG. A separate light ribbon follows the Z shape for one 3–4 second opening sequence and then settles. RTL never mirrors the mark, and reduced-motion or the dashboard motion control serves the static state.
- Made the next owner explicit on every customer transfer: **Your turn**, **With Zarman**, **Complete** or **Closed**.
- Replaced the editable draft shell with a bilingual acknowledgement after the server accepts a request, while preserving the issued `ZE…` reference and direct tracking link.
- Made the lifecycle factual and dynamic: awaiting Zarman approval, approved for payment, payment under review, funds received or settlement in progress, and completed. Exact send, receive and locked-rate figures stay visible.
- Reframed the request flow as **Amount & currency → Recipient → Payment & confirmation**. Draft values survive back/forward navigation. Bank transfer is explicit, Standard/Priority remains server-priced, and successful submission shows the server-issued `ZE…` reference before the customer chooses to open the request.
- Added a direct path from copyable bank instructions to receipt upload. The receipt control now supports click, keyboard and drag-and-drop selection with visible pending, success and error states.
- Added Supabase Realtime invalidation for customer request lists, request state and new messages through a minimal owner-scoped signal table. Sensitive financial request and message rows remain server-only. Existing guarded polling and focus refresh remain as a resilience fallback.
- Refined recipients and the two-step account modal in the same visual system. Iranian bank branch city remains separate from residential city.
- Hardened recipient writes on the server with per-direction allowlists, required fields, BSB/account/postcode/email/phone checks, full Iranian Shaba mod-97 validation and optional card/bank-city validation. Ownership and identifiers remain server-controlled.
- Preserved loyalty progression, personalised rates, promo codes, education transfers, own-account recipients, bilingual English/Persian content, English Gregorian workflow dates and the existing customer/admin message history.

## Dependencies

The dashboard now includes the installed Framer Motion/Motion, React Bits Stepper, shadcn/Radix, Tailwind and Magic UI foundations. The recipients directory and modal use Tailwind with shadcn components; earlier supporting screens retain their existing CSS Modules. Step 5 adds no new dependencies.

## Step 5: recipients directory and account dialog — 22 September 2026

- Replaced the recipients panel with a responsive shadcn card grid, All/Australia/Iran filters and normalized Persian search. Loading, failure, no saved recipients and no matching results have separate states. New records become visible immediately and survive stale reads.
- Rebuilt recipient creation with shadcn Dialog and the controlled animated Stepper: Basic details (name, account country, relationship), then Banking details with the existing required residential/contact fields.
- Back retains values. Country switching retains separate Australian and Iranian drafts. Closing a dirty form offers Keep editing or Discard changes; repeated clicks cannot submit twice.
- Shared client/server validation returns inline field errors. Persian/Arabic bank digits and grouped pastes normalize without losing leading zeroes. Shaba mod-97 validation and separate bank branch/residential cities remain enforced.
- The portal has its own scroll area and persistent controls, Radix focus handling, English/Persian direction, LTR numeric inputs and reduced-motion/dashboard-pause support. The transfer form locks the recipient country to its destination.
- Added optional relationship persistence through `supabase/migrations/20260921_34_recipient_relationship.sql`. **This migration has only been tested locally; apply it to the target database before deploying this UI.** No existing records are backfilled.

Validation: `npm run test:dashboard` passes 66 tests, including EN/FA modal interactions, directory states, ownership and local migration checks. Scoped ESLint and the production build pass. Browser visual review remains skipped at the user's request; remote database writes were not exercised in this phase.

## Unified customer experience — 22 September 2026

- Introduced shared Tailwind/shadcn surfaces, page headings, inputs, status badges and pill controls across overview, verification, transfer creation, tracking, recipients and feedback. The light palette now uses graphite text and primary actions, quiet neutral surfaces and restrained violet accents.
- Removed hover movement from buttons, decorative country initials, redundant arrows and duplicate submission/receipt panels. Navigation uses the original unmirrored logo rather than a recreated wordmark.
- Built the transfer centerpiece with the installed Bento Grid, factual progress with the controlled React Bits Stepper, and real activity with the installed Animated List. Framer Motion transitions respond to navigation, status and amount updates; all respect reduced motion and the dashboard pause preference.
- Guided identity verification through details, address and documents with retained drafts and recoverable errors. Manual document support is explicitly incomplete until verification is finished; it cannot appear as an approved or submitted verification.
- Kept exact quoted amounts, references, recipient ownership, banking validation, live Supabase updates, pricing, promotions and loyalty benefits connected to their existing sources. Customer tracking now has one final receipt action and a compact recipient summary.
- Grouped privacy and animation settings into a single accessible dialog. English/Persian navigation retains the current route, query and form state; bank numbers remain LTR and dates remain English Gregorian.

Validation for this revision: 79 dashboard tests and 158 request workflow tests pass. Coverage includes bilingual guided forms, server error recovery, motion/privacy preferences and live request updates. Scoped ESLint and the production build pass. A midnight Sydney/UTC fixture mismatch was corrected by pinning isolated database test transactions to UTC; financial source and accounting assertions were unchanged. The local English and Persian dashboard routes respond and redirect unauthenticated visitors to their respective login pages. Browser visual review remains skipped as requested. Changes are local; no deployment or remote database mutation was performed.

## LottieFiles-inspired motion icons — 22 September 2026

- Added seven original, coordinated vector icons for identity, review, receipt upload, cleared funds, completion, recipients and attention. The reference is [LottieFiles animated icons](https://lottiefiles.com/free-animations/icon); the artwork is locally authored rather than downloaded from a third-party creator.
- Replaced the large static illustrations at key moments in identity verification, recipient onboarding, feedback, transfer tracking and receipt upload. Icon selection follows the actual request state; sending a receipt never displays a cleared-funds or completion symbol.
- Used the installed `lottie-react` SVG-only `LottieLight` runtime in a separate lazy chunk. Local animations last 1.6 seconds, play once when visible, pause offscreen/in background tabs, and settle to matching static SVGs. Buttons remain stationary. Reduced-motion and dashboard pause settings preserve static artwork, including when a player or asset cannot load.
- Assets contain only local vector shapes: no external URLs, expressions, embedded images or fonts. JSON assets are 2.7–6.6 KB each. Source generator, repeatable asset checks and provenance are included in `public/animations/dashboard/README.md`.

Validation: 87 dashboard tests and 44 request interface tests passed, including animation lifecycle, motion preferences, failure fallbacks and English/Persian state mapping. Asset generation checks, scoped ESLint, TypeScript and the production build passed. All seven local JSON endpoints returned the expected assets. Visual review remains skipped as requested; this phase does not deploy or change financial state.

## Earlier workflow validation

- `npm run test:dashboard` — 20/20 passed.
- `npm run test:requests` — 158/158 passed.
- `npm run test:admin` — 65/65 passed.
- `npm run test:converter` — 106 assertions passed.
- `npx tsc --noEmit` — passed.
- Scoped ESLint over every changed TypeScript/JavaScript file — passed with zero findings.
- `npm run build` — passed; all dashboard, request, admin and API routes compiled.

The repository-wide `npm run lint` still reports legacy findings in unrelated admin, reporting, animation and temporary backup files. This dashboard change adds no scoped lint findings. Browser visual review was intentionally skipped at the user's request.

## Release note

The dashboard code depends on `supabase/migrations/20260920_32_recipient_bank_city.sql` and `supabase/migrations/20260921_33_customer_request_realtime_signals.sql`. Both are applied to the isolated **Zarman Test** project. Apply them to the target database before promotion. Realtime degrades safely to the existing 20–30 second polling if a subscription is unavailable.
