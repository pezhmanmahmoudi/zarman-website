// Offline tests for the compliance orchestration (screening + request classification + gate)
// using an in-memory fake Supabase client. No network, credentials or database.
// Run: node --test scripts/test-compliance-service.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { test } from "node:test";
import ts from "typescript";

const root = new URL("../", import.meta.url);
function compile(file, mocks = {}) {
  const js = ts.transpileModule(readFileSync(new URL(file, root), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const mod = { exports: {} };
  vm.runInThisContext(`(function(require,module,exports,process){${js}\n})`, { filename: fileURLToPath(new URL(file, root)) })(
    id => { if (id in mocks) return mocks[id]; throw new Error(`Unexpected dependency: ${id}`); }, mod, mod.exports,
    { env: { NEXT_PUBLIC_SUPABASE_URL: "https://fixture.invalid", SUPABASE_SERVICE_ROLE_KEY: "test" } });
  return mod.exports;
}

// ── Minimal in-memory PostgREST-style client ───────────────────────────────────
let counter = 0;
function fakeDb(tables) {
  const uid = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`;
  function from(name) {
    tables[name] ??= [];
    const state = { filters: [], order: null, limit: null, range: null, op: "select", payload: null, single: false, maybe: false };
    const matches = row => state.filters.every(([kind, col, value]) =>
      kind === "eq" ? row[col] === value : kind === "is" ? (row[col] ?? null) === value : kind === "in" ? value.includes(row[col]) : kind === "gte" ? row[col] >= value : true);
    const run = () => {
      let rows;
      if (state.op === "insert") {
        rows = state.payload.map(item => ({ id: uid(), performed_at: new Date(Date.now() + counter).toISOString(), ...item }));
        tables[name].push(...rows);
      } else if (state.op === "upsert") {
        const key = state.onConflict; const existing = tables[name].find(row => row[key] === state.payload[key]);
        if (existing) Object.assign(existing, state.payload); else tables[name].push({ ...state.payload });
        rows = [state.payload];
      } else if (state.op === "update") {
        rows = tables[name].filter(matches); rows.forEach(row => Object.assign(row, state.payload));
      } else if (state.op === "delete") {
        rows = tables[name].filter(matches); tables[name] = tables[name].filter(row => !matches(row)); return { data: rows, error: null };
      } else {
        rows = tables[name].filter(matches);
        if (state.order) rows = [...rows].sort((a, b) => (a[state.order.col] > b[state.order.col] ? 1 : -1) * (state.order.asc ? 1 : -1));
        if (state.range) rows = rows.slice(state.range[0], state.range[1] + 1);
        if (state.limit != null) rows = rows.slice(0, state.limit);
      }
      if (state.single) return rows[0] ? { data: rows[0], error: null } : { data: null, error: { message: "not found" } };
      if (state.maybe) return { data: rows[0] ?? null, error: null };
      return { data: rows, error: null };
    };
    const q = {
      select() { return q; }, eq(c, v) { state.filters.push(["eq", c, v]); return q; }, is(c, v) { state.filters.push(["is", c, v]); return q; },
      in(c, v) { state.filters.push(["in", c, v]); return q; }, gte(c, v) { state.filters.push(["gte", c, v]); return q; },
      order(c, o = {}) { state.order = { col: c, asc: o.ascending !== false }; return q; }, limit(n) { state.limit = n; return q; }, range(a, b) { state.range = [a, b]; return q; },
      maybeSingle() { state.maybe = true; return q; }, single() { state.single = true; return q; },
      insert(p) { state.op = "insert"; state.payload = p; return q; }, update(p) { state.op = "update"; state.payload = p; return q; },
      upsert(p, o) { state.op = "upsert"; state.payload = p; state.onConflict = o?.onConflict; return q; }, delete() { state.op = "delete"; return q; },
      then(resolve, reject) { return Promise.resolve(run()).then(resolve, reject); },
    };
    return q;
  }
  return { from };
}

const matching = compile("lib/compliance/name-matching.ts");
const risk = compile("lib/compliance/risk-category.ts");
let tables;
const supabase = { createClient: () => fakeDb(tables) };
const screening = compile("lib/compliance/screening.ts", { "@supabase/supabase-js": supabase, "@/lib/compliance/name-matching": matching });
const service = compile("lib/compliance/request-compliance.ts", { "@/lib/compliance/risk-category": risk, "@/lib/compliance/screening": screening });

const USER = "11111111-1111-4111-8111-111111111111";
const DFAT = "dfat-import-1";
const PEP = "pep-import-1";

function seed({ declared = false, pepRelation = null } = {}) {
  screening.resetComplianceCaches();
  counter = 0;
  tables = {
    compliance_list_imports: [
      { id: DFAT, kind: "dfat", status: "active", entry_count: 3, latest_control_date: "2026-10-27", created_at: "2026-10-28T00:00:00Z", activated_at: "2026-10-28T00:00:00Z", source_name: "dfat.xlsx", notes: null },
      { id: PEP, kind: "pep_wikidata", status: "active", entry_count: 2, latest_control_date: null, created_at: "2026-10-28T00:00:00Z", activated_at: "2026-10-28T00:00:00Z", source_name: "Wikidata", notes: null },
    ],
    sanctions_entries: [
      { id: "s1", import_id: DFAT, reference: "1941", group_ref: "1941", name: "Hossein SALAMI", name_type: "Primary Name", entry_type: "Individual", dob: "1960", citizenship: "Iran", place_of_birth: "Iran", address: null, listing_information: "IRGC", committees: null, instrument: "Iran regulation", additional_information: null, control_date: "2026-10-27" },
      { id: "s2", import_id: DFAT, reference: "1941a", group_ref: "1941", name: "Hoseyn SALAMI", name_type: "Alias", entry_type: "Individual", dob: "1960", citizenship: "Iran" },
      { id: "s3", import_id: DFAT, reference: "8490", group_ref: "8490", name: "QASEM SOLEIMANI", name_type: "Primary Name", entry_type: "Individual", dob: "1957-03-11", citizenship: "Iran" },
    ],
    pep_entries: [
      { id: "p1", import_id: PEP, wikidata_id: "Q1", name: "Ali Akbar Velayati", is_alias: false, country: "Iran", positions: ["Minister of Foreign Affairs"], dob: "1945", is_current: false },
      { id: "p2", import_id: PEP, wikidata_id: "Q1", name: "Ali Akbar Velayti", is_alias: true, country: "Iran", positions: ["Minister of Foreign Affairs"], dob: "1945", is_current: false },
    ],
    profiles: [{
      id: USER, first_name: "Alex", last_name: "Morgan", dob: "1990-01-01", country: "Australia",
      compliance_dvs_status: "completed", compliance_dvs_method: "vendor_rapidid", compliance_dvs_outcome: "VERIFIED", compliance_dvs_checked_at: "2026-10-01T00:00:00Z",
      pep_self_declared: declared ? false : null, pep_declaration_relation: pepRelation, pep_declaration_details: null, pep_declared_at: declared ? "2026-10-01T00:00:00Z" : null, pep_declaration_source: "customer_form",
    }],
    exchange_requests: [], request_compliance: [], compliance_screenings: [],
  };
}
const addRequest = (id, amount, beneficiary = "Sara Rezaei", extra = {}) => tables.exchange_requests.push({
  id, user_id: USER, status: "under_review", created_at: new Date().toISOString(),
  quote: { raw_amount_aud: amount, sender_snapshot: { name: "Alex Morgan" }, recipient_snapshot: { full_name: beneficiary } }, ...extra,
});
const ensure = id => service.ensureRequestCompliance(fakeDb(tables), id, "admin-1");
const rows = () => tables.compliance_screenings;

test("a clean category A request screens both parties once and has no blockers", async () => {
  seed({ declared: true });
  addRequest("r1", 5_000);
  const view = await ensure("r1");
  assert.equal(view.category, "A");
  assert.deepEqual(view.blockers, []);
  assert.equal(view.customerSanctionsInternal.outcome, "clear");
  assert.equal(view.beneficiarySanctionsInternal.outcome, "clear");
  assert.equal(view.pepVendorRequired, false);
  assert.equal(view.dvs.status, "completed");
  const count = rows().length;
  await ensure("r1");
  assert.equal(rows().length, count, "ensure must be idempotent");
});

test("a sanctions hit on the beneficiary blocks release and escalates to C until an admin clears it", async () => {
  seed({ declared: true });
  addRequest("r1", 500, "Hussein Salami");
  const view = await ensure("r1");
  assert.equal(view.beneficiarySanctionsInternal.outcome, "potential_match");
  assert.equal(view.beneficiarySanctionsInternal.matches[0].listedName, "Hossein SALAMI");
  assert.equal(view.beneficiarySanctionsInternal.matches[0].details["Instrument of designation"], "Iran regulation");
  assert.equal(view.category, "C");
  assert.ok(view.blockers.some(item => /Beneficiary sanctions check.*awaiting admin review/.test(item)));
  assert.ok(view.blockers.some(item => /ECDD approval is required/.test(item)));

  const hit = rows().find(row => row.party === "beneficiary" && row.check_kind === "sanctions");
  Object.assign(hit, { decision: "false_positive", decision_reason: "Different person, DOB and passport checked", decided_by: "admin-1", decided_at: new Date().toISOString() });
  const cleared = await ensure("r1");
  assert.equal(cleared.category, "A");
  assert.deepEqual(cleared.blockers, []);
});

test("a confirmed sanctions match is a hard stop", async () => {
  seed({ declared: true });
  addRequest("r1", 500, "Qasem Soleimani");
  await ensure("r1");
  Object.assign(rows().find(row => row.party === "beneficiary" && row.check_kind === "sanctions"), { decision: "confirmed_match", decision_reason: "Confirmed against DFAT entry" });
  const view = await ensure("r1");
  assert.ok(view.blockers.some(item => /CONFIRMED match/.test(item)));
});

test("a cleared false positive is carried over to later requests for the same people", async () => {
  seed({ declared: true });
  addRequest("r1", 500, "Hussein Salami");
  await ensure("r1");
  Object.assign(rows().find(row => row.party === "beneficiary" && row.check_kind === "sanctions"), { decision: "false_positive", decision_reason: "Verified different person", decided_by: "admin-1", decided_at: new Date().toISOString() });
  addRequest("r2", 600, "Hussein Salami");
  const view = await ensure("r2");
  assert.equal(view.beneficiarySanctionsInternal.outcome, "potential_match");
  assert.equal(view.beneficiarySanctionsInternal.decision, "false_positive");
  assert.match(view.beneficiarySanctionsInternal.decision_reason, /Carried over/);
  assert.deepEqual(view.blockers, []);
});

test("a missing self-declaration blocks release until it is recorded", async () => {
  seed({ declared: false });
  addRequest("r1", 500);
  const view = await ensure("r1");
  assert.ok(view.blockers.some(item => /self-declaration is not on record/.test(item)));
  tables.profiles[0].pep_self_declared = false; tables.profiles[0].pep_declared_at = new Date().toISOString();
  const after = await ensure("r1");
  assert.deepEqual(after.blockers, []);
});

test("a PEP self-declaration of yes escalates to C and needs review, then ECDD approval", async () => {
  seed({ declared: true });
  Object.assign(tables.profiles[0], { pep_self_declared: true, pep_declaration_relation: "family", pep_declaration_details: "Minister, Iran" });
  addRequest("r1", 500);
  const view = await ensure("r1");
  assert.equal(view.category, "C");
  assert.equal(view.pepVendorRequired, true);
  assert.ok(view.blockers.some(item => /declared PEP status/.test(item)));
  assert.ok(view.blockers.some(item => /Vendor PEP check is required/.test(item)));

  Object.assign(rows().find(row => row.method === "self_declaration"), { decision: "confirmed_match", decision_reason: "Brother is a former minister" });
  tables.compliance_screenings.push({ id: "v1", request_id: "r1", party: "customer", check_kind: "combined", method: "vendor_namescan", subject_name: "Alex Morgan", outcome: "clear", decision: null, matches: [], performed_at: new Date(Date.now() + 99_999).toISOString() });
  const confirmed = await ensure("r1");
  assert.equal(confirmed.category, "C");
  assert.deepEqual(confirmed.blockers, ["Category C: Compliance Officer ECDD approval is required."]);
  tables.request_compliance[0].ecdd_status = "approved";
  assert.deepEqual((await ensure("r1")).blockers, []);
});

test("amounts and funding method drive the category; the rolling 12-month total is summed", async () => {
  seed({ declared: true });
  addRequest("bank-12k", 12_000);
  assert.equal((await ensure("bank-12k")).category, "B");
  assert.equal((await ensure("bank-12k")).pepVendorRequired, true);
  tables.request_compliance.find(row => row.request_id === "bank-12k").funding_method = "cash";
  assert.equal((await ensure("bank-12k")).category, "C");

  seed({ declared: true });
  addRequest("old-1", 60_000, "Sara Rezaei", { status: "completed" });
  addRequest("old-2", 30_000, "Sara Rezaei", { status: "completed" });
  addRequest("cancelled", 500_000, "Sara Rezaei", { status: "cancelled" });
  addRequest("now", 9_000);
  const view = await ensure("now");
  assert.equal(view.rolling12mAud, 99_000);
  assert.equal(view.category, "A");
  addRequest("now2", 1_000);
  const next = await ensure("now2");
  assert.equal(next.rolling12mAud, 100_000);
  assert.equal(next.category, "C");
  assert.ok(next.triggers.some(item => item.code === "cumulative_12m"));
});

test("an open request is re-screened when the DFAT list is replaced; a finished one keeps its history", async () => {
  seed({ declared: true });
  addRequest("open", 500); addRequest("done", 500, "Sara Rezaei", { status: "completed" });
  await ensure("open"); await ensure("done");
  const before = rows().length;
  tables.compliance_list_imports[0].id = "dfat-import-2";
  tables.sanctions_entries.forEach(entry => { entry.import_id = "dfat-import-2"; });
  const open = await ensure("open"); const done = await ensure("done");
  assert.equal(open.customerSanctionsInternal.list_import_id, "dfat-import-2");
  assert.equal(done.customerSanctionsInternal.list_import_id, DFAT);
  assert.equal(rows().length, before + 2, "customer + beneficiary DFAT rows for the open request only");
});

test("with no lists loaded the checks fail closed", async () => {
  seed({ declared: true });
  tables.compliance_list_imports = [];
  addRequest("r1", 500);
  const view = await ensure("r1");
  assert.equal(view.customerSanctionsInternal.outcome, "failed");
  assert.ok(view.blockers.some(item => /screening failed/.test(item)));
  assert.match(await service.complianceGateError(fakeDb(tables), "r1", "admin-1"), /Compliance check required/);
});

test("the gate message summarises the first blocker and the count", async () => {
  seed({ declared: false });
  addRequest("r1", 25_000);
  const message = await service.complianceGateError(fakeDb(tables), "r1", "admin-1");
  assert.match(message, /^Compliance check required before this step: /);
  assert.match(message, /\(\+\d+ more; open the Compliance panel\)/);
});

test("PEP matches carry country, positions and source even though the matching index holds names only", async () => {
  seed({ declared: true });
  addRequest("r1", 500, "Ali Akbar Velayti");
  const view = await ensure("r1");
  const hit = view.beneficiaryPepInternal;
  assert.equal(hit.outcome, "potential_match");
  assert.equal(hit.matches[0].listedName, "Ali Akbar Velayati");
  assert.equal(hit.matches[0].details.Country, "Iran");
  assert.match(hit.matches[0].details.Positions, /Minister of Foreign Affairs/);
  assert.match(hit.matches[0].details.Source, /wikidata\.org\/wiki\/Q1/);
  assert.equal(view.category, "C");
  assert.equal(view.pepVendorRequired, true);
});

test("customer and recipient screening skips results that are already current and re-runs on force", async () => {
  seed({ declared: true });
  tables.recipients = [
    { id: "rc1", user_id: USER, full_name: "Hussein Salami", account_name: null, archived_at: null },
    { id: "rc2", user_id: USER, full_name: "Sara Rezaei", account_name: null, archived_at: null },
    { id: "rc3", user_id: USER, full_name: "Qasem Soleimani", account_name: null, archived_at: "2026-01-01T00:00:00Z" },
  ];
  const db = fakeDb(tables);
  const first = await service.ensureRecipientsCompliance(db, USER, "admin-1", { run: true });
  assert.equal(first.length, 2, "archived recipients are not screened");
  assert.equal(first.find(item => item.recipientId === "rc1").sanctions.outcome, "potential_match");
  assert.equal(first.find(item => item.recipientId === "rc2").sanctions.outcome, "clear");
  const count = rows().length;
  await service.ensureRecipientsCompliance(db, USER, "admin-1", { run: true });
  assert.equal(rows().length, count, "second run adds nothing");
  assert.equal((await service.ensureRecipientsCompliance(db, USER, "admin-1", { run: false })).length, 2);
  await service.ensureRecipientsCompliance(db, USER, "admin-1", { run: true, force: true });
  assert.equal(rows().length, count + 4, "force re-runs both checks for both recipients");

  const customer = await service.ensureCustomerCompliance(db, USER, "admin-1", { run: true });
  assert.equal(customer.sanctionsInternal.outcome, "clear");
  const after = rows().length;
  await service.ensureCustomerCompliance(db, USER, "admin-1", { run: true });
  assert.equal(rows().length, after, "current customer results are not duplicated");
});
