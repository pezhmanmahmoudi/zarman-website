# Shared admin tables

Transactions, Identity Verification, Customers, Ledger and Audit Log now use the same components:

- `components/admin/ui/AdminDataTable.tsx`: semantic table, labeled mobile rows, bold identities, English/Sydney dates and status badges.
- `components/admin/ui/AdminRecordDrawer.tsx`: shared details/editor layout using the existing accessible `AdminDialog` for focus management, Escape and scroll containment.
- `styles/admin/AdminWorkspace.module.css`: common spacing, headers, search/filter controls, actions, drawers and responsive layout. `AdminTable.module.css` remains the shared base and supplies existing approval action styles.

The table switches to labeled cards based on its available container width. Controls remain in the same DOM on mobile and desktop. Actions have visible labels and do not move on hover. Transaction and KYC approval/rejection/archive controls stay directly available where their workflows permit them; transaction email shortcuts are preserved.

Identity verification keeps its review queue and paginated history. Customer search still opens the existing financial profile; profile transaction and feedback tables use the same primitives. Audit details display full before/after JSON and record identifiers in a read-only drawer.

Ledger now has one add/edit drawer for all screen sizes. It keeps the existing authorized server actions, account filters, CSV export, pagination and Insights view. Amount/date validation, duplicate-submit protection, inline server errors and deletion confirmation protect editing. Expense, owner-loan and adjustment entries remain read-only here.

Removed unused replacements: `EditableLedgerTable`, `LedgerDrillDown`, `UserQuickFinder`, their unused styles, and the transaction-specific workspace stylesheet. New table work should extend the shared primitives rather than copy another layout.

Verification: `npm run test:admin` includes focused shared-table regressions alongside authorization, workflow, pagination and editing tests. Production build, TypeScript and scoped ESLint checks are run locally. Browser visual review is omitted at the user's request. These changes require no SQL migration or deployment.
