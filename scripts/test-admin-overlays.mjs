// Run: node --test scripts/test-admin-overlays.mjs
// Exercises production positioning/lock logic without a browser or new deps.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

function loadModule(path, globals = {}) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loaded = { exports: {} };
  vm.runInNewContext(compiled, { module: loaded, exports: loaded.exports, ...globals }, { filename: path });
  return loaded.exports;
}

const { getAnchoredPosition } = loadModule("components/ui/anchored-position.ts");
const anchor = { left: 100, right: 300, top: 100, bottom: 144, width: 200 };
const defaultOptions = { anchor, width: 200, height: 240, viewportWidth: 1280, viewportHeight: 800 };

test("opens below with room, and flips above near the viewport bottom", () => {
  const below = getAnchoredPosition(defaultOptions);
  assert.equal(below.side, "bottom");
  assert.equal(below.top, 152);
  const above = getAnchoredPosition({ ...defaultOptions, anchor: { ...anchor, top: 700, bottom: 744 } });
  assert.equal(above.side, "top");
  assert.equal(above.top, 452);
});

test("clamps menus and long tooltips inside narrow mobile viewports", () => {
  const result = getAnchoredPosition({ ...defaultOptions, width: 500, viewportWidth: 320, anchor: { ...anchor, left: 270, right: 310, width: 40 } });
  assert.equal(result.width, 304);
  assert.equal(result.left, 8);
  assert.ok(result.left + result.width <= 312);
});

test("supports right and centre alignment and top-preferred tooltips", () => {
  const end = getAnchoredPosition({ ...defaultOptions, width: 140, align: "end" });
  assert.equal(end.left, 160);
  const centre = getAnchoredPosition({ ...defaultOptions, width: 140, align: "center" });
  assert.equal(centre.left, 130);
  const tooltip = getAnchoredPosition({ ...defaultOptions, preferredSide: "top", height: 60 });
  assert.equal(tooltip.side, "top");
  assert.equal(tooltip.top, 32);
});

test("respects visual viewport offsets and limited height when zoomed or keyboard is open", () => {
  const result = getAnchoredPosition({
    ...defaultOptions, viewportWidth: 320, viewportHeight: 220, viewportLeft: 50, viewportTop: 400,
    anchor: { left: 320, right: 390, top: 480, bottom: 524, width: 70 },
  });
  assert.ok(result.left >= 58);
  assert.ok(result.left + result.width <= 362);
  assert.ok(result.top >= 408);
  assert.ok(result.top + Math.min(240, result.maxHeight) <= 612);
});

function styleDeclaration(value = "", priority = "") {
  const values = new Map(value ? [["overflow", { value, priority }]] : []);
  return {
    getPropertyValue: name => values.get(name)?.value ?? "",
    getPropertyPriority: name => values.get(name)?.priority ?? "",
    setProperty: (name, next, nextPriority = "") => values.set(name, { value: next, priority: nextPriority }),
    removeProperty: name => values.delete(name),
  };
}

test("closing an underlying dialog preserves the active dialog and scroll locks", () => {
  const rootStyle = styleDeclaration("auto", "important");
  const bodyStyle = styleDeclaration("scroll");
  const stack = loadModule("components/admin/ui/admin-dialog-stack.ts", {
    document: { documentElement: { style: rootStyle }, body: { style: bodyStyle } },
  });
  const first = {};
  const second = {};
  let notifications = 0;
  const unsubscribe = stack.subscribeAdminDialogs(() => notifications++);
  const closeFirst = stack.registerAdminDialog(first);
  const closeSecond = stack.registerAdminDialog(second);
  assert.equal(stack.getActiveAdminDialog(), second);
  closeFirst();
  assert.equal(stack.getActiveAdminDialog(), second);
  assert.equal(bodyStyle.getPropertyValue("overflow"), "hidden");
  assert.equal(rootStyle.getPropertyValue("overflow"), "hidden");
  closeSecond();
  assert.equal(stack.getActiveAdminDialog(), null);
  assert.equal(bodyStyle.getPropertyValue("overflow"), "scroll");
  assert.equal(rootStyle.getPropertyValue("overflow"), "auto");
  assert.equal(rootStyle.getPropertyPriority("overflow"), "important");
  assert.equal(notifications, 4);
  closeFirst();
  closeSecond();
  assert.equal(notifications, 4, "cleanup must be idempotent");
  unsubscribe();
});

test("closing the top dialog restores the previous active dialog and clears initially empty styles", () => {
  const style = styleDeclaration();
  const stack = loadModule("components/admin/ui/admin-dialog-stack.ts", {
    document: { documentElement: { style }, body: { style } },
  });
  const first = {};
  const closeFirst = stack.registerAdminDialog(first);
  const closeSecond = stack.registerAdminDialog({});
  closeSecond();
  assert.equal(stack.getActiveAdminDialog(), first);
  closeFirst();
  assert.equal(style.getPropertyValue("overflow"), "");
  assert.equal(stack.getServerAdminDialog(), null);
});
