/* eslint-disable @typescript-eslint/no-require-imports -- Offline component regression tests. */
const assert = require("node:assert/strict");
const test = require("node:test");
const React = require("react");
const { renderToStaticMarkup: markup } = require("react-dom/server");
const { dashboardHarness } = require("./helpers/dashboard-harness.cjs");

function nodes(tree, match) {
  if (!tree || typeof tree !== "object") return [];
  return [...(match(tree) ? [tree] : []), ...React.Children.toArray(tree.props?.children).flatMap(child => nodes(child, match))];
}
const text = tree => typeof tree === "string" || typeof tree === "number" ? String(tree) : React.Children.toArray(tree?.props?.children).map(text).join("");
const button = (tree, label) => nodes(tree, node => node.type === "button" && text(node) === label)[0];
const dialog = { AdminDialog: ({ children, labelledBy, dismissible }) => React.createElement("section", { role: "dialog", "aria-labelledby": labelledBy, "data-dismissible": dismissible }, children) };

for (const status of ["pending", "approved"]) test(`identity View displays saved customer and document details for ${status} records`, () => {
  const h = dashboardHarness({ mocks: {
    "./AdminDialog": dialog,
    "./KycActionButtons": { KycActionButtons: ({ userId, currentStatus }) => React.createElement("button", { "data-user": userId, "data-status": currentStatus }, "Review") },
    "./EditableCustomerCode": { EditableCustomerCode: ({ currentCode }) => React.createElement("button", null, currentCode) },
  } });
  const { IdentityVerificationTable } = h.load("components/admin/IdentityVerificationTable.tsx");
  const props = { emptyMessage: "No customers awaiting review.", users: [{ id: "user-test", first_name: "Example", last_name: "Customer", customer_code: "CZ00123", kyc_status: status, document_type: "driver_license", license_number: "001234", card_number: "00099", expiry_date: "2029-01-01", dob: "1990-01-01", address: "Example street", city: "Sydney", mobile_number: "0400000000", state_of_issue: "NSW", email: "example@example.test", created_at: "2026-09-27T00:00:00Z" }] };
  let tree = h.render(IdentityVerificationTable, props);
  const html = markup(tree);
  assert.match(html, /<strong><bdi>Example Customer/);
  assert.ok(html.includes(`data-user="user-test" data-status="${status}"`));
  assert.match(html, /href="\/admin\/users\?userId=user-test"/);
  assert.doesNotMatch(html, /001234/);
  button(tree, "View").props.onClick();
  tree = h.render(IdentityVerificationTable, props);
  const opened = markup(tree);
  for (const value of ["001234", "00099", "2029-01-01", "CZ00123", "Example street, Sydney", "1990-01-01", "0400000000"]) assert.ok(opened.includes(value));
  assert.match(opened, /role="dialog"/);
  assert.equal(nodes(tree, node => node.type?.name === "AdminRecordDrawer").length, 1);
});

test("audit details preserve full identifiers and false/zero JSON values without edit actions", () => {
  const h = dashboardHarness({ mocks: { "./AdminDialog": dialog } });
  const { AuditLogTable } = h.load("components/admin/AuditLogTable.tsx");
  const props = { total: 1, logs: [{ id: "audit-test", action: "UPDATE_TRANSACTION", target_type: "transaction", target_id: "full-record-id-0123456789", actor_email: "admin@example.test", actor_is_admin: true, created_at: "2026-09-27T00:00:00Z", old_value: false, new_value: { amount: 0, reference: "00123", detail: "a".repeat(400) } }] };
  let tree = h.render(AuditLogTable, props);
  assert.deepEqual(nodes(tree, node => node.type === "button").map(text), ["View changes"]);
  button(tree, "View changes").props.onClick();
  tree = h.render(AuditLogTable, props);
  const html = markup(tree);
  assert.match(html, /full-record-id-0123456789/);
  assert.match(html, />false<\/pre>/);
  assert.match(html, /&quot;amount&quot;: 0/);
  assert.ok(html.includes("a".repeat(400)));
  assert.match(html, /Administrator/);
  assert.match(markup(h.render(AuditLogTable, { logs: [], total: 0 })), /No audit log entries yet/);
});

test("customer search preserves submit and profile callbacks and distinguishes initial/empty results", () => {
  const h = dashboardHarness();
  const { UserSearchPanel } = h.load("components/admin/users/UserSearchPanel.tsx");
  let searched = 0, opened = null;
  const props = { query: "Example", onQueryChange() {}, onSearch: () => searched++, onViewProfile: id => opened = id, isSearching: false, isLoadingProfile: false, searched: false, results: [] };
  assert.match(markup(h.render(UserSearchPanel, props)), /Find a customer/);
  assert.match(markup(h.render(UserSearchPanel, { ...props, searched: true })), /No customers found matching/);
  const rowProps = { ...props, searched: true, results: [{ id: "user-test", first_name: "Example", last_name: "Customer", customer_code: "CZ00123", kyc_status: "approved", created_at: "2026-09-27" }] };
  let tree = h.render(UserSearchPanel, rowProps);
  nodes(tree, node => node.type === "form")[0].props.onSubmit({ preventDefault() {} });
  assert.equal(searched, 1);
  button(tree, "Open profile").props.onClick();
  assert.equal(opened, "user-test");
  tree = h.render(UserSearchPanel, { ...rowProps, isSearching: true, isLoadingProfile: true });
  assert.equal(button(tree, "Open profile").props.disabled, true);
  nodes(tree, node => node.type === "form")[0].props.onSubmit({ preventDefault() {} });
  assert.equal(searched, 1);
});

const row = { id: "ledger-test", transaction_id: "transaction-test", date_gregorian: "2026-09-27", date_jalali: "1405-07-05", type: "buy_aud", entry_type: "trade", exchange_rate: 104650.5, amount_aud: 1000, amount_toman: 104650500, payer_account_id: "irt", receiver_account_id: "aud", sender: "Example sender", recipient: "Example recipient", fee_aud: 0, notes: "Entry notes" };
function ledgerUi(actions = {}, rows = [row]) {
  const calls = { update: [], add: [], remove: [], reload: [], toast: [], confirm: [] };
  const h = dashboardHarness({ mocks: {
    "./AdminDialog": dialog,
    "@/app/actions/admin.actions": {
      updateLedgerEntry: async (...args) => { calls.update.push(args); return actions.update?.(...args) ?? { success: true }; },
      addManualLedgerEntry: async (...args) => { calls.add.push(args); return actions.add?.(...args) ?? { success: true }; },
      deleteLedgerEntry: async (...args) => { calls.remove.push(args); return actions.remove?.(...args) ?? { success: true }; },
    },
    "@/components/admin/ui/useAdminFeedback": { useAdminFeedback: () => ({ confirm: props => calls.confirm.push(props), showToast: props => calls.toast.push(props), dialogProps: {}, toastProps: {} }) },
    "@/components/admin/ui/AdminConfirmDialog": { AdminConfirmDialog: () => null },
    "@/components/admin/ui/AdminToast": { AdminToast: () => null },
    "@/components/ui/SelectBox/SelectBox": { SelectBox: () => null },
    "@/components/ui/DatePicker/CustomDatePicker": { __esModule: true, default: () => null },
    "@/components/admin/ui/useAdminRefresh": { useAdminRefresh: () => () => calls.reload.push("refresh") },
  } });
  const { LedgerEntriesTable } = h.load("components/admin/ledger/LedgerEntriesTable.tsx");
  const props = { rows, bankAccounts: [{ id: "irt", currency: "IRT", account_name: "Melli" }, { id: "aud", currency: "AUD", account_name: "Cash" }, { id: "credit", currency: "AUD", account_name: "Customer Credit_AUD" }] };
  const render = () => h.render(LedgerEntriesTable, props);
  const field = label => nodes(render(), node => node.type === "label" && text(node).startsWith(label))[0];
  return { calls, render,
    open: () => button(render(), "Edit").props.onClick(),
    field: label => nodes(field(label), node => node.type === "input")[0],
    set: (label, value) => nodes(field(label), node => node.type === "input")[0].props.onChange({ target: { value } }),
    select: placeholder => nodes(render(), node => node.props.placeholder === placeholder)[0],
    submit: () => nodes(render(), node => node.type === "form")[0].props.onSubmit({ preventDefault() {} }),
  };
}

test("ledger edit retains exact values and account rules while switching type keeps entered amounts", () => {
  const ui = ledgerUi(); ui.open();
  assert.equal(ui.field("Exchange rate").props.value, "104650.5");
  assert.equal(ui.field("Sender").props.value, "Example sender");
  assert.deepEqual(ui.select("Paying account").props.labeledOptions.map(option => option.value), ["", "irt", "credit"]);
  ui.set("AUD amount", "1,250");
  ui.select("Entry type").props.onChange("sell_aud");
  assert.equal(ui.field("AUD amount").props.value, "1,250");
  assert.equal(ui.select("Paying account").props.value, "");
  assert.equal(ui.select("Receiving account").props.value, "");
  assert.ok(ui.select("Receiving account").props.labeledOptions.some(option => option.value === "credit"));
});

test("ledger blocks malformed amounts and invalid dates before calling a server action", async () => {
  const ui = ledgerUi(); ui.open();
  ui.set("AUD amount", "1,2oops"); await ui.submit();
  assert.match(markup(ui.render()), /Enter valid amounts/);
  assert.equal(ui.calls.update.length, 0);
  ui.set("AUD amount", "1250");
  ui.select("Entry date").props.onChange("2026-02-31"); await ui.submit();
  assert.match(markup(ui.render()), /Choose a valid entry date/);
  assert.equal(ui.calls.update.length, 0);
});

test("ledger prevents repeated submissions, retains failed drafts, and refreshes only after a successful save", async () => {
  let finish;
  let pending = true;
  const ui = ledgerUi({ update: () => pending ? new Promise(resolve => finish = resolve) : { success: true } });
  ui.open(); ui.set("AUD amount", "1,250");
  const submission = ui.submit();
  await ui.submit();
  assert.equal(ui.calls.update.length, 1);
  assert.equal(nodes(ui.render(), node => node.type === "fieldset")[0].props.disabled, true);
  assert.equal(nodes(ui.render(), node => node.type?.name === "AdminRecordDrawer")[0].props.busy, true);
  finish({ error: "Synthetic save failure" }); await submission;
  assert.equal(ui.field("AUD amount").props.value, "1,250");
  assert.match(markup(ui.render()), /role="alert"[^>]*>Synthetic save failure/);
  assert.equal(ui.calls.reload.length, 0);
  pending = false; await ui.submit();
  assert.equal(ui.calls.update[1][1].amount_aud, 1250);
  assert.equal(ui.calls.update[1][1].exchange_rate, 104650.5);
  assert.equal(ui.calls.reload.length, 1);
  assert.equal(nodes(ui.render(), node => node.type === "form").length, 0);
});

test("adding an internal transfer requires separate accounts and retains the existing server payload", async () => {
  const ui = ledgerUi(); button(ui.render(), "Add entry").props.onClick();
  ui.select("Entry type").props.onChange("transfer"); ui.set("AUD amount", "500");
  ui.select("Paying account").props.onChange("aud"); ui.select("Receiving account").props.onChange("aud");
  await ui.submit();
  assert.equal(ui.calls.add.length, 0);
  assert.match(markup(ui.render()), /two different bank accounts/);
  ui.select("Receiving account").props.onChange("credit"); await ui.submit();
  assert.equal(ui.calls.add[0][0].entry_type, "transfer");
  assert.equal(ui.calls.add[0][0].amountAud, 500);
  assert.equal(ui.calls.add[0][0].amountToman, 0);
});

test("ledger deletion requires confirmation and failed deletion does not reload; non-trade records stay read-only", async () => {
  const ui = ledgerUi({ remove: () => ({ error: "Synthetic delete failure" }) });
  button(ui.render(), "Delete").props.onClick();
  assert.equal(ui.calls.remove.length, 0);
  await ui.calls.confirm[0].onConfirm();
  assert.deepEqual(ui.calls.remove, [["ledger-test"]]);
  assert.equal(ui.calls.toast[0].message, "Synthetic delete failure");
  assert.equal(ui.calls.reload.length, 0);
  const readOnly = ledgerUi({}, [{ ...row, entry_type: "expense" }]);
  assert.equal(button(readOnly.render(), "Edit"), undefined);
  assert.equal(button(readOnly.render(), "Delete"), undefined);
  button(readOnly.render(), "View").props.onClick();
  assert.match(markup(readOnly.render()), /Entry notes/);
});
