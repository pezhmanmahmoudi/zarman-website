# Admin workspace audit and redesign

Date: 11 September 2026

## Scope and result

Restructured the shared admin workspace, dashboard, navigation, forms, tables, treasury, ledger and reports. Financial posting rules and existing in-progress bank-fee/public-site changes were preserved. No production records were changed or deployment performed.

## Findings addressed

| Finding | Change |
| --- | --- |
| Modals, menus and notifications could be trapped by container overflow or stacking contexts. | Added a shared native top-layer `AdminDialog`; migrated approval, confirmation and ledger drawers. Dropdowns, calendars and tooltips use anchored native popovers with viewport limits and scroll/resize positioning. Notifications attach to the active dialog when needed. |
| Separate dialog scroll locks could unlock the page while another dialog remained open. | Centralized dialog registration and restoration. Added initial focus, keyboard containment, Escape/backdrop dismissal and return focus. Pending approval cannot be dismissed. |
| Ledger details had no matching trigger in the table. | Added explicit keyboard-accessible details buttons to desktop rows and mobile cards, keeping edit/delete actions independent. |
| Off-screen mobile navigation remained in the keyboard flow. | Mobile navigation is rendered as a dismissible modal drawer, with active-route semantics and a larger touch target. Desktop navigation is grouped into Workspace, Finance and Administration. |
| Public dark-theme variables leaked into light admin screens, especially portals. | Added an admin body theme with consistent text, status, border and background colors, English/Persian font stacks, focus rings and reduced-motion behavior. |
| Grid minimums and long labels forced cards and forms beyond their available width. | Made shared cards/forms shrink safely, allowed labels to wrap, bounded tables to their panels and allowed pagination/filter controls to wrap. |
| Ledger filters required more than 1,000px even on narrower desktop workspaces. | Filters now wrap according to available content width. Date subtitles stay in normal flow; numeric summaries and account labels can wrap. |
| Treasury forms/lists clipped controls, and responsive reconciliation rules were overridden. | Removed unnecessary clipping/stacking rules, corrected grid specificity and kept wide reconciliation data in its own scroll region. |
| Reports had inconsistent styling, cramped grids and overlapping sticky controls. | Applied consistent slate/indigo styling, responsive panels, readable headings, keyboard-accessible table regions and loading/status announcements. |
| Dashboard repeated generic headings and gave little guidance about the next action. | Rebuilt overview around review queues, a pending-item summary, customer/transaction totals, recent activity and direct workflow shortcuts. Added explicit refresh and Sydney snapshot times. |
| Sidebar fetched all dashboard counters, then dashboard fetched them again. | Sidebar reads only three pending counters. Request-scoped React memoization shares pending data and authenticated read clients during server rendering; no persistent cross-request data cache was added. |
| Ledger prepared and serialized a CSV dataset on every page/filter load. | Initial ledger data now uses one paginated query. CSV fetches only on request and paginates through API limits using the same filter builder. Errors prevent partial downloads. |
| Charts and serial independent reads delayed useful content. | Ledger/treasury reads run concurrently; the ledger chart bundle loads near the viewport. Added route loading placeholders and a recoverable error screen. |
| Treasury aggregation was callable without its own admin guard. | Added `requireAdmin()` directly to `getTreasuryFullData()` before it creates a privileged database client. |
| Transaction edits used small inline check/cancel icons that were hard to operate on mobile. | Amount, reference and customer-code edits now open a focused dialog with a readable input and explicit 48px Save changes/Cancel buttons. Pending saves block duplicate submission; failures preserve the draft. Amount input validates the complete number. Mobile ledger entry forms also have large save/cancel footers. |
| Treasury required scrolling past unrelated analytics and management forms. | Replaced the long composite page with URL-backed Overview, Accounts, Expenses, Capital, Insights and Settings workspaces. Subsections provide direct access to reconciliation, recurring expenses and bank fees. Only the selected pane mounts its forms. The overview has compact balances, alerts and task shortcuts. |
| Ledger records were buried beneath expensive analytics and a nested vertical scroll region. | Entries is now the default view with a compact search/filter toolbar and unobstructed record list. Insights is a separate view; ordinary page/filter navigation no longer invokes treasury aggregation or historical chart reads. The table, insights and CSV share effective date filters using Sydney calendar boundaries. |
| Pagination required repeated clicking, and some routes ignored the selected row count. | Added labeled Go to page inputs with Enter/Go submission, validation and clear totals. Ledger pagination appears above and below entries. Row sizes now work consistently across supported routes; filters survive navigation and empty/out-of-range pages have a recovery path. |

## Verification

- `npm run build`: production compilation, TypeScript and route generation.
- `npm run test:admin`: 49 passing offline regressions covering rendered dashboard/sidebar behavior, popover positioning, nested-dialog scroll restoration, authorization, a 1,205-row export under a simulated 200-row API cap, mobile editor submissions/errors, direct page jumps and row sizing, selected Treasury panes, Ledger view loading and Sydney date boundaries.
- `npm run test:converter`: 106 existing converter assertions passed.
- `npm run test:bank-fees`: all 16 existing PostgreSQL/input-validation tests passed.
- `node scripts/test-language-paths.cjs`: existing bilingual navigation checks passed.
- Focused ESLint checks for new/changed UI and test files; CSS parsing and whitespace checks.
- Local production HTTP smoke: all 16 checked protected admin URLs, including Ledger Insights, deep pagination and Treasury subsections, redirect anonymous requests to login; login responds successfully with its password field and noindex header. Compiled admin-theme assets were also verified during the initial audit.

The tests use controlled inputs and local fixtures. They do not establish measured production latency or replace browser rendering/interaction checks. This session reported no connected browsers/apps, and opening the in-app browser was unavailable. Desktop/mobile screenshots and authenticated end-to-end browser validation therefore remain unverified.

## Follow-up checks

When an authenticated browser is available, verify the dashboard, mobile navigation and ledger/treasury/reports at 360px, 768px, 1024px and 1440px, plus 200% zoom. Exercise long account names, calendar month/year dropdowns near table edges, approval dialogs, nested confirmations, keyboard-only navigation, Escape and focus return. Compare production route timings with the previous build before making numerical speed claims.

Also verify mobile transaction Save changes with the software keyboard open, ledger add/edit footers, direct page entry above/below the Ledger, and browser Back/Forward across Treasury workspaces and Ledger Entries/Insights while filters are active.

The existing treasury/ledger accounting rollups still read unpaginated history and may meet the database API's row limit on large datasets. Their accounting algorithms were not redesigned in this UX change. A separate data-completeness review should paginate/reconcile those historical inputs against a known ledger fixture before relying on large-dataset totals. The CSV path addressed here does paginate its complete filtered result.

## Shared implementation

- `styles/admin/AdminTheme.module.css`: portal-safe admin theme.
- `styles/admin/AdminShell.module.css`: navigation, fixed viewport shell and page scroll area.
- `components/admin/ui/AdminDialog.tsx`: common modal/drawer surface.
- `components/admin/ui/admin-dialog-stack.ts`: stacked-dialog lifetime and scroll locks.
- `components/ui/useAnchoredPopover.ts`: anchored popovers with clipping escape and viewport positioning.
- `components/ui/anchored-position.ts`: independently tested placement calculations.
- `app/actions/admin.actions.ts`: scoped read reuse, navigation counters and on-demand ledger export.
- `components/admin/ui/AdminFieldEditor.tsx`: shared accessible transaction field editor.
- `components/admin/treasury/TreasuryWorkspace.tsx`: selected Treasury workspace and quick access.
- `components/admin/ledger/LedgerInsights.tsx`: analytics rendered only in the Insights view.
- `lib/admin-ledger-view.ts`: shared Ledger view links and date filters.
- `lib/admin-pagination.ts`: page validation, row sizes and filter-preserving navigation.

New admin modals should use `AdminDialog`, and floating controls should use the shared anchored-popover hook instead of increasing `z-index` inside a clipped card.

## Performance follow-up — 3 October 2026

The reported production delay was most noticeable when approving requests or changing their status. Code inspection found several avoidable waits:

- Approved status emails and completion PDFs ran before the mutation response returned. The committed request now returns first, with delivery triggered through Next.js `after()` and the existing transactional outbox. Email opt-in, leases, retries and fresh authorization remain enforced. The admin UI reads delivery progress through manual Refresh.
- Request forms waited for a second full detail read after receiving the committed request. They now show the returned version and next action immediately; supplementary records refresh separately. Older reads cannot replace a newer committed version, and overlapping refreshes coalesce into a follow-up read.
- Manual transaction and KYC decisions added a 600 ms timer and reloaded the entire document. They now refresh server data while keeping the admin shell mounted. Deployment-error recovery uses a full reload only when Try again is clicked.
- Transaction refreshes invoked four browser Server Actions. One authenticated workspace action now performs independent database reads in parallel. Active-view requests omit history rows, and inactive table/form trees no longer mount. Server-render reads share authorization only within that request; direct action calls verify authorization again.
- Customer dashboard tabs use URL parameters as client state. Same-path tab links now use the supported native History API without refetching the server route. Full destination parameters, browser history and normal navigation to different routes are preserved.

These changes follow the documented [post-response work](https://nextjs.org/docs/app/api-reference/functions/after), [sequential client dispatch of Server Actions](https://nextjs.org/docs/app/guides/server-actions#sequential-dispatch-on-the-client), and [native History API](https://nextjs.org/docs/app/getting-started/linking-and-navigating#native-history-api) behavior. Existing authentication/bootstrap work and dashboard animations were preserved.

Validation: production build and TypeScript passed; dashboard suite 141/141, request interface 54/54, request service 39/39 and notification suite 18/18 passed. The full admin suite passed 105/106 tests. Its independent OET incoming-report assertion expects a longer beneficiary name than the unchanged reporting/catalogue code produces; the same failure reproduces when run alone. Targeted lint checks passed.

No authenticated browser was available, so these checks establish behavior and removal of known work, not a measured production speedup. After deployment, compare median and 95th-percentile approval-to-next-step latency with email enabled and disabled, confirm delivery completion, and profile treasury navigation separately before changing its accounting reads. Treasury still retrieves its shared snapshot on navigation, and some specialized editors/settings retain full reloads.
