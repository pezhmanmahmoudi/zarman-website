/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict"), { test } = require("node:test");
const React = require("react"), { renderToStaticMarkup } = require("react-dom/server");
const { dashboardHarness } = require("./helpers/dashboard-harness.cjs");
const tick = () => new Promise(resolve => setImmediate(resolve));
function elements(tree, predicate) {
  const result = [];
  function walk(node) { if (!React.isValidElement(node)) return; if (predicate(node)) result.push(node); React.Children.forEach(node.props.children, walk); }
  walk(tree); return result;
}
const accounts = [
  { id: "old", user_id: "owner", direction: "aud", label: "Savings", account_name: "Alex Morgan", bank_name: "St George", account_number: "123456789", created_at: "2026-01-01" },
  { id: "new", user_id: "owner", direction: "aud", label: "Daily", account_name: "Alex Morgan", bank_name: "NAB", account_number: "999991234", created_at: "2026-09-01" },
  { id: "iran", user_id: "owner", direction: "irt", label: "Home", full_name: "علی کریمی", bank_name: "Melli", shaba_number: "IR123456780000005678", created_at: "2026-09-02" },
];
function picker(locale = "en", overrides = {}) {
  const h = dashboardHarness({ locale });
  const { TransferRecipientPicker } = h.load("components/dashboard/TransferRecipientPicker.tsx");
  const events = [];
  const props = { recipients: accounts, direction: "aud", locale, selectedId: "", status: "ready", onSelect(id) { events.push(id); props.selectedId = id; }, onAdd() { events.push("add"); }, onAddSelf() { events.push("self"); }, onRetry() { events.push("retry"); }, ...overrides };
  const render = () => h.render(TransferRecipientPicker, props);
  const search = value => elements(render(), node => node.type === "input" && node.props.type === "search")[0].props.onChange({ target: { value } });
  const ids = () => elements(render(), node => node.props["data-recipient-id"]).map(node => node.props["data-recipient-id"]);
  return { h, props, render, search, ids, events };
}

test("recipient rows are bilingual, destination-scoped, masked and explicitly single-select", () => {
  for (const locale of ["en", "fa"]) {
    const p = picker(locale);
    try {
      assert.deepEqual(p.ids(), ["new", "old"]);
      const tree = p.render(), html = renderToStaticMarkup(tree);
      assert.equal(tree.type, "fieldset"); assert.equal(tree.props.dir, locale === "fa" ? "rtl" : "ltr");
      assert.ok(html.includes("AM")); assert.ok(html.includes("•••• 1234")); assert.ok(html.includes("•••• 6789"));
      assert.doesNotMatch(html, /Newest added first|تازه‌ترین حساب‌ها در ابتدا/);
      const cards = elements(tree, n => n.props["data-recipient-id"]);
      assert.deepEqual(cards.map(n => n.props["data-tone"]), ["sky", "violet"]);
      assert.doesNotMatch(html, /999991234|123456789|IR123456780000005678/);
      const radios = elements(tree, n => n.type === "input" && n.props.type === "radio");
      assert.equal(radios.length, 3); assert.equal(radios.filter(n => n.props.checked).length, 0);
      assert.equal(new Set(radios.map(n => n.props.name)).size, 1);
      radios[0].props.onChange();
      assert.deepEqual(p.events, ["new"]);
      assert.equal(elements(p.render(), n => n.type === "input" && n.props.checked)[0].props.value, "new");
      const selectedMarkup = renderToStaticMarkup(p.render());
      assert.doesNotMatch(selectedMarkup, /انتخاب‌شده|>Selected</);
      assert.equal(elements(p.render(), n => String(n.props.className).includes("selectionMark")).length, 1);
      assert.ok(radios.every(n => String(n.props.className).includes("choiceInput")));
      const self = elements(tree, n => n.type === "button" && n.props.onClick === p.props.onAddSelf)[0];
      assert.match(self.props.className, /_self/);
      assert.equal(elements(self, n => String(n.props.className).includes("addMark") && n.props["aria-hidden"] === "true").length, 1);
      assert.ok(renderToStaticMarkup(self).includes(locale === "fa" ? "افزودن حساب من در استرالیا" : "Add my account in Australia"));
      assert.equal(elements(tree, n => n.type === "select").length, 0);
    } finally { p.h.cleanup(); }
  }
});

test("search normalizes Persian letters and digits, preserves selection and never searches the other destination", () => {
  const p = picker("fa", { selectedId: "old" });
  try {
    p.search("۱۲۳۴"); assert.deepEqual(p.ids(), ["new"]);
    assert.equal(p.props.selectedId, "old");
    assert.match(renderToStaticMarkup(p.render()), /گیرندهٔ انتخاب‌شده/);
    p.search("nAb"); assert.deepEqual(p.ids(), ["new"]);
    p.search("Savings"); assert.deepEqual(p.ids(), ["old"]);
    p.search("Melli"); assert.deepEqual(p.ids(), []);
    p.props.direction = "irt"; p.search("علي كريمي"); assert.deepEqual(p.ids(), ["iran"]);
    p.search("۵۶۷۸"); assert.deepEqual(p.ids(), ["iran"]);
  } finally { p.h.cleanup(); }
});

test("long lists scroll without hiding a selected account; special actions remain separate", () => {
  const many = Array.from({ length: 12 }, (_, index) => ({ ...accounts[0], id: String(index), created_at: `2026-09-${String(12 - index).padStart(2, "0")}` }));
  const p = picker("en", { recipients: many, selectedId: "11" });
  try {
    assert.equal(p.ids().length, 12); assert.ok(p.ids().includes("11"));
    assert.equal(elements(p.render(), n => n.props["data-scrollable"] !== undefined)[0].props["data-scrollable"], true);
    assert.equal(elements(p.render(), n => n.type === "button" && n.props.children === "Show more recipients").length, 0);
    const buttons = elements(p.render(), n => n.type === "button");
    buttons.find(n => n.props.onClick === p.props.onAdd).props.onClick();
    buttons.find(n => n.props.onClick === p.props.onAddSelf).props.onClick();
    elements(p.render(), n => n.type === "input" && n.props.value === "__edu_exam__")[0].props.onChange();
    assert.deepEqual(p.events, ["add", "self", "__edu_exam__"]);
    p.props.disabled = true; assert.equal(p.render().props.disabled, true);
    const css = [...p.h.css.values()].join("\n");
    assert.match(css, /@container\(max-width:420px\)/); assert.match(css, /:focus-within/);
    assert.match(css, /@container\(min-width:560px\)/);
    assert.match(css, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
    assert.match(css, /input:focus-visible\{border:0!important;outline:none!important;box-shadow:none!important\}/);
    assert.match(css, /:has\(input:focus-visible\)/);
    assert.match(css, /clip-path:inset\(50%\)/);
    assert.doesNotMatch(css, /_row:focus-within/);
    assert.match(css, /_selectionMark\{position:absolute;top:14px;right:14px;/);
    assert.match(css, /_row\{border-width:1px!important;outline:none!important;outline-offset:0!important;box-shadow:none\}/);
    assert.doesNotMatch(css, /_row[^{}]*\{[^}]*outline:2px/);
    const searchFocus = css.match(/_search:focus-within\{([^}]+)\}/)[1];
    const cardFocus = css.match(/_row:has\(input:focus-visible\)\{([^}]+)\}/)[1];
    assert.ok(cardFocus.includes(searchFocus));
    assert.doesNotMatch(css, /box-shadow:inset/);
    assert.match(css, /_details\{[^}]*align-items:center;gap:6px;width:100%;min-width:0;text-align:center/);
    assert.match(css, /_cardTop\{[^}]*justify-content:center/);
    assert.match(css, /_bank\{[^}]*justify-content:center/);
  } finally { p.h.cleanup(); }
});

test("loading, failed, empty and unmatched lists have distinct usable states", () => {
  const p = picker("en", { status: "loading" });
  try {
    assert.match(renderToStaticMarkup(p.render()), /Loading your recipients/);
    p.props.status = "error";
    assert.equal(elements(p.render(), n => n.props.role === "alert").length, 1);
    elements(p.render(), n => n.type === "button" && n.props.onClick === p.props.onRetry)[0].props.onClick();
    assert.deepEqual(p.events, ["retry"]);
    p.props.status = "ready"; p.props.recipients = [];
    assert.match(renderToStaticMarkup(p.render()), /No saved recipients/);
    assert.equal(elements(p.render(), n => n.type === "input" && n.props.type === "search").length, 0);
    p.props.recipients = accounts; p.search("no match");
    assert.match(renderToStaticMarkup(p.render()), /No matching recipients/);
    elements(p.render(), n => n.type === "button" && n.props.children === "Clear search")[0].props.onClick();
    assert.deepEqual(p.ids(), ["new", "old"]);
  } finally { p.h.cleanup(); }
});

test("add-recipient uses the primary button below search; institution form uses the reporting catalogue with separate account fields", () => {
  const p = picker();
  try {
    const html = renderToStaticMarkup(p.render());
    const { DashboardButton } = p.h.load("components/dashboard/dashboard-ui.tsx");
    const add = elements(p.render(), n => n.type === DashboardButton && String(n.props.className).includes("addRecipient"))[0];
    assert.ok(add); assert.equal(add.props.tone, undefined);
    assert.ok(html.indexOf('type="search"') < html.indexOf("Add recipient"));
    assert.match(html, /bg-\[#635bff\]/);
    const css = [...p.h.css.values()].join("\n");
    assert.match(css, /_toolbar\{display:flex;flex-direction:column/);
    assert.match(css, /_addRecipient\{align-self:center/);
  } finally { p.h.cleanup(); }
  for (const locale of ["en", "fa"]) {
    const h = dashboardHarness({ locale });
    const { InstitutionPaymentFields } = h.load("components/dashboard/InstitutionPaymentFields.tsx");
    const { paymentInstitutions, isInstitutionPaymentLink } = h.load("lib/payments/institutions.ts");
    const props = { locale, institutionId: "", paymentLink: "", companyName: "", username: "", password: "", onCompanyNameChange() {}, onUsernameChange() {}, onPasswordChange() {}, disabled: false, onInstitutionChange(id) { props.institutionId = id; }, onPaymentLinkChange() {} };
    const render = () => h.render(InstitutionPaymentFields, props);
    try {
      assert.deepEqual(elements(render(), n => n.type === "input" && n.props.type === "radio").map(n => n.props.value), ["amc", "oet", "other"]);
      for (const institution of paymentInstitutions) {
        elements(render(), n => n.type === "input" && n.props.value === institution.id)[0].props.onChange();
        assert.ok(renderToStaticMarkup(render()).includes(institution.companyName));
        assert.equal(elements(render(), n => n.props.id === "request-institution")[0].type, "p");
        assert.equal(elements(render(), n => n.type === "input" && n.props.type === "password").length, 1);
        assert.equal(elements(render(), n => n.props.id === "request-payment-link")[0].props.dir, "ltr");
      }
      assert.equal(isInstitutionPaymentLink("https://example.com/pay?token=temporary"), true);
      elements(render(), n => n.type === "input" && n.props.value === "other")[0].props.onChange();
      assert.equal(elements(render(), n => n.props.id === "request-institution")[0].type, "input");
      assert.equal(elements(render(), n => n.props.id === "request-institution")[0].props.required, true);
      assert.equal(elements(render(), n => n.props.id === "institution-access-note").length, 0);
      assert.equal(elements(render(), n => n.props.id === "request-invoice").length, 0);
      assert.ok(renderToStaticMarkup(render()).includes('dir="ltr">Other</bdi>'));
      assert.equal(elements(render(), n => n.props.id === "request-payment-password")[0].props.type, "password");
      const markup = renderToStaticMarkup(render());
      assert.ok(markup.includes(locale === "fa" ? "یوزر اکانت شما برای پرداخت" : "Your payment account username"));
      assert.ok(markup.includes(locale === "fa" ? "پسورد اکانت شما برای پرداخت" : "Your payment account password"));
      for (const link of ["http://example.com/pay", "https://user:secret@example.com/pay", "https://example.com/?password=secret", "https://example.com/#pwd=secret", "not a URL"]) assert.equal(isInstitutionPaymentLink(link), false);
    } finally { h.cleanup(); }
  }
});

test("transfer preserves explicit choice, validates destination, creates accounts and requires education details", async () => {
  const RecipientModal = () => null;
  const h = dashboardHarness({ mocks: {
    "@/components/ui/SelectBox/SelectBox": { SelectBox: () => null },
    "@/components/requests/OnlineRequestSubmit": { OnlineRequestSubmit: () => null },
    "@/components/dashboard/RecipientModal": { RecipientModal },
    "@/app/actions/transaction.actions": { getRecipients: async () => ({ data: accounts }) },
    "@/context/FinanceConfigContext": { useFinanceConfig: () => ({ fee_threshold: 1000, applied_fee: 0 }) },
    "@/lib/supabase": { supabase: { from: () => ({ select() { return this; }, order() { return this; }, limit() { return this; }, single: async () => ({ data: { market_active: true } }) }) } },
  } });
  const { DashboardRequestHub } = h.load("components/dashboard/DashboardRequestHub.tsx");
  const { TransferRecipientPicker } = h.load("components/dashboard/TransferRecipientPicker.tsx");
  const props = { isApproved: true, txType: "buy_aud", setTxType() {}, amountStr: "1000", setAmountStr() {}, loyaltyBonus: 0, tailoredRate: 100000, baseRate: 100000, profile: { id: "owner" } };
  const { InstitutionPaymentFields } = h.load("components/dashboard/InstitutionPaymentFields.tsx");
  const render = () => h.render(DashboardRequestHub, props);
  const next = () => elements(render(), n => n.type === "button" && n.props.className === "wizardNext")[0];
  const getPicker = () => elements(render(), n => n.type === TransferRecipientPicker)[0].props;
  const getInstitution = () => elements(render(), n => n.type === InstitutionPaymentFields)[0]?.props;
  const previous = global.requestAnimationFrame; global.requestAnimationFrame = () => 1;
  try {
    render(); h.effects(); await tick(); next().props.onClick();
    assert.equal(next().props.disabled, true);
    getPicker().onSelect("iran"); assert.equal(getPicker().selectedId, "");
    getPicker().onSelect("new"); assert.equal(getPicker().selectedId, "new"); assert.equal(next().props.disabled, false);
    getPicker().onAddSelf();
    assert.equal(getPicker().selectedId, "");
    assert.equal(next().props.disabled, true);
    let modal = elements(render(), n => n.type === RecipientModal)[0];
    assert.equal(modal.props.mode, "self_destination"); assert.equal(modal.props.direction, "aud"); assert.equal(modal.props.lockDirection, true);
    modal.props.onClose(); assert.equal(getPicker().selectedId, "");
    assert.equal(next().props.disabled, true);
    getPicker().onSelect("new");
    getPicker().onAdd(); modal = elements(render(), n => n.type === RecipientModal)[0];
    assert.equal(getPicker().selectedId, "");
    assert.equal(next().props.disabled, true);
    assert.equal(modal.props.mode, "standard");
    modal.props.onCreated({ ...accounts[0], id: "other-owner", user_id: "another" }); assert.equal(getPicker().selectedId, "");
    modal.props.onCreated({ ...accounts[0], id: "created" }); assert.equal(getPicker().selectedId, "created");
    for (const action of ["onAddSelf", "onAdd"]) {
      getPicker().onSelect("__edu_exam__"); render(); h.effects();
      getInstitution().onInstitutionChange("amc");
      getInstitution().onPaymentLinkChange("https://example.com/previous");
      getInstitution().onUsernameChange("synthetic-user");
      getInstitution().onPasswordChange("synthetic-password");
      getPicker()[action]();
      assert.equal(getPicker().selectedId, "");
      assert.equal(getInstitution(), undefined);
      assert.equal(next().props.disabled, true);
      elements(render(), n => n.type === RecipientModal)[0].props.onClose();
      assert.equal(getPicker().selectedId, "");
      getPicker().onSelect("__edu_exam__");
      for (const field of ["institutionId", "paymentLink", "username", "password"]) assert.equal(getInstitution()[field], "");
    }
    getPicker().onSelect("__edu_exam__"); next().props.onClick();
    assert.equal(elements(render(), n => n.props.role === "alert").length, 1);
    getInstitution().onInstitutionChange("oet");
    getInstitution().onPaymentLinkChange("https://example.com/?password=secret");
    next().props.onClick(); assert.ok(getInstitution());
    getInstitution().onInstitutionChange("amc");
    assert.equal(getInstitution().paymentLink, "");
    getInstitution().onUsernameChange("synthetic-user");
    getInstitution().onPasswordChange("synthetic-password");
    getInstitution().onInstitutionChange("other");
    assert.equal(getInstitution().username, ""); assert.equal(getInstitution().password, "");
    getInstitution().onCompanyNameChange("Custom company");
    assert.equal(getInstitution().companyName, "Custom company");
    getInstitution().onPaymentLinkChange("https://example.com/pay");
    getInstitution().onUsernameChange("synthetic-user");
    next().props.onClick(); assert.ok(getInstitution());
    getInstitution().onPasswordChange("synthetic-password");
    next().props.onClick(); assert.equal(elements(render(), n => n.type === TransferRecipientPicker).length, 0);
  } finally { h.cleanup(); global.requestAnimationFrame = previous; }
});
