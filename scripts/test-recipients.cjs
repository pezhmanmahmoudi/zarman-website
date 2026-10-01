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
  direction: "aud", label: "Taylor", bank_name: "Test Australia Bank", bank_city: "Sydney", account_name: "Taylor",
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

test("overview recipient preview keeps at most two names and never exposes bank numbers", async () => {
  const h = dashboardHarness({ mocks: {
    "@/app/actions/transaction.actions": { getRecentRecipients: async () => ({ data: [stored("a", { ...aud, account_name: "Newest" }), stored("b", { ...irt, full_name: "Next" }), stored("c", { ...aud, account_name: "Oldest" })] }) },
  } });
  const { DashboardOverviewRecipients } = h.load("components/dashboard/DashboardOverviewRecipients.tsx");
  const props = { locale: "en", ownerId: "owner-a", motionEnabled: false };
  h.render(DashboardOverviewRecipients, props); h.effects(); await tick();
  const html = markup(h.render(DashboardOverviewRecipients, props));
  assert.match(html, /Newest/); assert.match(html, /Next/);
  assert.doesNotMatch(html, /Oldest|00012345|IR820540102680020817909002/);
  assert.match(html, /href="\/en\/dashboard\?tab=recipients"/);
  assert.match(html, /requestDirection=buy_aud&amp;recipient=a/);
  assert.match(html, /requestDirection=sell_aud&amp;recipient=b/);
  assert.equal((html.match(/Send money/g) || []).length, 2);
  assert.match(html, /data-lottie-scene="recipient-avatar"/);
});

test("empty and single-recipient previews never add placeholder fields", async () => {
  for (const rows of [[], [stored("one")]]) {
    const h = dashboardHarness({ mocks: { "@/app/actions/transaction.actions": { getRecentRecipients: async () => ({ data: rows }) } } });
    const { DashboardOverviewRecipients } = h.load("components/dashboard/DashboardOverviewRecipients.tsx");
    const props = { locale: "fa", ownerId: "owner-a", motionEnabled: false };
    h.render(DashboardOverviewRecipients, props); h.effects(); await tick();
    const html = markup(h.render(DashboardOverviewRecipients, props));
    assert.equal((html.match(/data-recipient-id=/g) || []).length, rows.length);
    assert.doesNotMatch(html, /h-14 rounded-2xl/);
    if (!rows.length) assert.match(html, /هنوز گیرنده‌ای/);
    h.cleanup();
  }
});

const page = (rows, extra = {}) => ({ success: true, data: rows, total: rows.length, page: 1, counts: {
  all: rows.length, aud: rows.filter(row => row.direction === "aud").length, irt: rows.filter(row => row.direction === "irt").length,
}, ...extra });

function directoryHarness({ locale = "en", getRecipientPage = async () => page([]) } = {}) {
  let profile = { id: "owner-a" };
  const calls = [], timers = [];
  const previousWindow = global.window;
  global.window = { setTimeout: fn => timers.push(fn), clearTimeout() {} };
  const RecipientModal = () => null;
  const harness = dashboardHarness({ locale, mocks: {
    "./DashboardShell": { useDashboard: () => ({ profile, motionEnabled: false }) },
    "./RecipientModal": { RecipientModal },
    "@/app/actions/transaction.actions": {
      getRecipientPage: input => { calls.push(input); return getRecipientPage(input); },
      deleteRecipient: async () => ({ success: true }),
    },
  } });
  const { DashboardRecipients } = harness.load("components/dashboard/DashboardRecipients.tsx");
  const cleanup = harness.cleanup;
  harness.cleanup = () => { cleanup(); global.window = previousWindow; };
  const render = () => harness.render(DashboardRecipients);
  const cards = () => elements(render(), element => element.props["data-recipient-id"] !== undefined);
  const button = label => elements(render(), element => typeof element.props.onClick === "function" && textOf(element) === label)[0];
  const country = value => elements(render(), element => element.props.dataKey === "data-recipient-country")[0].props.onChange(value);
  const search = value => elements(render(), element => typeof element.props.onChange === "function" && element.props.clearLabel !== undefined)[0].props.onChange(value);
  return { harness, render, cards, button, country, search, RecipientModal, calls,
    owner(id) { profile = { id }; },
    modal() { return elements(render(), element => element.type === RecipientModal)[0]; },
    // Runs queued effects and the search debounce until the directory request settles.
    async load() { for (let round = 0; round < 3; round++) { render(); harness.effects(); timers.splice(0).forEach(fn => fn()); await tick(); } },
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
  assert.equal(normalize({ ...irt, bank_city: " " }).fieldErrors.bank_city, "This field is required.");
  assert.equal(normalize({ ...irt, bank_city: "x".repeat(120) }).error, undefined);
  const tooLong = normalize({ ...irt, bank_city: "x".repeat(121) });
  assert.equal(tooLong.fieldErrors.bank_city, "Bank branch city must be 120 characters or fewer.");
  assert.equal(normalize({ ...aud, bank_city: "" }).fieldErrors.bank_city, "This field is required.");
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
    const request = deferred(), h = directoryHarness({ locale, getRecipientPage: () => request.promise });
    let html = markup(h.render());
    assert.match(html, /role="status"/); assert.equal(h.cards().length, 0);
    assert.doesNotMatch(html, /Your recipients will live here|گیرندگان شما اینجا نمایش داده می‌شوند/);
    h.harness.effects(); request.resolve(page([])); await tick();
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
    const h = directoryHarness({ locale, getRecipientPage: async () => page([row]) });
    await h.load();
    const html = markup(h.render());
    assert.equal(h.cards().length, 1); assert.match(html, /&lt;script&gt;Alex&lt;\/script&gt;/);
    assert.doesNotMatch(html, /<script>|IR820540102680020817909002|Shiraz/);
    assert.match(html, /Tehran/); assert.match(html, /•••• 9002/); assert.match(html, /data-private-value="true"/);
    assert.match(html, new RegExp(`/${locale}/dashboard\\?tab=transfer&amp;requestDirection=sell_aud&amp;recipient=iran-account`));
    h.harness.cleanup();
  }
});

test("country filters and debounced search are sent to the paged directory and render only server results", async () => {
  const rows = Array.from({ length: 6 }, (_, index) => stored(`recipient-${index}`, index % 2 ? { ...irt, full_name: `Person ${index}` } : { ...aud, account_name: `Person ${index}` }));
  const h = directoryHarness({ getRecipientPage: async ({ direction, search }) => {
    const matches = rows.filter(row => (direction === "all" || row.direction === direction) && (!search || (row.account_name || row.full_name).includes(search)));
    return page(matches, { counts: { all: 6, aud: 3, irt: 3 } });
  } });
  await h.load(); assert.equal(h.cards().length, 6);
  assert.deepEqual(h.calls.at(-1), { direction: "all", search: "", page: 1 });
  h.country("aud"); await h.load();
  assert.deepEqual(h.calls.at(-1), { direction: "aud", search: "", page: 1 });
  assert.deepEqual(h.cards().map(card => card.props["data-recipient-id"]), ["recipient-0", "recipient-2", "recipient-4"]);
  const calls = h.calls.length;
  h.search("Person 2");
  assert.equal(h.calls.length, calls);
  await h.load();
  assert.deepEqual(h.calls.at(-1), { direction: "aud", search: "Person 2", page: 1 });
  assert.deepEqual(h.cards().map(card => card.props["data-recipient-id"]), ["recipient-2"]);
  h.search("unknown"); await h.load();
  assert.equal(h.cards().length, 0); assert.match(markup(h.render()), /No Recipients Found/);
  h.search(""); h.country("irt"); await h.load();
  assert.deepEqual(h.cards().map(card => card.props["data-recipient-id"]), ["recipient-1", "recipient-3", "recipient-5"]);
  assert.equal(rows.length, 6);
  h.harness.cleanup();
});

test("directory network failures provide a retry without presenting a false empty address book", async () => {
  let attempts = 0;
  const h = directoryHarness({ getRecipientPage: async () => {
    if (++attempts === 1) throw Error("private transport detail");
    return page([stored("recovered")]);
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

test("a newly saved recipient refetches the directory, ignores the stale response and is selected once", async () => {
  const reads = [deferred(), deferred()]; let calls = 0;
  const h = directoryHarness({ getRecipientPage: () => reads[calls++].promise });
  h.render(); h.harness.effects();
  h.button("Add recipient").props.onClick();
  const callback = h.modal().props.onCreated, saved = stored("new-recipient");
  callback(saved);
  h.render(); h.harness.effects();
  assert.equal(calls, 2);
  reads[0].resolve(page([stored("stale")])); await tick();
  assert.equal(h.cards().length, 0);
  reads[1].resolve(page([saved, stored("older")])); await tick();
  assert.deepEqual(h.cards().map(card => card.props["data-recipient-id"]), ["new-recipient", "older"]);
  assert.equal(h.cards()[0].props["data-selected"], true);
  assert.match(markup(h.render()), /Recipient saved/);
  h.harness.cleanup();
});

test("account changes hide previous records immediately and ignore old reads and save callbacks", async () => {
  const reads = [deferred(), deferred()]; let calls = 0;
  const h = directoryHarness({ getRecipientPage: () => reads[calls++].promise });
  h.render(); h.harness.effects(); h.button("Add recipient").props.onClick();
  const staleSave = h.modal().props.onCreated;
  h.owner("owner-b");
  assert.equal(h.modal(), undefined); assert.equal(h.cards().length, 0);
  assert.match(markup(h.render()), /Loading your recipients/);
  h.harness.effects();
  reads[1].resolve(page([{ ...stored("owner-b-account"), user_id: "owner-b" }])); await tick();
  reads[0].resolve(page([stored("owner-a-account")])); staleSave(stored("late-save")); await tick();
  assert.deepEqual(h.cards().map(card => card.props["data-recipient-id"]), ["owner-b-account"]);
  h.button("Add recipient").props.onClick(); h.modal().props.onCreated(stored("wrong-owner"));
  assert.deepEqual(h.cards().map(card => card.props["data-recipient-id"]), ["owner-b-account"]);
  h.harness.cleanup();
});

test("unmount cancels pending directory reads and blocks late recipient creation callbacks", async () => {
  const request = deferred(), h = directoryHarness({ getRecipientPage: () => request.promise });
  h.render(); h.harness.effects(); h.button("Add recipient").props.onClick();
  const lateSave = h.modal().props.onCreated;
  h.harness.cleanup();
  const stateBefore = JSON.stringify(h.harness.values);
  request.resolve(page([stored("late-read")])); lateSave(stored("late-created")); await tick();
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
