/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const { test } = require("node:test");
const React = require("react");
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
const SHABA = "820540102680020817909002";
const persian = value => value.replace(/\d/g, digit => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]);
async function withFrames(run) {
  const previousFrame = global.requestAnimationFrame, previousDocument = global.document;
  const scheduled = [], focused = [];
  global.requestAnimationFrame = callback => { scheduled.push(callback); return scheduled.length; };
  const target = name => ({ focus: () => focused.push(name), scrollIntoView() {} });
  global.document = {
    activeElement: null,
    getElementById: id => target(id),
    querySelector: selector => target(/data-field~="([^"]+)"/.exec(selector)?.[1] ?? selector),
  };
  try { await run({ flush: () => scheduled.splice(0).forEach(callback => callback()), focused }); }
  finally { global.requestAnimationFrame = previousFrame; global.document = previousDocument; }
}
function fixture(locale = "en", extra = {}) {
  const calls = [], created = []; let closed = 0;
  const h = dashboardHarness({ locale, mocks: {
    "framer-motion": { ...require("framer-motion"), useReducedMotion: () => false },
    "@/components/ui/dialog": dialogMocks,
    "@/app/actions/transaction.actions": {
      createRecipient: async payload => {
        calls.push(payload);
        return extra.save ? extra.save(payload) : { data: { ...payload, id: "saved-recipient", user_id: "customer" } };
      },
      updateRecipient: async () => { throw Error("Unexpected recipient update"); },
    },
  } });
  const { RecipientModal } = h.load("components/dashboard/RecipientModal.tsx");
  const props = { direction: "aud", locale, motionEnabled: false, onClose() { closed++; }, onCreated(recipient) { created.push(recipient); }, ...extra.props };
  const render = () => h.render(RecipientModal, props);
  const find = predicate => elements(render(), predicate)[0];
  const field = key => find(element => element.props.id === `recipient-${key}`);
  // Select boxes and suggestion fields sit inside the field's data-field wrapper.
  const control = key => {
    const wrapper = find(element => element.props["data-field"] === key);
    return wrapper && elements(wrapper, element => element.props.labeledOptions !== undefined || typeof element.props.onSelect === "function")[0];
  };
  function change(key, value) {
    const input = field(key);
    if (input) { input.props.onChange({ target: { value }, currentTarget: { selectionStart: value.length, setSelectionRange() {} } }); return; }
    const select = control(key);
    assert.ok(select, `Missing ${key}`);
    select.props.onChange(value);
  }
  const location = () => find(element => typeof element.props.onStateChange === "function");
  const button = label => find(element => typeof element.props.onClick === "function" && textContent(element) === label);
  const click = label => { const target = button(label); assert.ok(target, `Missing button ${label}`); target.props.onClick(); };
  const submit = () => find(element => element.type === "form").props.onSubmit({ preventDefault() {} });
  const content = () => find(element => element.type === dialogMocks.DialogContent);
  const step = () => find(element => element.props["aria-live"] === "polite")?.props.children;
  function australianBank() { change("bank_name", "Example Bank"); change("bank_city", "Sydney"); change("bsb", "001234"); change("account_number", "00123456"); }
  function australianContact() {
    change("address", "1 Example Street");
    location().props.onStateChange("NSW"); location().props.onCityChange("Sydney"); location().props.onPostalCodeChange("2000");
    change("phone", "+61412345678"); change("email", "alex@example.com");
  }
  function iranianBank() { change("bank_name", "Saman Bank"); change("bank_city", "Tehran"); change("shaba", SHABA); }
  function iranianContact() { change("address", "1 Example Street"); change("state", "Fars"); change("city", "Shiraz"); change("phone", "09123456789"); }
  function validAustralian() { change("name", "Alex Morgan"); submit(); australianBank(); submit(); australianContact(); }
  return { h, render, find, field, control, change, location, button, click, submit, content, step,
    australianBank, australianContact, iranianBank, iranianContact, validAustralian, calls, created, get closed() { return closed; } };
}

test("each step validates its own fields inline and focuses the first invalid one", () => withFrames(({ flush, focused }) => {
  const f = fixture();
  f.submit(); flush();
  assert.equal(f.step(), "Step 1 of 3");
  assert.equal(f.field("name").props["aria-invalid"], true);
  assert.equal(f.field("name").props["aria-describedby"], "recipient-name-hint recipient-name-error");
  assert.equal(textContent(f.find(element => element.props.id === "recipient-name-error")), "This field is required.");
  assert.deepEqual(focused, ["name"]);
  f.change("name", "Alex Morgan");
  assert.equal(f.field("name").props["aria-invalid"], false);
  f.submit();
  assert.equal(f.step(), "Step 2 of 3");
  f.submit(); flush();
  assert.equal(f.step(), "Step 2 of 3");
  for (const key of ["bank_name", "bank_city", "bsb", "account_number"]) assert.equal(f.field(key).props["aria-invalid"], true, key);
  assert.equal(focused.at(-1), "bank_name");
  assert.equal(f.calls.length, 0);
}));

test("Back and country changes keep separate Australian and Iranian banking drafts", () => withFrames(() => {
  const f = fixture();
  f.change("name", "Alex Morgan"); f.submit(); f.australianBank();
  f.click("Back");
  assert.equal(f.field("name").props.value, "Alex Morgan");
  f.change("country", "irt"); f.submit();
  assert.equal(f.field("account_number"), undefined);
  assert.ok(f.field("shaba"));
  f.iranianBank();
  f.click("Back"); f.change("country", "aud"); f.submit();
  assert.equal(f.field("bank_name").props.value, "Example Bank");
  assert.equal(f.field("bsb").props.value, "001-234");
  assert.equal(f.field("account_number").props.value, "00123456");
  f.click("Back"); f.change("country", "irt"); f.submit();
  assert.equal(f.control("bank_name").props.value, "Saman Bank");
  assert.equal(f.control("bank_city").props.value, "Tehran");
  assert.equal(f.field("shaba").props.value, "IR82 0540 1026 8002 0817 9090 02");
  assert.equal(f.calls.length, 0);
}));

test("Persian digits in Shaba, card and phone are saved as Latin digits with the IR prefix", () => withFrames(async () => {
  const f = fixture("en", { props: { direction: "irt" } });
  f.change("name", "Alex Morgan"); f.submit();
  f.change("bank_name", "Saman Bank"); f.change("bank_city", "Tehran");
  f.change("shaba", `IR ${persian(SHABA.slice(0, 8))} ${persian(SHABA.slice(8))}`);
  f.change("card_number", persian("0012 3456 7890 1234"));
  assert.equal(f.field("shaba").props.value, "IR82 0540 1026 8002 0817 9090 02");
  assert.equal(f.field("shaba").props.inputMode, "numeric");
  assert.equal(f.field("card_number").props.value, "0012 3456 7890 1234");
  f.submit(); f.iranianContact(); f.change("phone", persian("09123456789"));
  f.submit(); await tick();
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].shaba_number, `IR${SHABA}`);
  assert.equal(f.calls[0].card_number, "0012345678901234");
  assert.equal(f.calls[0].irt_phone, "09123456789");
  assert.equal(f.calls[0].bank_city, "Tehran");
  assert.equal(f.calls[0].irt_city, "Shiraz");
  assert.equal(f.created.length, 1); assert.equal(f.closed, 1);
}));

test("Australian BSB and account numbers accept grouped Persian digits and stop at their length limits", () => withFrames(async () => {
  const f = fixture();
  f.change("name", "Alex Morgan"); f.submit(); f.australianBank();
  f.change("bsb", persian("001-234"));
  assert.equal(f.field("bsb").props.value, "001-234");
  f.change("bsb", "1234567");
  assert.equal(f.field("bsb").props.value, "123-456");
  f.change("account_number", persian("0001 2345 6789 99"));
  assert.equal(f.field("account_number").props.value, "000123456789");
  f.submit(); f.australianContact(); f.submit(); await tick();
  assert.equal(f.calls[0].bsb, "123456");
  assert.equal(f.calls[0].account_number, "000123456789");
  assert.equal(f.calls[0].bank_city, "Sydney");
  assert.equal(f.calls[0].residential_state, "NSW");
  assert.equal(f.created.length, 1);
}));

test("server field errors return to the right step and failed saves keep every value", () => withFrames(async ({ flush, focused }) => {
  const f = fixture("en", { save: async () => ({ error: "Invalid details", fieldErrors: { account_number: "Account number must contain 5 to 12 digits.", residential_city: "This field is required." } }) });
  f.validAustralian(); f.submit(); await tick(); flush();
  assert.equal(f.calls.length, 1);
  assert.equal(f.step(), "Step 2 of 3");
  assert.equal(f.field("account_number").props["aria-invalid"], true);
  assert.equal(f.field("account_number").props.value, "00123456");
  assert.equal(f.field("bank_name").props.value, "Example Bank");
  assert.ok(focused.includes("account_number"));
  assert.equal(textContent(f.find(element => element.props.id === "recipient-save-error")), "Please check the highlighted details.");
  assert.equal(f.created.length, 0); assert.equal(f.closed, 0);
  f.change("account_number", "00123457");
  assert.equal(f.field("account_number").props["aria-invalid"], false);
  f.submit();
  assert.equal(f.location().props.errors.city, "This field is required.");
  assert.equal(f.location().props.city, "Sydney");
}));

test("a pending save cannot submit twice or close the modal", () => withFrames(async () => {
  let finish;
  const f = fixture("en", { save: payload => new Promise(resolve => { finish = () => resolve({ data: { ...payload, id: "saved-once" } }); }) });
  f.validAustralian(); f.submit(); f.submit();
  assert.equal(f.calls.length, 1);
  assert.equal(f.find(element => element.type === "fieldset").props.disabled, true);
  assert.equal(f.find(element => element.props.type === "submit").props["aria-busy"], true);
  f.render().props.onOpenChange(false);
  f.content().props.onEscapeKeyDown({ preventDefault() {} });
  assert.equal(f.closed, 0);
  assert.equal(f.button("Discard"), undefined);
  finish(); await tick();
  assert.equal(f.created.length, 1); assert.equal(f.closed, 1);
}));

test("dirty close confirms discard, Escape keeps the draft and outside clicks do not lose it", () => withFrames(() => {
  const f = fixture();
  f.change("name", "Draft recipient");
  f.render().props.onOpenChange(false);
  assert.equal(f.closed, 0); assert.ok(f.button("Keep editing"));
  f.click("Keep editing");
  assert.equal(f.button("Keep editing"), undefined);
  assert.equal(f.field("name").props.value, "Draft recipient");
  let outsidePrevented = false;
  f.content().props.onPointerDownOutside({ preventDefault() { outsidePrevented = true; } });
  assert.equal(outsidePrevented, true); assert.equal(f.closed, 0);
  let escapePrevented = false;
  f.content().props.onEscapeKeyDown({ preventDefault() { escapePrevented = true; } });
  assert.equal(escapePrevented, true); assert.ok(f.button("Discard"));
  f.content().props.onEscapeKeyDown({ preventDefault() {} });
  assert.equal(f.button("Discard"), undefined);
  assert.equal(f.field("name").props.value, "Draft recipient");
  f.render().props.onOpenChange(false); f.click("Discard");
  assert.equal(f.closed, 1); assert.equal(f.calls.length, 0);
}));

for (const locale of ["en", "fa"]) {
  test(`${locale}: the form stays English LTR, a transfer-locked country stays disabled and a clean modal closes immediately`, () => withFrames(() => {
    const f = fixture(locale, { props: { direction: "irt", lockDirection: true } });
    assert.equal(f.content().props.dir, "ltr");
    assert.equal(f.content().props.lang, "en");
    assert.equal(f.control("country").props.value, "irt");
    assert.equal(f.control("country").props.disabled, true);
    f.render().props.onOpenChange(false);
    assert.equal(f.closed, 1); assert.equal(f.calls.length, 0);
  }));
}

