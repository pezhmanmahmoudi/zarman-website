/* eslint-disable @typescript-eslint/no-require-imports -- Offline TSX rendering and interaction harness. */
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
  const result = { exports: {} };
  const localRequire = id => {
    if (id in mocks) return mocks[id];
    const resolved = id.startsWith("@/") ? id.slice(2) : path.join(path.dirname(file), id);
    if (id.endsWith(".module.css")) {
      const classes = {};
      postcss.parse(fs.readFileSync(path.join(root, resolved), "utf8")).walkRules(rule => {
        for (const match of rule.selector.matchAll(/\.([a-zA-Z_][\w-]*)/g)) classes[match[1]] = match[1];
      });
      return { __esModule: true, default: new Proxy(classes, { get(target, key) {
        if (typeof key !== "string" || key in target) return target[key];
        throw new Error(`Missing CSS class ${resolved}: ${key}`);
      } }) };
    }
    if (id === "next/link") return { __esModule: true, default: props => React.createElement("a", props) };
    if (id.startsWith("@/lib/")) return compile(`${resolved}.ts`, mocks);
    return require(id);
  };
  vm.runInThisContext(`(function(require,module,exports){${js}\n})`, { filename: file })(localRequire, result, result.exports);
  return result.exports;
}

const helpers = compile("lib/admin-pagination.ts");
const query = "search=invoice+100&status=approved&direction=incoming&start=2026-09-01&end=2026-09-11&page=2&pageSize=20&tag=a&tag=b";
function pager(mocks = {}) {
  return compile("components/admin/AdminPagination.tsx", {
    "next/navigation": {
      useRouter: () => ({ push() {} }), usePathname: () => "/admin/ledger",
      useSearchParams: () => new URLSearchParams(query),
    }, ...mocks,
  }).AdminPagination;
}
function html(props = {}) {
  return renderToStaticMarkup(React.createElement(pager(), { currentPage: 2, pageSize: 20, totalCount: 266, ...props }));
}
function nodes(tree, predicate) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, predicate));
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
}

// Hooks are controlled here to invoke the real components' event handlers offline.
function interactivePager(props = {}) {
  let pending = false;
  let cursor = 0;
  const states = [];
  const pushes = [];
  const component = pager({
    react: { ...React,
      useId: () => "page-jump-test",
      useState(initial) {
        const slot = cursor++;
        if (!(slot in states)) states[slot] = initial;
        return [states[slot], value => { states[slot] = value; }];
      },
      useTransition: () => [pending, callback => { callback(); }],
    },
    "next/navigation": {
      useRouter: () => ({ push: (...args) => pushes.push(args) }), usePathname: () => "/admin/ledger",
      useSearchParams: () => new URLSearchParams(query),
    },
  });
  const render = () => component({ currentPage: 2, totalCount: 266, pageSize: 20, ...props });
  const renderJump = () => {
    const element = nodes(render(), node => typeof node.type === "function" && node.type.name === "PageJump")[0];
    cursor = 0;
    return element.type(element.props);
  };
  return { render, renderJump, pushes, setPending(value) { pending = value; } };
}

test("page jumps preserve all active filters and repeated query keys", () => {
  const href = helpers.adminPaginationHref("/admin/ledger", query, 9);
  const actual = new URL(href, "https://example.test");
  const expected = new URLSearchParams(query);
  expected.set("page", "9");
  assert.equal(actual.pathname, "/admin/ledger");
  assert.deepEqual([...actual.searchParams], [...expected]);
  const resized = new URL(helpers.adminPaginationHref("/admin/ledger", query, 1, 50), "https://example.test");
  assert.equal(resized.searchParams.get("page"), "1");
  assert.equal(resized.searchParams.get("pageSize"), "50");
  assert.deepEqual(resized.searchParams.getAll("tag"), ["a", "b"]);
  assert.equal(resized.searchParams.get("search"), "invoice 100");
});

test("page input clamps integers, rejects malformed values, and disables empty results", () => {
  for (const [value, expected] of [["9", 9], [" 12 ", 12], ["0", 1], ["-5", 1], ["99999999999999999999", 27]]) {
    assert.equal(helpers.parseAdminPageJump(value, 27), expected);
  }
  for (const value of ["", " ", "2.5", "NaN", "Infinity", "3cats", "1e2"]) assert.equal(helpers.parseAdminPageJump(value, 27), null);
  assert.equal(helpers.parseAdminPageJump("1", 0), null);
});

test("row sizes match each supported option and invalid route input retains the page default", () => {
  for (const size of [10, 20, 25, 50]) assert.equal(helpers.parseAdminPageSize(String(size)), size);
  for (const value of [undefined, "", "0", "20junk", "100", "NaN"]) assert.equal(helpers.parseAdminPageSize(value, 20), 20);
  assert.equal(helpers.parseAdminPage("10001"), 10000);
  assert.equal(helpers.parseAdminPage("3"), 3);
  assert.equal(helpers.parseAdminPage("2.5"), 1);
});

test("record ranges remain honest at the last, empty, invalid and capped pages", () => {
  assert.deepEqual(helpers.getAdminPaginationState(14, 266, 20), {
    page: 14, count: 266, totalPages: 14, hasPageLimit: false, outOfRange: false, start: 261, end: 266, previousPage: 13,
  });
  const invalid = helpers.getAdminPaginationState(99, 266, 20);
  assert.equal(invalid.outOfRange, true);
  assert.equal(invalid.start, 0);
  assert.equal(invalid.end, 0);
  assert.equal(invalid.previousPage, 14);
  const empty = helpers.getAdminPaginationState(99, 0, 20);
  assert.equal(empty.totalPages, 0);
  assert.equal(empty.start, 0);
  const capped = helpers.getAdminPaginationState(10000, 400001, 20);
  assert.equal(capped.totalPages, 10000);
  assert.equal(capped.hasPageLimit, true);
  assert.equal(capped.count, 400001);
});

test("pagination renders labeled direct-entry and row-size controls, accurate totals and unique IDs", () => {
  const output = html();
  assert.match(output, /21–40 of 266/);
  assert.match(output, /Page 2 of 14/);
  assert.match(output, /Go to page<\/label>/);
  assert.match(output, /inputMode="numeric"/);
  assert.match(output, /enterKeyHint="go"/);
  assert.match(output, /<button type="submit"[^>]*>Go<\/button>/);
  assert.match(output, /<option value="20" selected="">20<\/option>/);
  const Component = pager();
  const both = renderToStaticMarkup(React.createElement(React.Fragment, null,
    React.createElement(Component, { currentPage: 2, pageSize: 20, totalCount: 266, label: "Top pagination" }),
    React.createElement(Component, { currentPage: 2, pageSize: 20, totalCount: 266, label: "Bottom pagination" }),
  ));
  const ids = [...both.matchAll(/ id="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, 4);
  assert.equal(new Set(ids).size, 4);
  assert.match(both, /aria-label="Top pagination"/);
  assert.match(both, /aria-label="Bottom pagination"/);
});

test("empty and unavailable pages render recovery without inventing displayed records", () => {
  const empty = html({ currentPage: 5, totalCount: 0 });
  assert.match(empty, /No records/);
  assert.match(empty, /Page 0 of 0/);
  assert.equal((empty.match(/<button[^>]* disabled=""/g) || []).length, 5);
  const invalid = html({ currentPage: 99 });
  assert.match(invalid, /No records on this page · 266 total/);
  assert.match(invalid, /Page 99 unavailable/);
  assert.match(invalid, /Choose a page from 1 to 14/);
  assert.doesNotMatch(invalid, /1,961–266/);
  assert.doesNotMatch(html({ allowPageSizeChange: false }), /Rows per page|<select/);
});

test("submitting a typed page invokes real navigation with filters preserved and no scroll jump", () => {
  const ui = interactivePager();
  nodes(ui.renderJump(), node => node.type === "input")[0].props.onChange({ target: { value: "8" } });
  let prevented = false;
  nodes(ui.renderJump(), node => node.type === "form")[0].props.onSubmit({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(ui.pushes.length, 1);
  assert.equal(ui.pushes[0][0], helpers.adminPaginationHref("/admin/ledger", query, 8));
  assert.deepEqual(ui.pushes[0][1], { scroll: false });
});

test("invalid input shows an accessible error; out-of-range input clamps before navigation", () => {
  const ui = interactivePager();
  const enter = value => nodes(ui.renderJump(), node => node.type === "input")[0].props.onChange({ target: { value } });
  const submit = () => nodes(ui.renderJump(), node => node.type === "form")[0].props.onSubmit({ preventDefault() {} });
  enter("2.5"); submit();
  assert.equal(ui.pushes.length, 0);
  assert.equal(nodes(ui.renderJump(), node => node.props?.role === "alert").length, 1);
  assert.equal(nodes(ui.renderJump(), node => node.type === "input")[0].props["aria-invalid"], true);
  enter("999"); submit();
  assert.equal(ui.pushes[0][0], helpers.adminPaginationHref("/admin/ledger", query, 14));
  assert.equal(nodes(ui.renderJump(), node => node.type === "input")[0].props.value, "14");
});

test("changing rows resets to page one; pending navigation blocks all controls and duplicates", () => {
  const ui = interactivePager();
  nodes(ui.render(), node => node.type === "select")[0].props.onChange({ target: { value: "50" } });
  assert.equal(ui.pushes[0][0], helpers.adminPaginationHref("/admin/ledger", query, 1, 50));
  ui.setPending(true);
  const tree = ui.render();
  assert.equal(tree.props["aria-busy"], true);
  for (const control of nodes(tree, node => ["select", "button"].includes(node.type))) assert.equal(control.props.disabled, true);
  for (const control of nodes(ui.renderJump(), node => ["input", "button"].includes(node.type))) assert.equal(control.props.disabled, true);
  nodes(tree, node => node.props?.["aria-label"] === "Next page")[0].props.onClick();
  nodes(ui.renderJump(), node => node.type === "form")[0].props.onSubmit({ preventDefault() {} });
  assert.equal(ui.pushes.length, 1);
});

for (const [route, actionName] of [["audit", "getAuditLogs"], ["feedback", "getFeedbackHistory"], ["kyc", "getKycHistory"]]) {
  test(`${route} uses selected row size and leaves pagination reachable on an empty requested page`, async () => {
    const calls = [];
    const actions = {
      getFeedbackQueue: async () => [], getKycQueue: async () => [],
      [actionName]: async (...args) => { calls.push(args); return { data: [], total: 120 }; },
    };
    const Page = compile(`app/(panel)/admin/(protected)/${route}/page.tsx`, {
      "@/app/actions/admin.actions": actions,
      "@/components/admin/AdminPagination": { AdminPagination: pager() },
      "@/components/admin/FeedbackModerateButtons": { FeedbackModerateButtons: () => null },
      "@/components/admin/KycActionButtons": { KycActionButtons: () => null },
      "@/components/admin/EditableCustomerCode": { EditableCustomerCode: () => null },
    }).default;
    const output = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ page: "99", pageSize: "20" }) }));
    assert.deepEqual(calls, [[99, 20]]);
    assert.match(output, /Choose another page below/);
    assert.match(output, /Go to page/);
    assert.match(output, /No records on this page · 120 total/);
  });
}
