/* eslint-disable @typescript-eslint/no-require-imports -- Offline interaction regression tests. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const React = require("react");
const ts = require("typescript");

function elements(tree, predicate) {
  const result = [];
  function walk(node) {
    if (!React.isValidElement(node)) return;
    if (predicate(node)) result.push(node);
    React.Children.forEach(node.props.children, walk);
  }
  walk(tree);
  return result;
}

function harness(file, props, { ios = false } = {}) {
  const state = [], refs = [];
  let stateIndex = 0, refIndex = 0, popover;
  const hooks = {
    ...React,
    useState(initial) {
      const index = stateIndex++;
      if (!(index in state)) state[index] = initial;
      return [state[index], next => { state[index] = typeof next === "function" ? next(state[index]) : next; }];
    },
    useRef(initial) { return refs[refIndex++] ||= { current: initial }; },
    useId: () => "test-select",
    useEffect() {},
    useSyncExternalStore: () => ios,
  };
  const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const loaded = { exports: {} };
  const localRequire = id => {
    if (id === "react") return hooks;
    if (id.endsWith("useAnchoredPopover")) return { useAnchoredPopover: options => { popover = options; } };
    if (id.endsWith(".module.css")) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
    if (id === "@/components/ui/SelectBox/SelectBox") return { SelectBox: () => null };
    if (id === "@/lib/australian-driver-licence") return { normalizeAustralianState: value => value };
    return require(id);
  };
  vm.runInNewContext(compiled, { module: loaded, exports: loaded.exports, require: localRequire });
  const component = loaded.exports.SelectBox || loaded.exports.SuggestionField;
  const render = () => { stateIndex = 0; refIndex = 0; return component(props); };
  const find = predicate => elements(render(), predicate)[0];
  return { props, render, find, get popover() { render(); return popover; } };
}

let nextEventTime = 1000;
function event(properties = {}) {
  return { defaultPrevented: false, stopped: false,
    timeStamp: nextEventTime += 20,
    preventDefault() { this.defaultPrevented = true; },
    stopPropagation() { this.stopped = true; }, ...properties };
}

function selectHarness(extra = {}, platform) {
  const changes = [], focus = [];
  const props = { value: "buy_aud", dir: "ltr", ariaLabel: "Entry type",
    labeledOptions: [{ value: "buy_aud", label: "Buy AUD" }, { value: "sell_aud", label: "Sell AUD" }, { value: "transfer", label: "Transfer" }],
    onChange(value) { changes.push(value); props.value = value; }, ...extra };
  const h = harness("components/ui/SelectBox/SelectBox.tsx", props, platform);
  const trigger = () => h.find(node => node.props.role === "combobox");
  if (trigger()) trigger().props.ref.current = { focus: options => focus.push(options) };
  const options = () => elements(h.render(), node => node.props.role === "option");
  return { ...h, trigger, options, changes, focus, key(key, properties) { const e = event({ key, ...properties }); trigger().props.onKeyDown(e); return e; } };
}

for (const pointerType of ["mouse", "touch", "pen"]) {
  test(`${pointerType} selection inside a label closes once, including reselecting the current option`, () => {
    const h = selectHarness();
    for (const index of [2, 2, 1]) {
      h.trigger().props.onClick();
      const tree = h.render();
      const option = elements(tree, node => node.props.role === "option")[index];
      const popup = elements(tree, node => node.props.popover === "manual")[0];
      const down = event({ pointerType });
      option.props.onPointerDown(down);
      assert.equal(down.defaultPrevented, pointerType === "mouse");
      const click = event({ pointerType });
      option.props.onClick(click);
      popup.props.onClick(click);
      // A label's uncancelled click activates its associated trigger after the
      // bubbling handlers. This is the ledger's original reopen regression.
      if (!click.defaultPrevented) h.trigger().props.onClick();
      assert.equal(h.trigger().props["aria-expanded"], false);
      assert.equal(h.options().length, 0);
      assert.equal(click.defaultPrevented, true);
      assert.equal(click.stopped, true);
    }
    assert.deepEqual(h.changes, ["transfer", "transfer", "sell_aud"]);
    assert.equal(h.focus.length, 3);
    assert.ok(h.focus.every(options => options.preventScroll));
  });
}

test("touch scrolling and popup padding do not select or reactivate the field label", () => {
  const h = selectHarness();
  h.trigger().props.onClick();
  const down = event({ pointerType: "touch" });
  h.options()[1].props.onPointerDown(down);
  assert.equal(down.defaultPrevented, false);
  assert.deepEqual(h.changes, []);
  const click = event();
  h.find(node => node.props.popover === "manual").props.onClick(click);
  assert.equal(click.defaultPrevented, true);
  assert.equal(h.trigger().props["aria-expanded"], true);
});

test("selection closes and restores focus before notifying a parent that may navigate or disable the field", () => {
  let h;
  h = selectHarness({ onChange(value) {
    assert.equal(value, "transfer");
    assert.equal(h.trigger().props["aria-expanded"], false);
    assert.equal(h.focus.length, 1);
    h.props.disabled = true;
  } });
  h.key("End");
  h.key("Enter");
  assert.equal(h.options().length, 0);
});

test("arrow navigation previews values; Enter, Space, Tab and Alt+Up commit and close", () => {
  for (const [key, properties] of [["Enter"], [" "], ["Tab"], ["Tab", { shiftKey: true }], ["ArrowUp", { altKey: true }]]) {
    const h = selectHarness();
    h.key("ArrowDown");
    assert.match(h.trigger().props["aria-activedescendant"], /option-0$/);
    h.key("End");
    h.key("ArrowUp");
    assert.deepEqual(h.changes, []);
    const e = h.key(key, properties);
    assert.deepEqual(h.changes, ["sell_aud"]);
    assert.equal(h.trigger().props["aria-expanded"], false);
    assert.equal(e.defaultPrevented, key !== "Tab");
  }
});

test("Escape cancels the preview and does not reach the enclosing dialog", () => {
  const h = selectHarness();
  h.key("End");
  const escape = h.key("Escape");
  assert.equal(escape.defaultPrevented, true);
  assert.equal(escape.stopped, true);
  assert.deepEqual(h.changes, []);
  assert.equal(h.props.value, "buy_aud");
  assert.equal(h.trigger().props["aria-expanded"], false);
});

test("outside click and hidden anchor dismiss without committing; Escape restores focus", () => {
  for (const reason of ["outside", "anchor-hidden", "escape"]) {
    const h = selectHarness();
    h.key("End");
    h.popover.onClose(reason);
    assert.equal(h.trigger().props["aria-expanded"], false);
    assert.deepEqual(h.changes, []);
    assert.equal(h.focus.length, reason === "escape" ? 1 : 0);
  }
  const h = selectHarness();
  h.key("s");
  h.popover.onClose("outside");
  h.key("t");
  assert.match(h.trigger().props["aria-activedescendant"], /option-2$/);
});

test("typeahead searches labels, cycles repeated letters and resets after closing", () => {
  const h = selectHarness({ labeledOptions: [{ value: "aud", label: "Australian Dollar" }, { value: "afn", label: "Afghani" }, { value: "cad", label: "Canadian Dollar" }], value: "cad" });
  h.key("a");
  assert.match(h.trigger().props["aria-activedescendant"], /option-0$/);
  h.key("a");
  assert.match(h.trigger().props["aria-activedescendant"], /option-1$/);
  h.key("Escape");
  h.key("c");
  h.key("a");
  assert.match(h.trigger().props["aria-activedescendant"], /option-2$/);
  h.key("Enter");
  assert.deepEqual(h.changes, ["cad"]);
});

test("typeahead starts a fresh query after a pause", () => {
  const h = selectHarness();
  h.key("s", { timeStamp: 1000 });
  h.key("t", { timeStamp: 1700 });
  assert.match(h.trigger().props["aria-activedescendant"], /option-2$/);
  h.key("Enter");
  assert.deepEqual(h.changes, ["transfer"]);
});

test("duplicate country values in groups have unique IDs and reachable active descendants", () => {
  const h = selectHarness({ labeledOptions: undefined, groups: [{ label: "Common", options: ["Australia", "Iran"] }, { label: "All Countries", options: ["Australia", "Canada", "Iran"] }], value: "Australia", dir: "rtl" });
  h.key("End");
  const ids = h.options().map(option => option.props.id);
  assert.equal(new Set(ids).size, 5);
  assert.equal(h.options().filter(option => option.props["aria-selected"]).length, 1);
  assert.equal(h.trigger().props["aria-activedescendant"], ids[4]);
  const groups = elements(h.render(), node => node.props.role === "group");
  assert.equal(groups.length, 2);
  assert.ok(groups.every(group => h.find(node => node.props.id === group.props["aria-labelledby"])));
  h.key("Enter");
  assert.deepEqual(h.changes, ["Iran"]);
});

test("disabled and empty selects do not open; disabled state never reports an expanded popup", () => {
  const disabled = selectHarness({ disabled: true });
  disabled.key("Enter");
  disabled.trigger().props.onClick();
  assert.equal(disabled.trigger().props["aria-expanded"], false);
  assert.deepEqual(disabled.changes, []);
  const empty = selectHarness({ labeledOptions: [], value: "" });
  empty.key("ArrowDown");
  empty.key("Enter");
  empty.trigger().props.onClick();
  assert.equal(empty.trigger().props["aria-expanded"], false);
  const h = selectHarness();
  h.key("Enter");
  h.props.disabled = true;
  assert.equal(h.trigger().props["aria-expanded"], false);
  assert.equal(h.options().length, 0);
});

test("iOS native select preserves empty-valued options and RTL without duplicate placeholders", () => {
  const h = selectHarness({ value: "", dir: "rtl", labeledOptions: [{ value: "", label: "Select account" }, { value: "aud", label: "AUD account" }] }, { ios: true });
  const select = h.find(node => node.type === "select");
  assert.equal(select.props.dir, "rtl");
  const options = elements(h.render(), node => node.type === "option");
  assert.equal(options.filter(option => option.props.value === "").length, 1);
  assert.equal(options[0].props.disabled, undefined);
  select.props.onChange({ target: { value: "aud" } });
  assert.deepEqual(h.changes, ["aud"]);
});

function suggestionHarness() {
  const changes = [];
  let focused = null;
  const props = { label: "City / Suburb", value: "", placeholder: "Choose suburb", disabled: false,
    suggestions: ["SYDNEY", "MELBOURNE"], helperText: "Suburbs",
    onChange(value) { props.value = value; }, onSelect(value) { changes.push(value); props.value = value; } };
  const h = harness("components/dashboard/AustralianLocationFields.tsx", props);
  const input = () => h.find(node => node.type === "input");
  input().props.ref.current = { focus() { focused = "input"; input().props.onFocus(); } };
  return { ...h, input, changes, focused: () => focused, focusOption() { focused = "option"; } };
}

test("touch suggestion selection restores input focus and stays closed after onFocus", () => {
  const h = suggestionHarness();
  h.input().props.onFocus();
  h.focusOption();
  h.find(node => node.props.role === "option").props.onClick();
  assert.deepEqual(h.changes, ["SYDNEY"]);
  assert.equal(h.focused(), "input");
  assert.equal(h.input().props["aria-expanded"], false);
  assert.equal(h.input().props["aria-activedescendant"], undefined);
});

test("suggestion toggle retains input focus and Escape closes only the suggestions", () => {
  const h = suggestionHarness();
  const toggle = () => h.find(node => node.props["aria-label"] === "Toggle City / Suburb suggestions");
  toggle().props.onClick();
  assert.equal(h.focused(), "input");
  assert.equal(h.input().props["aria-expanded"], true);
  toggle().props.onClick();
  assert.equal(h.input().props["aria-expanded"], false);
  toggle().props.onClick();
  const escape = event({ key: "Escape" });
  h.input().props.onKeyDown(escape);
  assert.equal(escape.defaultPrevented, true);
  assert.equal(escape.stopped, true);
  assert.equal(h.input().props["aria-expanded"], false);
});
