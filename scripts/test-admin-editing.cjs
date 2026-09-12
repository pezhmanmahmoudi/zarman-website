/* eslint-disable @typescript-eslint/no-require-imports -- Offline component interaction harness. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const ts = require("typescript");
const postcss = require("postcss");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const root = path.resolve(__dirname, "..");
function compile(file, mocks = {}) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  const compiled = { exports: {} };
  vm.runInThisContext(`(function(require,module,exports){${js}\n})`, { filename: file })(id => {
    if (id in mocks) return mocks[id];
    if (id.endsWith(".module.css")) {
      const classes = {};
      postcss.parse(fs.readFileSync(path.join(root, id.replace(/^@\//, "")), "utf8")).walkRules(rule => {
        for (const match of rule.selector.matchAll(/\.([a-zA-Z_][\w-]*)/g)) classes[match[1]] = match[1];
      });
      return { __esModule: true, default: new Proxy(classes, { get: (target, key) => {
        if (typeof key !== "string" || key in target) return target[key];
        throw new Error(`Missing CSS class ${id}: ${key}`);
      } }) };
    }
    return require(id);
  }, compiled, compiled.exports);
  return compiled.exports;
}

// Execute real event handlers across renders, with stable state and ref slots.
function mount(file, exportName, props, mocks = {}) {
  const slots = [];
  let cursor = 0;
  const react = { ...React,
    useId: () => "editor-test",
    useEffect: () => {},
    useState: initial => {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
      return [slots[index], next => { slots[index] = typeof next === "function" ? next(slots[index]) : next; }];
    },
    useRef: initial => {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
  };
  const Component = compile(file, { react, ...mocks })[exportName];
  return { render: () => { cursor = 0; return Component(props); } };
}

function find(tree, predicate) {
  if (!tree || typeof tree !== "object") return undefined;
  if (predicate(tree)) return tree;
  for (const child of React.Children.toArray(tree.props?.children)) {
    const match = find(child, predicate);
    if (match) return match;
  }
}

const findType = (tree, type) => find(tree, node => node.type === type);
const findButton = (tree, name) => find(tree, node => node.type === "button" && node.props.children === name);
const submitEvent = { preventDefault() {} };
const { parseAdminAmount } = compile("lib/admin-amount-input.ts");

test("amount entry accepts complete decimal values and correctly grouped thousands", () => {
  for (const [input, expected] of [["506", 506], ["80,125,100", 80125100], [" 1,250.50 ", 1250.5], ["0.25", 0.25], [".50", 0.5], ["1250.", 1250]]) {
    assert.equal(parseAdminAmount(input), expected);
  }
});

test("malformed and unsafe amount entry cannot silently save a numeric prefix", () => {
  for (const value of ["", " ", "0", "-5", "NaN", "Infinity", "1e3", "506oops", "$506", "1,2,3", "5,00", "1.2.3", "1 000", ".", "9007199254740992", "9".repeat(400)]) {
    assert.equal(parseAdminAmount(value), null, value);
  }
});

function editor(onSave) {
  const Dialog = ({ open, children }) => open ? React.createElement("section", { role: "dialog" }, children) : null;
  const mounted = mount("components/admin/ui/AdminFieldEditor.tsx", "AdminFieldEditor", {
    value: "506", displayValue: "506.00", label: "AUD amount", description: "Update this transaction.",
    suffix: "AUD", inputMode: "decimal", onSave,
  }, { "@/components/admin/ui/AdminDialog": { AdminDialog: Dialog } });
  const trigger = find(mounted.render(), node => node.type === "button" && node.props["aria-haspopup"] === "dialog");
  trigger.props.onClick();
  return { ...mounted, Dialog };
}

test("transaction editor exposes a labeled decimal input and explicit submit/cancel controls", () => {
  const mounted = editor(async () => {});
  const tree = mounted.render();
  const html = renderToStaticMarkup(tree);
  assert.match(html, /role="dialog"/);
  assert.match(html, /<label[^>]+for="editor-test-input"[^>]*>AUD amount/);
  assert.match(html, /inputMode="decimal"/);
  assert.match(html, /enterKeyHint="done"/);
  assert.match(html, /type="submit"[^>]*>Save changes/);
  assert.match(html, /type="button"[^>]*>Cancel/);
  assert.equal(findType(tree, mounted.Dialog).props.initialFocusRef.current, null);
  assert.equal(findType(tree, mounted.Dialog).props.dismissible, true);
});

test("repeated submit only saves once; pending work disables dismissal and all form controls", async () => {
  let finish;
  const calls = [];
  const mounted = editor(value => { calls.push(value); return new Promise(resolve => { finish = resolve; }); });
  findType(mounted.render(), "input").props.onChange({ target: { value: "600.50" } });
  const handler = findType(mounted.render(), "form").props.onSubmit;
  const pending = handler(submitEvent);
  await handler(submitEvent);
  const tree = mounted.render();
  assert.deepEqual(calls, ["600.50"]);
  assert.equal(findType(tree, mounted.Dialog).props.dismissible, false);
  assert.equal(findType(tree, "input").props.disabled, true);
  assert.equal(findButton(tree, "Cancel").props.disabled, true);
  findType(tree, mounted.Dialog).props.onClose();
  assert.equal(findType(mounted.render(), mounted.Dialog).props.open, true);
  finish();
  await pending;
  assert.equal(findType(mounted.render(), mounted.Dialog), undefined);
});

test("save failure preserves the draft, announces the error, and allows retry or cancel", async () => {
  const mounted = editor(async () => { throw new Error("Connection interrupted. Try again."); });
  findType(mounted.render(), "input").props.onChange({ target: { value: "725.25" } });
  await findType(mounted.render(), "form").props.onSubmit(submitEvent);
  const failed = mounted.render();
  assert.equal(findType(failed, mounted.Dialog).props.open, true);
  assert.equal(findType(failed, "input").props.value, "725.25");
  assert.equal(findType(failed, "input").props["aria-invalid"], true);
  assert.equal(find(failed, node => node.props?.role === "alert").props.children, "Connection interrupted. Try again.");
  assert.equal(findButton(failed, "Cancel").props.disabled, false);
  findButton(failed, "Cancel").props.onClick();
  assert.equal(findType(mounted.render(), mounted.Dialog), undefined);
  find(mounted.render(), node => node.type === "button" && node.props["aria-haspopup"] === "dialog").props.onClick();
  assert.equal(findType(mounted.render(), "input").props.value, "506");
});

test("amount editor rejects invalid values before its action and saves the selected currency only", async () => {
  const calls = [];
  let refreshes = 0;
  const Field = () => null;
  const mounted = mount("components/admin/EditableAmount.tsx", "EditableAmount", {
    transactionId: "tx-test", field: "equivalent_toman", currentValue: 80125100,
  }, {
    "next/navigation": { useRouter: () => ({ refresh: () => { refreshes++; } }) },
    "@/app/actions/admin.actions": { updateTransactionAmount: async (...args) => { calls.push(args); return { success: true }; } },
    "@/components/admin/ui/AdminFieldEditor": { AdminFieldEditor: Field },
    "@/lib/admin-amount-input": { parseAdminAmount },
  });
  await assert.rejects(mounted.render().props.onSave("506oops"), /positive amount/);
  assert.deepEqual(calls, []);
  await mounted.render().props.onSave("80,000,000");
  assert.deepEqual(calls, [["tx-test", "equivalent_toman", 80000000]]);
  assert.equal(refreshes, 1);
  assert.equal(mounted.render().props.value, "80000000");
});
