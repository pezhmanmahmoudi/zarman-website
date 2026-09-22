/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const { test } = require("node:test");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { dashboardHarness } = require("./helpers/dashboard-harness.cjs");

const tick = () => new Promise(resolve => setImmediate(resolve));
function elements(tree, predicate) {
  const matches = [];
  function walk(node) {
    if (!React.isValidElement(node)) return;
    if (predicate(node)) matches.push(node);
    React.Children.forEach(node.props.children, walk);
  }
  walk(tree);
  return matches;
}
function textContent(node) {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (!React.isValidElement(node)) return "";
  return React.Children.toArray(node.props.children).map(textContent).join("");
}
const dialogMocks = Object.fromEntries(["Dialog", "DialogContent", "DialogTitle", "DialogDescription"].map(name => [name,
  ({ children, dir, className }) => React.createElement(name === "DialogTitle" ? "h2" : name === "DialogDescription" ? "p" : "div", {
    dir, className, ...(name === "DialogContent" ? { role: "dialog", "aria-modal": true } : {}),
  }, children),
]));
async function withFrames(run) {
  const previousFrame = global.requestAnimationFrame, previousDocument = global.document;
  const scheduled = [], focused = [];
  global.requestAnimationFrame = callback => { scheduled.push(callback); return scheduled.length; };
  global.document = { getElementById: id => ({ focus: () => focused.push(id), scrollIntoView() {} }) };
  try { await run({ flush: () => scheduled.splice(0).forEach(callback => callback()), focused }); }
  finally { global.requestAnimationFrame = previousFrame; global.document = previousDocument; }
}
function fixture(locale, extra = {}) {
  const calls = [], created = []; let closed = 0;
  const h = dashboardHarness({ locale, mocks: {
    "framer-motion": { ...require("framer-motion"), useReducedMotion: () => false },
    "@/components/ui/dialog": dialogMocks,
    "@/app/actions/transaction.actions": { createRecipient: async payload => {
      calls.push(payload);
      return extra.save ? extra.save(payload) : { data: { ...payload, id: "saved-recipient", user_id: "customer" } };
    } },
  } });
  const { RecipientModal } = h.load("components/dashboard/RecipientModal.tsx");
  const props = { direction: "aud", locale, motionEnabled: false, onClose() { closed++; }, onCreated(recipient) { created.push(recipient); }, ...extra.props };
  const render = () => h.render(RecipientModal, props);
  const field = key => elements(render(), element => element.props.id === `recipient-${key}`)[0];
  const change = (key, value) => { assert.ok(field(key), `Missing ${key}`); field(key).props.onChange({ target: { value } }); };
  const button = (en, fa) => elements(render(), element => typeof element.props.onClick === "function" && textContent(element) === (locale === "fa" ? fa : en))[0];
  const click = (en, fa) => { const target = button(en, fa); assert.ok(target, `Missing button ${en}`); target.props.onClick(); };
  const submit = () => elements(render(), element => element.type === "form")[0].props.onSubmit({ preventDefault() {} });
  const content = () => elements(render(), element => element.type === dialogMocks.DialogContent)[0];
  function basic() { change("name", "Alex Morgan"); change("relationship", "family"); submit(); }
  function contact() {
    change("address", "1 Example Street"); change("city", "Sydney"); change("state", "NSW");
    change("phone", "+61412345678");
    if (field("email")) { change("postcode", "2000"); change("email", "alex@example.com"); }
  }
  function validAustralian() { basic(); change("bank_name", "Example Bank"); change("bsb", "001-234"); change("account_number", "00123456"); contact(); }
  return { h, render, field, change, click, button, submit, content, basic, contact, validAustralian, calls, created, get closed() { return closed; } };
}

for (const locale of ["en", "fa"]) {
  test(`${locale}: basic validation blocks advancing and focuses an identified field`, async () => withFrames(({ flush, focused }) => {
    const f = fixture(locale);
    f.submit(); f.render(); flush();
    assert.equal(f.calls.length, 0);
    assert.equal(f.field("name").props["aria-invalid"], true);
    assert.equal(f.field("relationship").props["aria-invalid"], true);
    assert.equal(f.field("name").props["aria-describedby"], "recipient-name-error");
    assert.equal(f.field("bank_name"), undefined);
    assert.equal(focused[0], "recipient-name");
    const html = renderToStaticMarkup(f.render());
    assert.match(html, locale === "en" ? /This field is required/ : /این فیلد الزامی است/);
    f.change("name", "Alex Morgan"); f.submit();
    assert.equal(f.field("bank_name"), undefined);
    f.change("relationship", "family"); f.submit();
    assert.ok(f.field("bank_name"));
  }));

  test(`${locale}: Back and country changes retain independent banking drafts`, async () => withFrames(() => {
    const f = fixture(locale);
    f.validAustralian(); f.click("Back", "بازگشت");
    assert.equal(f.field("name").props.value, "Alex Morgan");
    assert.equal(f.field("relationship").props.value, "family");
    f.change("country", "irt"); f.submit();
    assert.equal(f.field("account_number"), undefined);
    f.change("bank_name", "Saman Bank"); f.change("bank_city", "Tehran"); f.change("shaba", "820540102680020817909002");
    f.change("city", "Shiraz");
    f.click("Back", "بازگشت"); f.change("country", "aud"); f.submit();
    assert.equal(f.field("bank_name").props.value, "Example Bank");
    assert.equal(f.field("bsb").props.value, "001-234");
    assert.equal(f.field("account_number").props.value, "00123456");
    assert.equal(f.field("city").props.value, "Sydney");
    f.click("Back", "بازگشت"); f.change("country", "irt"); f.submit();
    assert.equal(f.field("bank_city").props.value, "Tehran");
    assert.equal(f.field("city").props.value, "Shiraz");
    assert.equal(f.field("shaba").props.value, "820540102680020817909002");
    assert.equal(f.calls.length, 0);
  }));

  test(`${locale}: pasted Persian Shaba keeps every digit and numeric inputs stay LTR`, async () => withFrames(async () => {
    const f = fixture(locale, { props: { direction: "irt" } });
    f.basic(); f.change("bank_name", "Saman Bank"); f.change("bank_city", "Tehran"); f.contact();
    const shaba = "820540102680020817909002";
    const persian = shaba.replace(/\d/g, digit => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]);
    let prevented = false;
    f.field("shaba").props.onPaste({ preventDefault() { prevented = true; }, clipboardData: { getData: () => `IR ${persian.slice(0, 8)} ${persian.slice(8)}` } });
    assert.equal(prevented, true);
    assert.equal(f.field("shaba").props.value, shaba);
    assert.equal(f.field("shaba").props.dir, "ltr");
    assert.equal(f.field("shaba").props.lang, "en");
    assert.equal(f.field("phone").props.dir, "ltr");
    f.submit(); await tick();
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0].shaba_number, `IR${shaba}`);
    assert.equal(f.calls[0].bank_city, "Tehran");
    assert.equal(f.created.length, 1); assert.equal(f.closed, 1);
  }));

  test(`${locale}: server field errors stay inline and failed saves preserve entered values`, async () => withFrames(async ({ flush, focused }) => {
    const f = fixture(locale, { save: async () => ({ error: "Invalid details", fieldErrors: { account_number: "Account number must contain 5 to 12 digits.", residential_city: "This field is required." } }) });
    f.validAustralian(); f.submit(); await tick(); f.render(); flush();
    assert.equal(f.calls[0].bsb, "001234");
    assert.equal(f.calls[0].account_number, "00123456");
    assert.equal(f.field("account_number").props["aria-invalid"], true);
    assert.equal(f.field("city").props["aria-invalid"], true);
    assert.match(f.field("city").props["aria-describedby"], /recipient-city-error/);
    assert.equal(f.field("account_number").props.value, "00123456");
    assert.equal(f.field("bank_name").props.value, "Example Bank");
    assert.ok(focused.includes("recipient-account_number"));
    assert.equal(f.created.length, 0); assert.equal(f.closed, 0);
    f.change("account_number", "00123457");
    assert.equal(f.field("account_number").props["aria-invalid"], false);
    assert.equal(f.field("city").props["aria-invalid"], true);
    const html = renderToStaticMarkup(f.render());
    assert.match(html, locale === "en" ? /This field is required/ : /این فیلد الزامی است/);
  }));

  test(`${locale}: grouped banking pastes normalize before maxlength and replace only selected digits`, async () => withFrames(async () => {
    function paste(f, key, text, start = 0, end = f.field(key).props.value.length) {
      const input = f.field(key); let prevented = false;
      input.props.onPaste({ preventDefault() { prevented = true; }, clipboardData: { getData: () => text }, currentTarget: { value: input.props.value, selectionStart: start, selectionEnd: end } });
      assert.equal(prevented, true);
    }
    const aud = fixture(locale);
    aud.validAustralian();
    paste(aud, "account_number", "۰۰۰۱ ۲۳۴۵ ۶۷۸۹");
    assert.equal(aud.field("account_number").props.value, "000123456789");
    paste(aud, "bsb", "۰۰۱ ۲۳۴");
    assert.equal(aud.field("bsb").props.value, "001234");
    paste(aud, "bsb", "۹۹", 2, 4);
    assert.equal(aud.field("bsb").props.value, "009934");
    aud.submit(); await tick();
    assert.equal(aud.calls[0].account_number, "000123456789");
    assert.equal(aud.calls[0].bsb, "009934");

    const irt = fixture(locale, { props: { direction: "irt" } });
    irt.basic(); irt.change("bank_name", "Saman Bank"); irt.change("shaba", "820540102680020817909002"); irt.contact();
    paste(irt, "card_number", "۰۰۱۲ ۳۴۵۶ ۷۸۹۰ ۱۲۳۴");
    assert.equal(irt.field("card_number").props.value, "0012345678901234");
    irt.submit(); await tick();
    assert.equal(irt.calls[0].card_number, "0012345678901234");
  }));

  test(`${locale}: a pending save cannot submit twice or close the modal`, async () => withFrames(async () => {
    let finish;
    const f = fixture(locale, { save: payload => new Promise(resolve => { finish = () => resolve({ data: { ...payload, id: "saved-once" } }); }) });
    f.validAustralian(); f.submit(); f.submit();
    assert.equal(f.calls.length, 1);
    assert.equal(elements(f.render(), element => element.type === "fieldset")[0].props.disabled, true);
    assert.equal(elements(f.render(), element => element.props.type === "submit")[0].props["aria-busy"], true);
    f.render().props.onOpenChange(false);
    assert.equal(f.closed, 0);
    assert.equal(f.button("Discard changes", "حذف تغییرات"), undefined);
    finish(); await tick();
    assert.equal(f.created.length, 1); assert.equal(f.closed, 1);
  }));

  test(`${locale}: dirty close confirms discard, Escape keeps the draft and outside clicks do not lose it`, async () => withFrames(() => {
    const f = fixture(locale);
    f.change("name", "Draft recipient");
    f.render().props.onOpenChange(false);
    assert.equal(f.closed, 0); assert.ok(f.button("Keep editing", "ادامه ویرایش"));
    f.click("Keep editing", "ادامه ویرایش");
    assert.equal(f.field("name").props.value, "Draft recipient");
    let outsidePrevented = false;
    f.content().props.onPointerDownOutside({ preventDefault() { outsidePrevented = true; } });
    assert.equal(outsidePrevented, true); assert.equal(f.closed, 0);
    let escapePrevented = false;
    f.content().props.onEscapeKeyDown({ preventDefault() { escapePrevented = true; } });
    assert.equal(escapePrevented, true); assert.ok(f.button("Discard changes", "حذف تغییرات"));
    f.content().props.onEscapeKeyDown({ preventDefault() {} });
    assert.equal(f.button("Discard changes", "حذف تغییرات"), undefined);
    assert.equal(f.field("name").props.value, "Draft recipient");
    f.render().props.onOpenChange(false); f.click("Discard changes", "حذف تغییرات");
    assert.equal(f.closed, 1); assert.equal(f.calls.length, 0);
  }));

  test(`${locale}: transfer-locked country stays disabled and a clean modal closes immediately`, async () => withFrames(() => {
    const f = fixture(locale, { props: { direction: "irt", lockDirection: true } });
    assert.equal(f.field("country").props.value, "irt");
    assert.equal(f.field("country").props.disabled, true);
    f.render().props.onOpenChange(false);
    assert.equal(f.closed, 1); assert.equal(f.calls.length, 0);
  }));
}
