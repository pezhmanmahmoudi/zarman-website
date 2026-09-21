/* eslint-disable @typescript-eslint/no-require-imports -- Offline pointer and motion preference checks. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { test } = require("node:test");
const React = require("react");
const { dashboardHarness } = require("./helpers/dashboard-harness.cjs");

function descendants(tree, predicate) {
  const result = [];
  const visit = node => {
    if (!React.isValidElement(node)) return;
    if (predicate(node)) result.push(node);
    React.Children.forEach(node.props.children, visit);
  };
  visit(tree);
  return result;
}
const motion = new Proxy({}, { get: (_, name) => `motion.${name}` });

function magicHarness({ reduced = false, enabled = true } = {}) {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const windowListeners = new Map(), documentListeners = new Map();
  const listenable = listeners => ({
    addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener: (name, callback) => { if (listeners.get(name) === callback) listeners.delete(name); },
  });
  const document = { ...listenable(documentListeners), visibilityState: "visible" };
  Object.defineProperty(globalThis, "window", { configurable: true, value: listenable(windowListeners) });
  Object.defineProperty(globalThis, "document", { configurable: true, value: document });
  const values = [];
  let valueIndex = 0, boundsReads = 0;
  const useMotionValue = initial => {
    const index = valueIndex++;
    return values[index] ||= { value: initial, set(next) { this.value = next; }, jump(next) { this.value = next; } };
  };
  const h = dashboardHarness({ mocks: { "motion/react": {
    motion, useReducedMotion: () => reduced, useMotionValue,
    useSpring: source => useMotionValue(source.value),
    useMotionTemplate: (strings, ...parts) => ({ strings, parts }),
  } } });
  const { MagicCard } = h.load("components/ui/magic-card.tsx");
  let props = { motionEnabled: enabled, children: React.createElement("button", { type: "button" }, "View transfer") };
  const render = updates => {
    props = { ...props, ...updates };
    valueIndex = 0;
    return h.render(MagicCard, props);
  };
  const event = pointerType => ({
    pointerType, clientX: 120, clientY: 95,
    currentTarget: { getBoundingClientRect() { boundsReads++; return { left: 20, top: 30 }; } },
  });
  return {
    render, event, values, h, document, windowListeners, documentListeners,
    reduced(value) { reduced = value; },
    get boundsReads() { return boundsReads; },
    cleanup() {
      h.cleanup();
      if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow); else delete globalThis.window;
      if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument); else delete globalThis.document;
    },
  };
}

test("Magic Card keeps real controls on a light surface and tracks only mouse pointers", () => {
  const h = magicHarness();
  try {
    const events = [];
    const tree = h.render({ onPointerMove: event => events.push(event.pointerType), contentClassName: "p-6", "aria-label": "Current transfer" });
    assert.equal(tree.props["aria-label"], "Current transfer");
    assert.equal(tree.props["data-magic-motion"], "on");
    assert.match(tree.props.className, /bg-white/);
    assert.doesNotMatch(tree.props.className, /dark:/);
    assert.equal(descendants(tree, node => node.type === "button")[0].props.children, "View transfer");
    const overlay = descendants(tree, node => node.type === "motion.div" && node.props["aria-hidden"] === "true")[0];
    assert.match(overlay.props.className, /pointer-events-none/);
    for (const type of ["touch", "pen"]) tree.props.onPointerMove(h.event(type));
    assert.equal(h.boundsReads, 0, "Touch gestures must not read layout or trigger spring tracking");
    assert.equal(h.values[2].value, 0);
    tree.props.onPointerMove(h.event("mouse"));
    assert.equal(h.boundsReads, 1);
    assert.deepEqual(h.values.slice(0, 3).map(value => value.value), [100, 65, 1]);
    assert.deepEqual(events, ["touch", "pen", "mouse"], "Consumer pointer handlers remain intact");
    tree.props.onPointerLeave(h.event("mouse"));
    assert.equal(h.values[2].value, 0);
    assert.ok(h.values[0].value < 0 && h.values[1].value < 0);
  } finally { h.cleanup(); }
});

test("pause and system reduced motion remove Magic Card lighting without removing its content", () => {
  for (const options of [{ enabled: false }, { reduced: true }, { reduced: null }]) {
    const h = magicHarness(options);
    try {
      const tree = h.render(); h.h.effects();
      assert.equal(tree.props["data-magic-motion"], "off");
      assert.equal(descendants(tree, node => node.type === "motion.div").length, 0);
      tree.props.onPointerMove(h.event("mouse"));
      assert.equal(h.boundsReads, 0);
      assert.equal(descendants(tree, node => node.type === "button").length, 1);
      assert.equal(h.windowListeners.size + h.documentListeners.size, 0);
    } finally { h.cleanup(); }
  }
  const h = magicHarness();
  try {
    h.render().props.onPointerMove(h.event("mouse"));
    assert.equal(h.values[2].value, 1);
    h.render({ motionEnabled: false }); h.h.effects();
    assert.equal(h.values[2].value, 0, "Pausing clears an already visible glow");
  } finally { h.cleanup(); }
});

test("Magic Card clears stale lighting on background or blur and removes listeners on unmount", () => {
  const h = magicHarness();
  try {
    let tree = h.render({ mode: "orb" }); h.h.effects();
    tree.props.onPointerEnter(h.event("mouse"));
    assert.equal(h.values[2].value, 1);
    h.document.visibilityState = "hidden";
    h.documentListeners.get("visibilitychange")();
    assert.equal(h.values[2].value, 0);
    assert.ok(h.values[3].value < 0 && h.values[4].value < 0, "Orb springs jump offscreen immediately");
    h.document.visibilityState = "visible";
    tree.props.onPointerEnter(h.event("mouse"));
    h.windowListeners.get("blur")();
    assert.equal(h.values[2].value, 0);
    h.h.cleanup();
    assert.equal(h.windowListeners.size + h.documentListeners.size, 0);
  } finally { h.cleanup(); }
});

test("a card's local preference cannot override the dashboard pause control", () => {
  const h = dashboardHarness({ mocks: {
    "./DashboardMotion": { useDashboardMotion: () => false },
    "@/components/ui/magic-card": { MagicCard: () => null },
  } });
  const { DashboardMagicCard } = h.load("components/dashboard/dashboard-ui.tsx");
  const tree = h.render(DashboardMagicCard, { motionEnabled: true, tone: "amber", children: "Payment details" });
  assert.equal(tree.props.motionEnabled, false);
  assert.equal(tree.props.children, "Payment details");
  assert.equal(tree.props["data-card-tone"], "amber");
});

test("Aurora greeting keeps one accessible name and seven-second colour motion without moving letters", () => {
  for (const reduced of [false, true, null]) {
    const h = dashboardHarness({ mocks: { "framer-motion": { useReducedMotion: () => reduced } } });
    const { AuroraText } = h.load("components/ui/aurora-text.tsx");
    for (const name of ["Helloooo, Alex", "\u0633\u0644\u0627\u0645\u060c \u067e\u0698\u0645\u0627\u0646"]) {
      const tree = h.render(AuroraText.type, { children: name });
      const accessible = descendants(tree, node => node.props.className === "sr-only");
      const decorated = descendants(tree, node => node.props["aria-hidden"] === "true")[0];
      assert.equal(accessible.length, 1); assert.equal(accessible[0].props.children, name);
      assert.equal(decorated.props.children, name);
      assert.equal(decorated.props.style.animationDuration, "7s");
      assert.equal(decorated.props.style.animationName, reduced === false ? undefined : "none");
      const paused = h.render(AuroraText.type, { children: name, motionEnabled: false });
      assert.equal(descendants(paused, node => node.props["aria-hidden"] === "true")[0].props.style.animationName, "none");
    }
  }
  const css = fs.readFileSync("app/globals.css", "utf8");
  assert.match(css, /--animate-aurora:\s*aurora 7s ease-in-out 1 both/);
  const keyframes = css.slice(css.indexOf("@keyframes aurora"));
  assert.doesNotMatch(keyframes, /transform:\s*(?:rotate|scale)/);
});

function orbitHarness({ dashboardMotion = true, reduced = false, visible = true } = {}) {
  const h = dashboardHarness({ mocks: {
    react: { ...React, useId: () => "orbit-fixture", useRef: initial => ({ current: initial }) },
    "framer-motion": { motion, useReducedMotion: () => reduced, useInView: () => visible },
    "./DashboardMotion": { useDashboardMotion: () => dashboardMotion },
  } });
  const { default: TransferBrandMotif } = h.load("components/dashboard/TransferBrandMotif.tsx");
  const render = props => {
    const tree = h.render(TransferBrandMotif, { locale: "en", ...props });
    const orbit = tree.props.children;
    return { tree, orbit, art: h.render(orbit.type, orbit.props) };
  };
  return { render, visible(value) { visible = value; } };
}

test("the circular logo runs one seven-second flourish when visible and only stage or process changes reset its key", () => {
  const h = orbitHarness({ visible: false });
  const hidden = h.render({ stage: 1, replayKey: "ZE19345" });
  assert.equal(hidden.art.props["data-orbit-motion"], "still");
  h.visible(true);
  const first = h.render({ stage: 1, replayKey: "ZE19345" });
  assert.equal(first.art.props["data-orbit-motion"], "playing");
  const animated = descendants(first.art, node => String(node.type).startsWith("motion."));
  assert.equal(animated.length, 4);
  for (const node of animated) {
    assert.equal(node.props.transition.duration, 7);
    assert.equal(node.props.transition.repeat, undefined);
    assert.equal(node.props.initial, false);
  }
  assert.equal(first.orbit.key, h.render({ stage: 1, replayKey: "ZE19345" }).orbit.key);
  assert.notEqual(first.orbit.key, h.render({ stage: 2, replayKey: "ZE19345" }).orbit.key);
  assert.notEqual(first.orbit.key, h.render({ stage: 1, replayKey: "ZE88495" }).orbit.key);
  assert.equal(first.tree.props.dir, "ltr");
  assert.equal(first.tree.props["aria-hidden"], "true");
  const logo = descendants(first.art, node => node.props.src === "/images/logo-no-text-light.svg");
  assert.equal(logo.length, 1);
  assert.equal(logo[0].props.style.transform, "none");
  assert.equal(logo[0].props.alt, "");
});

test("logo motion is decorative and respects every pause preference while retaining the original mark", () => {
  for (const options of [{ dashboardMotion: false }, { reduced: true }, { reduced: null }]) {
    const h = orbitHarness(options), { art } = h.render({ motionEnabled: true });
    assert.equal(art.props["data-orbit-motion"], "still");
    for (const node of descendants(art, node => String(node.type).startsWith("motion."))) assert.equal(node.props.transition.duration, 0);
    assert.equal(descendants(art, node => node.props.src === "/images/logo-no-text-light.svg").length, 1);
  }
  for (const props of [{ motionEnabled: false }, { quiet: true }]) assert.equal(orbitHarness().render(props).art.props["data-orbit-motion"], "still");
  for (const [stage, safe] of [[-1, 0], [99, 4], [NaN, 0]]) assert.equal(orbitHarness().render({ stage }).tree.props["data-stage"], safe);
});
