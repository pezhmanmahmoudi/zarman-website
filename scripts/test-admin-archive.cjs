/* eslint-disable @typescript-eslint/no-require-imports -- Offline server action and UI fault injection. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const ts = require("typescript");
const React = require("react");
const { dashboardHarness } = require("./helpers/dashboard-harness.cjs");

function archiveService(options = {}) {
  const state = { profile: { id: "fixture-customer", kyc_status: "pending" }, writes: 0, audits: [], logs: [], ...options };
  const service = { from(table) {
    if (table === "audit_logs") return { insert: async rows => {
      state.audits.push(...rows);
      return { error: state.auditFails ? { message: "Audit unavailable" } : null };
    } };
    assert.equal(table, "profiles");
    const query = { filters: [], patch: null,
      select() { return this; },
      eq(column, value) { this.filters.push([column, value]); return this; },
      is(column, value) { this.filters.push([column, value]); return this; },
      update(patch) { this.patch = patch; return this; },
      async maybeSingle() {
        if (!this.patch) return { data: state.profile ? { ...state.profile } : null, error: state.readError ?? null };
        state.writes++;
        state.beforeUpdate?.(state);
        if (state.writeError) return { data: null, error: state.writeError };
        if (!state.profile || this.filters.some(([column, value]) => state.profile[column] !== value)) return { data: null, error: null };
        Object.assign(state.profile, this.patch);
        return { data: { ...state.profile }, error: null };
      },
    };
    return query;
  } };
  const session = {
    auth: { getUser: async () => ({ data: { user: state.unauthenticated ? null : { id: "admin", email: "admin@example.test", app_metadata: { role: state.role ?? "admin" } } }, error: null }) },
    from: () => ({ select: () => ({ limit: async () => ({ error: null }) }) }),
  };
  const dependencies = {
    "@supabase/supabase-js": { createClient: () => service },
    "@/lib/supabase-server": { createSupabaseServerComponentClient: async () => session },
    react: { cache: fn => fn }, "next/cache": { revalidateTag() {} },
    "@/lib/rates": {}, "@/lib/pricing": {}, "@/lib/jalali": {}, "@/lib/iran-bank-transfer-fees": {},
    "@/lib/requests/receipt-upload": { REQUEST_RECEIPTS_BUCKET: "receipts" },
  };
  const source = fs.readFileSync(path.join(__dirname, "../app/actions/admin.actions.ts"), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const loaded = { exports: {} };
  vm.runInNewContext(js, {
    require: id => { if (!(id in dependencies)) throw Error(`Unexpected dependency ${id}`); return dependencies[id]; },
    module: loaded, exports: loaded.exports, process: { env: {} },
    console: { error: (...args) => state.logs.push(args) },
  });
  return { state, archive: loaded.exports.archiveKyc };
}

test("KYC archive confirms the changed row and records the verified before/after status", async () => {
  const { archive, state } = archiveService();
  assert.equal((await archive("fixture-customer", "pending")).success, true);
  assert.equal(state.profile.kyc_status, "archived");
  assert.equal(state.writes, 1);
  assert.equal(state.audits.length, 1);
  const audit = state.audits[0];
  assert.equal(audit.action, "KYC_ARCHIVED");
  assert.equal(audit.actor_id, "admin");
  assert.equal(audit.target_id, "fixture-customer");
  assert.equal(audit.old_value.kyc_status, "pending");
  assert.equal(audit.new_value.kyc_status, "archived");
  assert.equal((await archive("fixture-customer", "pending")).success, true);
  assert.equal(state.writes, 1, "already archived is an idempotent success");
  assert.equal(state.audits.length, 1);
});

test("missing profiles and failed reads cannot report archive success or write anything", async () => {
  for (const options of [{ profile: null }, { readError: { message: "Read unavailable" } }]) {
    const { archive, state } = archiveService(options);
    assert.ok((await archive("fixture-customer", "pending")).error);
    assert.equal(state.writes, 0);
    assert.equal(state.audits.length, 0);
  }
});

test("stale UI status or an intervening status change cannot overwrite a new KYC decision", async () => {
  const stale = archiveService({ profile: { id: "fixture-customer", kyc_status: "approved" } });
  assert.match((await stale.archive("fixture-customer", "pending")).error, /status has changed/);
  assert.equal(stale.state.writes, 0);
  const race = archiveService({ beforeUpdate: state => { state.profile.kyc_status = "approved"; } });
  assert.match((await race.archive("fixture-customer", "pending")).error, /record has changed/);
  assert.equal(race.state.profile.kyc_status, "approved");
  assert.equal(race.state.audits.length, 0);
});

test("failed writes and concurrent deletion never report success or create an archive audit", async () => {
  for (const options of [{ writeError: { message: "Write unavailable" } }, { beforeUpdate: state => { state.profile = null; } }]) {
    const { archive, state } = archiveService(options);
    assert.ok((await archive("fixture-customer", "pending")).error);
    assert.equal(state.audits.length, 0);
  }
});

test("a committed archive with failed audit logging returns a warning without inviting another write", async () => {
  const { archive, state } = archiveService({ auditFails: true });
  const result = await archive("fixture-customer", "pending");
  assert.equal(result.success, true);
  assert.match(result.warning, /was archived.*audit entry/);
  assert.equal(state.profile.kyc_status, "archived");
  assert.equal(state.writes, 1);
  assert.equal(state.audits.length, 2, "bounded audit retry only");
  assert.equal(state.logs.length, 1);
});

test("archive authorization remains enforced before any profile mutation", async () => {
  for (const options of [{ unauthenticated: true }, { role: "customer" }]) {
    const { archive, state } = archiveService(options);
    await assert.rejects(archive("fixture-customer"), /Unauthorized|Forbidden/);
    assert.equal(state.writes, 0);
    assert.equal(state.audits.length, 0);
  }
});

function nodes(tree, match) {
  if (!tree || typeof tree !== "object") return [];
  return [...(match(tree) ? [tree] : []), ...React.Children.toArray(tree.props?.children).flatMap(child => nodes(child, match))];
}
test("archive button sends the displayed status and preserves committed state on an audit warning", async () => {
  const calls = [], notices = [], statuses = [];
  let confirmation;
  const h = dashboardHarness({ mocks: {
    "@/app/actions/admin.actions": { archiveKyc: async (...args) => { calls.push(args); return { success: true, warning: "Archived; audit needs reconciliation." }; } },
    "@/components/admin/ui/useAdminFeedback": { useAdminFeedback: () => ({ confirm: next => { confirmation = next; }, showToast: next => notices.push(next), dialogProps: {}, toastProps: {} }) },
    "@/components/admin/ui/useAdminRefresh": { useAdminRefresh: () => () => calls.push("refresh") },
    "@/components/admin/ui/AdminConfirmDialog": { AdminConfirmDialog: () => null },
    "@/components/admin/ui/AdminToast": { AdminToast: () => null },
  } });
  const { KycActionButtons } = h.load("components/admin/KycActionButtons.tsx");
  const tree = h.render(KycActionButtons, { userId: "fixture-customer", currentStatus: "pending", onCommitted: next => statuses.push(next) });
  nodes(tree, node => node.props.title === "Archive — incomplete/abandoned")[0].props.onClick();
  await confirmation.onConfirm();
  assert.deepEqual(calls, [["fixture-customer", "pending"], "refresh"]);
  assert.deepEqual(statuses, ["archived"]);
  assert.equal(notices[0].type, "warning");
  assert.equal(notices[0].duration, 10000);
  h.cleanup();
});

test("customer profile sends its current status and a later identity edit cannot undo a confirmed archive", async () => {
  const committed = [], saves = [];
  const mocks = {
    "@/app/actions/admin.actions": { updateUserIdentityKycProfile: async payload => { saves.push(payload); return { success: true }; } },
    "@/components/admin/ui/useAdminTransition": { useAdminTransition: () => [false, callback => callback()] },
    "@/components/ui/SelectBox/SelectBox": { SelectBox: () => null },
    "@/components/ui/DatePicker/CustomDatePicker": { __esModule: true, default: () => null },
    "@/components/dashboard/AustralianLocationFields": { AustralianLocationFields: () => null },
  };
  for (const name of ["KycActionButtons", "EditableCustomerCode", "ComplianceCheckButtons", "CustomerKycEvidence"]) {
    mocks[`@/components/admin/${name}`] = { [name]: () => null };
  }
  const h = dashboardHarness({ mocks });
  const { UserKycManager } = h.load("components/admin/users/UserKycManager.tsx");
  const props = { profile: { id: "fixture-customer", kyc_status: "pending" }, onKycStatusCommitted: status => committed.push(status) };
  let tree = h.render(UserKycManager, props);
  const actions = nodes(tree, node => node.props.onCommitted)[0];
  assert.equal(actions.props.currentStatus, "pending");
  actions.props.onCommitted("archived");
  assert.deepEqual(committed, ["archived"]);
  nodes(tree, node => node.type === "button" && React.Children.toArray(node.props.children).includes("Edit Details"))[0].props.onClick();
  tree = h.render(UserKycManager, { ...props, profile: { ...props.profile, kyc_status: "archived" } });
  await nodes(tree, node => node.type === "button" && React.Children.toArray(node.props.children).includes("Save Identity/KYC"))[0].props.onClick();
  assert.equal(saves.length, 1);
  assert.equal(saves[0].kyc_status, "archived");
  h.cleanup();
});
