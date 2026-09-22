/* eslint-disable @typescript-eslint/no-require-imports -- Offline recipient validation and directory checks. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { dashboardHarness } = require("./helpers/dashboard-harness.cjs");

const tick = () => new Promise(resolve => setImmediate(resolve));
const markup = tree => renderToStaticMarkup(tree);
function elements(tree, predicate) {
  const found = [];
  function walk(node) {
    if (!React.isValidElement(node)) return;
    if (predicate(node)) found.push(node);
    React.Children.forEach(node.props.children, walk);
    React.Children.forEach(node.props.action, walk);
  }
  walk(tree);
  return found;
}
function textOf(node) {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (!React.isValidElement(node)) return "";
  return React.Children.toArray(node.props.children).map(textOf).join("");
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const aud = {
  direction: "aud", label: "Taylor", bank_name: "Test Australia Bank", account_name: "Taylor",
  bsb: "000123", account_number: "00012345", residential_address: "1 Test Street", residential_city: "Sydney",
  residential_state: "NSW", residential_postcode: "2000", residential_country: "Australia",
  recipient_email: "taylor@example.com", recipient_phone: "0412345678",
};
const irt = {
  direction: "irt", label: "Alex", bank_name: "Test Iran Bank", bank_city: "Tehran", full_name: "Alex",
  shaba_number: "IR820540102680020817909002", irt_address: "Test Street", irt_city: "Shiraz",
  irt_state: "Fars", irt_country: "Iran", irt_phone: "09123456789",
};
const stored = (id, details = aud) => ({ ...details, id, user_id: "owner-a" });

function directoryHarness({ locale = "en", getRecipients = async () => ({ data: [] }) } = {}) {
  let profile = { id: "owner-a" };
  const RecipientModal = () => null;
  const MotionDiv = ({ children, initial, animate, transition, ...props }) => {
    void initial; void animate; void transition;
    return React.createElement("div", props, children);
  };
  const harness = dashboardHarness({ locale, mocks: {
    "./DashboardShell": { useDashboard: () => ({ profile, motionEnabled: false }) },
    "./RecipientModal": { RecipientModal },
    "@/app/actions/transaction.actions": { getRecipients },
    "framer-motion": { useReducedMotion: () => true, motion: { div: MotionDiv, span: require("framer-motion").motion.span } },
  } });
  const { DashboardRecipients } = harness.load("components/dashboard/DashboardRecipients.tsx");
  const render = () => harness.render(DashboardRecipients);
  const cards = () => elements(render(), element => element.props["data-recipient-id"] !== undefined);
  const button = label => elements(render(), element => typeof element.props.onClick === "function" && textOf(element) === label)[0];
  const country = value => elements(render(), element => element.props["data-recipient-country"] === value)[0];
  const search = value => elements(render(), element => element.type === "input" && element.props.type === "search")[0].props.onChange({ target: { value } });
  return { harness, render, cards, button, country, search, RecipientModal,
    owner(id) { profile = { id }; },
    modal() { return elements(render(), element => element.type === RecipientModal)[0]; },
    async load() { render(); harness.effects(); await tick(); },
  };
}

test("recipient validation aggregates editable-field errors without accepting ownership fields", () => {
  const { normalizeRecipientInput: normalize } = dashboardHarness().load("lib/dashboard/recipient-input.ts");
  const result = normalize({ ...aud, bsb: "1", account_number: "4", recipient_email: "bad", recipient_phone: "abc", residential_city: "" });
  assert.equal(result.error, "Complete all required recipient details.");
  assert.deepEqual(Object.keys(result.fieldErrors).sort(), ["account_number", "bsb", "recipient_email", "recipient_phone", "residential_city"]);
  assert.equal(result.fieldErrors.residential_city, "This field is required.");
  assert.equal(result.data, undefined);
  const clean = normalize({ ...irt, user_id: "another-owner", id: "forged", created_at: "forged", irt_account_number: "legacy" }).data;
  assert.equal(clean.user_id, undefined); assert.equal(clean.id, undefined); assert.equal(clean.created_at, undefined);
  assert.equal(clean.irt_account_number, undefined);
  assert.ok(normalize({ ...aud, account_number: 12345 }).fieldErrors.account_number);
  assert.ok(normalize({ direction: "other" }).fieldErrors.direction);
  assert.equal(normalize(null).error, "Invalid recipient details.");
});

test("recipient relationships stay optional for legacy clients and use the same allowed values", () => {
  const { normalizeRecipientInput: normalize } = dashboardHarness().load("lib/dashboard/recipient-input.ts");
  for (const details of [aud, irt]) {
    assert.ok(!Object.hasOwn(normalize(details).data, "relationship"));
    for (const relationship of ["self", "family", "friend", "business", "other", null, ""]) {
      const result = normalize({ ...details, relationship });
      assert.equal(result.error, undefined);
      assert.equal(result.data.relationship, relationship || null);
    }
    for (const relationship of ["employee", "SELF", 1, {}]) {
      assert.ok(normalize({ ...details, relationship }).fieldErrors.relationship);
    }
  }
});

test("Persian and Arabic banking digits normalize as strings while leading zeros and checksum checks survive", () => {
  const { normalizeRecipientInput: normalize, normalizeRecipientDigits, isValidIranianShaba } = dashboardHarness().load("lib/dashboard/recipient-input.ts");
  assert.equal(normalizeRecipientDigits("۰۱۲۳۴۵۶۷۸۹ ٠١٢٣٤٥٦٧٨٩ IR"), "0123456789 0123456789 IR");
  const result = normalize({ ...aud, bsb: "۰۰۰ ۱۲۳", account_number: "٠٠٠ ١٢٣٤٥", residential_postcode: "۲۰۰۰", recipient_phone: "۰۴۱۲۳۴۵۶۷۸" });
  assert.equal(result.error, undefined);
  assert.equal(result.data.bsb, "000123"); assert.equal(result.data.account_number, "00012345");
  assert.equal(result.data.residential_postcode, "2000"); assert.equal(result.data.recipient_phone, "0412345678");
  const shaba = normalize({ ...irt, shaba_number: "ir۸۲ ۰۵۴۰ ۱۰۲۶ ۸۰۰۲ ۰۸۱۷ ۹۰۹۰ ۰۲", card_number: "۰۰۰۰ ۱۲۳۴ ۵۶۷۸ ۹۰۱۲" });
  assert.equal(shaba.data.shaba_number, irt.shaba_number); assert.equal(shaba.data.card_number, "0000123456789012");
  assert.ok(isValidIranianShaba(shaba.data.shaba_number));
  assert.ok(normalize({ ...irt, shaba_number: "IR820540102680020817909003" }).fieldErrors.shaba_number);
  assert.ok(normalize({ ...aud, bsb: "123-456" }).fieldErrors.bsb);
  assert.ok(normalize({ ...aud, account_number: "1e6" }).fieldErrors.account_number);
});

test("Iranian bank city remains independent of residential city with its own length constraint", () => {
  const { normalizeRecipientInput: normalize } = dashboardHarness().load("lib/dashboard/recipient-input.ts");
  const result = normalize({ ...irt, bank_city: " Tehran ", irt_city: " Shiraz " });
  assert.equal(result.data.bank_city, "Tehran"); assert.equal(result.data.irt_city, "Shiraz");
  assert.equal(normalize({ ...irt, bank_city: " " }).data.bank_city, null);
  assert.equal(normalize({ ...irt, bank_city: "x".repeat(120) }).error, undefined);
  const tooLong = normalize({ ...irt, bank_city: "x".repeat(121) });
  assert.equal(tooLong.fieldErrors.bank_city, "Bank branch city must be 120 characters or fewer.");
  assert.equal(normalize({ ...aud, bank_city: "Tehran" }).data.bank_city, undefined);
});

test("recipient create action forwards field errors without writing invalid input or exposing database errors", async () => {
  let inserts = 0, captured;
  const h = dashboardHarness({ mocks: {
    "@supabase/supabase-js": { createClient: () => ({ from: () => ({
      insert(rows) { inserts++; captured = rows; return this; }, select() { return this; },
      single: async () => ({ error: { message: "internal database password SECRET", detail: "SQL internals" } }),
    }) }) },
    "@/lib/supabase-server": { createSupabaseServerActionClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: "authenticated-owner" } } }) } }) },
  } });
  const { createRecipient } = h.load("app/actions/transaction.actions.ts");
  const invalid = await createRecipient({ ...aud, relationship: "invalid", bsb: "1" });
  assert.ok(invalid.fieldErrors.relationship); assert.ok(invalid.fieldErrors.bsb); assert.equal(inserts, 0);
  const failed = await createRecipient({ ...aud, user_id: "forged", relationship: "family" });
  assert.equal(inserts, 1); assert.equal(captured[0].user_id, "authenticated-owner"); assert.equal(captured[0].relationship, "family");
  assert.ok(failed.error); assert.doesNotMatch(JSON.stringify(failed), /SECRET|SQL internals|password/);
});

test("directory distinguishes loading from zero recipients in both languages", async () => {
  for (const locale of ["en", "fa"]) {
    const request = deferred(), h = directoryHarness({ locale, getRecipients: () => request.promise });
    let html = markup(h.render());
    assert.match(html, /role="status"/); assert.equal(h.cards().length, 0);
    assert.doesNotMatch(html, /Your recipients will live here|گیرندگان شما اینجا نمایش داده می‌شوند/);
    h.harness.effects(); request.resolve({ data: [] }); await tick();
    html = markup(h.render());
    assert.match(html, locale === "fa" ? /dir="rtl"/ : /dir="ltr"/);
    assert.match(html, locale === "fa" ? /افزودن اولین گیرنده/ : /Add your first recipient/);
    assert.equal(h.cards().length, 0);
    h.harness.cleanup();
  }
});

test("a single recipient card masks account details and retains the correct transfer direction", async () => {
  for (const locale of ["en", "fa"]) {
    const row = stored("iran-account", { ...irt, full_name: "<script>Alex</script>" });
    const h = directoryHarness({ locale, getRecipients: async () => ({ data: [row] }) });
    await h.load();
    const html = markup(h.render());
    assert.equal(h.cards().length, 1); assert.match(html, /&lt;script&gt;Alex&lt;\/script&gt;/);
    assert.doesNotMatch(html, /<script>|IR820540102680020817909002|Shiraz/);
    assert.match(html, /Tehran/); assert.match(html, /•••• 9002/); assert.match(html, /data-private-value="true"/);
    assert.match(html, new RegExp(`/${locale}/dashboard\\?tab=transfer&amp;requestDirection=sell_aud&amp;recipient=iran-account`));
    h.harness.cleanup();
  }
});

test("many recipient cards filter by country and normalized name or bank without altering source records", async () => {
  const rows = Array.from({ length: 24 }, (_, index) => stored(`recipient-${index}`, index % 2 ? { ...irt, full_name: `Person ${index}` } : { ...aud, account_name: `Person ${index}` }));
  rows[1] = stored("persian-name", { ...irt, full_name: "کیمیا", bank_name: "بانک کیان" });
  const h = directoryHarness({ getRecipients: async () => ({ data: rows }) });
  await h.load(); assert.equal(h.cards().length, 24);
  h.country("aud").props.onClick(); assert.equal(h.cards().length, 12);
  assert.ok(h.cards().every(card => Number(card.props["data-recipient-id"].split("-")[1]) % 2 === 0));
  h.country("irt").props.onClick(); assert.equal(h.cards().length, 12);
  h.search("كيميا"); assert.deepEqual(h.cards().map(card => card.props["data-recipient-id"]), ["persian-name"]);
  h.search("بانك كيان"); assert.equal(h.cards().length, 1);
  h.search("unknown"); assert.equal(h.cards().length, 0); assert.match(markup(h.render()), /No matching recipients/);
  h.button("Reset filters").props.onClick(); assert.equal(h.cards().length, 24);
  h.search("TEST AUSTRALIA BANK"); assert.equal(h.cards().length, 12);
  assert.equal(rows.length, 24); assert.equal(rows[1].full_name, "کیمیا");
  h.harness.cleanup();
});

test("directory network failures provide a retry without presenting a false empty address book", async () => {
  let attempts = 0;
  const h = directoryHarness({ getRecipients: async () => {
    if (++attempts === 1) throw Error("private transport detail");
    return { data: [stored("recovered")] };
  } });
  await h.load();
  let html = markup(h.render());
  assert.match(html, /role="alert"/); assert.doesNotMatch(html, /private transport detail|Add your first recipient/);
  h.button("Try again").props.onClick();
  html = markup(h.render()); assert.match(html, /Loading your recipients/);
  h.harness.effects(); await tick();
  assert.equal(attempts, 2); assert.equal(h.cards().length, 1); assert.doesNotMatch(markup(h.render()), /role="alert"/);
  h.harness.cleanup();
});

test("a newly saved recipient survives a stale directory response and is not duplicated", async () => {
  const request = deferred(), h = directoryHarness({ getRecipients: () => request.promise });
  h.render(); h.harness.effects();
  h.button("Add recipient").props.onClick();
  const callback = h.modal().props.onCreated, saved = stored("new-recipient");
  callback(saved); callback(saved);
  assert.equal(h.cards().length, 1); assert.equal(h.cards()[0].props["data-selected"], true);
  request.resolve({ data: [stored("stale")] }); await tick();
  assert.deepEqual(h.cards().map(card => card.props["data-recipient-id"]), ["new-recipient"]);
  assert.match(markup(h.render()), /Recipient saved/);
  h.harness.cleanup();
});

test("account changes hide previous records immediately and ignore old reads and save callbacks", async () => {
  const reads = [deferred(), deferred()]; let calls = 0;
  const h = directoryHarness({ getRecipients: () => reads[calls++].promise });
  h.render(); h.harness.effects(); h.button("Add recipient").props.onClick();
  const staleSave = h.modal().props.onCreated;
  h.owner("owner-b");
  assert.equal(h.modal(), undefined); assert.equal(h.cards().length, 0);
  assert.match(markup(h.render()), /Loading your recipients/);
  h.harness.effects();
  reads[1].resolve({ data: [{ ...stored("owner-b-account"), user_id: "owner-b" }] }); await tick();
  reads[0].resolve({ data: [stored("owner-a-account")] }); staleSave(stored("late-save")); await tick();
  assert.deepEqual(h.cards().map(card => card.props["data-recipient-id"]), ["owner-b-account"]);
  h.button("Add recipient").props.onClick(); h.modal().props.onCreated(stored("wrong-owner"));
  assert.deepEqual(h.cards().map(card => card.props["data-recipient-id"]), ["owner-b-account"]);
  h.harness.cleanup();
});

test("unmount cancels pending directory reads and blocks late recipient creation callbacks", async () => {
  const request = deferred(), h = directoryHarness({ getRecipients: () => request.promise });
  h.render(); h.harness.effects(); h.button("Add recipient").props.onClick();
  const lateSave = h.modal().props.onCreated;
  h.harness.cleanup();
  const stateBefore = JSON.stringify(h.harness.values);
  request.resolve({ data: [stored("late-read")] }); lateSave(stored("late-created")); await tick();
  assert.equal(JSON.stringify(h.harness.values), stateBefore);
});

test("relationship migration is additive, idempotent and enforces the enum on a local database", async () => {
  const { PGlite } = require("@electric-sql/pglite");
  const db = new PGlite();
  try {
    await db.exec("CREATE TABLE public.recipients (id integer primary key, irt_city text); INSERT INTO recipients VALUES (1, 'Shiraz');");
    const sql = fs.readFileSync("supabase/migrations/20260921_34_recipient_relationship.sql", "utf8");
    await db.exec(sql); await db.exec(sql);
    assert.deepEqual((await db.query("SELECT * FROM recipients")).rows, [{ id: 1, irt_city: "Shiraz", relationship: null }]);
    for (const relationship of ["self", "family", "friend", "business", "other", null]) {
      await db.query("UPDATE recipients SET relationship=$1 WHERE id=1", [relationship]);
    }
    for (const relationship of ["employee", "", "SELF", "business-extra"]) {
      await assert.rejects(db.query("UPDATE recipients SET relationship=$1 WHERE id=1", [relationship]), /recipients_relationship_allowed/);
    }
    assert.equal((await db.query("SELECT irt_city FROM recipients WHERE id=1")).rows[0].irt_city, "Shiraz");
  } finally { await db.close(); }
});
