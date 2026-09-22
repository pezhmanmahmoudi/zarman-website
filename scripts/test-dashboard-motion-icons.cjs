/* eslint-disable @typescript-eslint/no-require-imports -- Offline animation lifecycle and asset checks. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const React = require("react");
const { dashboardHarness } = require("./helpers/dashboard-harness.cjs");

const flush = () => new Promise(resolve => setImmediate(resolve));
function descendants(node, predicate) {
  const result = [];
  function visit(value) {
    if (!React.isValidElement(value)) return;
    if (predicate(value)) result.push(value);
    React.Children.forEach(value.props.children, visit);
  }
  visit(node);
  return result;
}

function animationHarness({ enabled = true, reduced = false, observation = true, failImport = false } = {}) {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const originalObserver = Object.getOwnPropertyDescriptor(globalThis, "IntersectionObserver");
  const listeners = new Map(), observers = [];
  const document = {
    hidden: false,
    addEventListener(name, callback) { listeners.set(name, callback); },
    removeEventListener(name, callback) { if (listeners.get(name) === callback) listeners.delete(name); },
  };
  let imports = 0, motion = enabled;
  const Player = () => null;
  const runtime = {};
  Object.defineProperty(runtime, "DashboardLottiePlayer", { get() { imports++; if (failImport) throw Error("Chunk unavailable"); return Player; } });
  Object.defineProperty(globalThis, "document", { configurable: true, value: document });
  Object.defineProperty(globalThis, "IntersectionObserver", { configurable: true, value: observation ? class {
    constructor(callback) { this.callback = callback; this.disconnected = false; observers.push(this); }
    observe(node) { this.node = node; }
    disconnect() { this.disconnected = true; }
  } : undefined });
  const h = dashboardHarness({ mocks: {
    "framer-motion": { useReducedMotion: () => reduced },
    "./DashboardMotion": { useDashboardMotion: () => motion },
    "./DashboardLottiePlayer": runtime,
  } });
  const { DashboardMotionIcon } = h.load("components/dashboard/DashboardMotionIcon.tsx");
  const assets = h.load("lib/dashboard/motion-icons.ts").dashboardMotionIcons;
  const name = Object.keys(assets)[0];
  let localMotion = true;
  const render = () => {
    const inner = h.render(DashboardMotionIcon, { name, size: 72, motionEnabled: localMotion });
    const tree = h.render(inner.type, inner.props);
    tree.props.ref.current ||= { id: "motion-icon-fixture" };
    return tree;
  };
  const player = () => descendants(render(), node => node.type === Player)[0];
  const poster = () => descendants(render(), node => node.props.src === assets[name].poster)[0];
  const step = async () => { render(); h.effects(); await flush(); render(); h.effects(); };
  return {
    h, render, player, poster, observers, listeners, assets, name,
    get imports() { return imports; },
    async mount() { render(); h.effects(); await flush(); },
    async enter(visible = true) { observers[0]?.callback([{ isIntersecting: visible }]); await step(); },
    async foreground(value) { document.hidden = !value; listeners.get("visibilitychange")?.(); await step(); },
    async motion(value) { motion = value; await step(); },
    async localMotion(value) { localMotion = value; await step(); },
    async settle() { await step(); },
    cleanup() {
      h.cleanup();
      if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument); else delete globalThis.document;
      if (originalObserver) Object.defineProperty(globalThis, "IntersectionObserver", originalObserver); else delete globalThis.IntersectionObserver;
    },
  };
}

test("motion icons defer the player until visible and retain accessible, dimensioned static art", async () => {
  const h = animationHarness();
  try {
    await h.mount();
    assert.equal(h.imports, 0);
    assert.equal(h.player(), undefined);
    assert.equal(h.render().props["aria-hidden"], "true");
    assert.equal(h.render().props.dir, "ltr");
    assert.deepEqual(h.render().props.style, { width: 72, height: 72 });
    assert.equal(h.poster().props.alt, "");
    assert.equal(h.poster().props.draggable, false);
    await h.enter();
    assert.equal(h.imports, 1);
    assert.equal(h.player().props.playing, true);
    assert.doesNotMatch(h.poster().props.className, /invisible/);
    h.player().props.onReady();
    assert.match(h.poster().props.className, /invisible/);
  } finally { h.cleanup(); }
});

test("dashboard pause, local pause and reduced motion avoid loading animation code", async () => {
  for (const options of [{ enabled: false }, { reduced: true }, { reduced: null }, { observation: false }]) {
    const h = animationHarness(options);
    try {
      await h.mount(); await h.enter();
      assert.equal(h.imports, 0);
      assert.equal(h.player(), undefined);
      assert.doesNotMatch(h.poster().props.className, /invisible/);
    } finally { h.cleanup(); }
  }
  const h = animationHarness();
  try {
    await h.localMotion(false); await h.mount(); await h.enter();
    assert.equal(h.imports, 0);
    assert.equal(h.player(), undefined);
  } finally { h.cleanup(); }
});

test("visibility pauses playback, completion stays finite, and unmount removes browser listeners", async () => {
  const h = animationHarness();
  try {
    await h.mount(); await h.enter();
    const readyPlayer = h.player();
    readyPlayer.props.onReady();
    await h.enter(false);
    assert.equal(h.player().props.playing, false);
    await h.enter(true);
    assert.equal(h.player().props.playing, true);
    await h.foreground(false);
    assert.equal(h.player().props.playing, false);
    await h.foreground(true);
    assert.equal(h.player().props.playing, true);
    h.player().props.onComplete();
    await h.settle();
    assert.equal(h.player(), undefined);
    assert.doesNotMatch(h.poster().props.className, /invisible/);
    await h.enter(false); await h.enter(true);
    assert.equal(h.player(), undefined, "A finished cue must not restart whenever the customer scrolls");
    h.h.cleanup();
    assert.equal(h.observers[0].disconnected, true);
    assert.equal(h.listeners.size, 0);
  } finally { h.cleanup(); }
});

test("background tabs do not begin loading a player and failed chunks or assets retain static art", async () => {
  const background = animationHarness();
  try {
    await background.mount(); await background.foreground(false); await background.enter();
    assert.equal(background.imports, 0);
    await background.foreground(true);
    assert.equal(background.imports, 1);
    background.player().props.onError();
    await background.settle();
    assert.equal(background.player(), undefined);
    assert.doesNotMatch(background.poster().props.className, /invisible/);
  } finally { background.cleanup(); }
  const unavailable = animationHarness({ failImport: true });
  try {
    await unavailable.mount(); await unavailable.enter(); await unavailable.settle();
    assert.equal(unavailable.player(), undefined);
    assert.doesNotMatch(unavailable.poster().props.className, /invisible/);
    const attempts = unavailable.imports;
    await unavailable.enter(false); await unavailable.enter(true);
    assert.equal(unavailable.imports, attempts, "A failed decorative chunk must not enter a retry loop");
  } finally { unavailable.cleanup(); }
});

test("pausing displays static art and resuming reuses the ready player without a blank reload", async () => {
  const h = animationHarness();
  try {
    await h.mount(); await h.enter(); h.player().props.onReady();
    assert.match(h.poster().props.className, /invisible/);
    await h.motion(false);
    assert.equal(h.player().props.playing, false);
    assert.doesNotMatch(h.poster().props.className, /invisible/);
    const playerContainer = descendants(h.render(), node => node.type === "span" && node.props.className === "invisible");
    assert.equal(playerContainer.length, 1, "Paused animated paths must not show through the transparent SVG poster");
    await h.motion(true);
    assert.equal(h.player().props.playing, true);
    assert.equal(h.imports, 1);
    assert.match(h.poster().props.className, /invisible/);
  } finally { h.cleanup(); }
});

test("light player uses local SVG-only non-looping playback and reacts to visibility controls", () => {
  const LottieLight = () => null, calls = [];
  const h = dashboardHarness({ mocks: { "lottie-react": { LottieLight } } });
  const { DashboardLottiePlayer } = h.load("components/dashboard/DashboardLottiePlayer.tsx");
  const assets = h.load("lib/dashboard/motion-icons.ts").dashboardMotionIcons;
  const name = Object.keys(assets)[0];
  let playing = true;
  const render = () => h.render(DashboardLottiePlayer, { name, playing, onReady: () => calls.push("ready"), onComplete: () => calls.push("complete"), onError: () => calls.push("error") });
  const tree = render();
  assert.equal(tree.type, LottieLight);
  assert.equal(tree.props.src, assets[name].src);
  assert.match(tree.props.src, /^\/animations\//);
  assert.equal(tree.props.autoplay, false);
  assert.equal(tree.props.loop, false);
  assert.equal(tree.props.renderer, "svg");
  assert.equal(tree.props.rendererSettings.runExpressions, false);
  assert.equal(tree.props.subscriptions.frame, undefined);
  tree.props.lottieRef.current = { play: () => calls.push("play"), pause: () => calls.push("pause") };
  h.effects();
  assert.equal(calls.at(-1), "play");
  playing = false; render(); h.effects();
  assert.equal(calls.at(-1), "pause");
  render().props.subscriptions.ready();
  assert.equal(calls.at(-1), "ready", "Hidden animations must not start when loading finishes");
  playing = true; render(); h.effects();
  assert.equal(calls.at(-1), "play");
  render().props.subscriptions.complete(); assert.equal(calls.at(-1), "complete");
  render().props.subscriptions.error(); assert.equal(calls.at(-1), "error");
  h.cleanup();
});

test("English and Persian transfer cues follow real workflow facts without implying success for refunds or rejection", () => {
  const h = dashboardHarness();
  const { journeyPresentation } = h.load("lib/dashboard/journey-presentation.ts");
  const { requestMotionIcon } = h.load("lib/dashboard/request-motion-icon.ts");
  const submitted = {
    id: "synthetic-motion-request", status: "submitted", funding_status: "unpaid", priority_fee_status: "not_applicable",
    payment_approved_at: null, evidence_submitted_at: null, funds_confirmed_at: null,
    customer_action_required: null, created_at: "2026-09-15T01:00:00Z", updated_at: "2026-09-15T01:00:00Z",
  };
  const approved = { ...submitted, status: "awaiting_funds", payment_approved_at: "2026-09-15T02:00:00Z" };
  const received = { ...approved, status: "under_review", funding_status: "confirmed", funds_confirmed_at: "2026-09-15T04:00:00Z" };
  const cases = [
    [submitted, "review"],
    [approved, "upload"],
    [{ ...approved, status: "under_review", evidence_submitted_at: "2026-09-15T03:00:00Z" }, "review"],
    [received, "received"],
    [{ ...received, status: "processing" }, "received"],
    [{ ...received, status: "reconciliation" }, "received"],
    [{ ...received, customer_action_required: "Please confirm the sender name" }, "attention"],
    [{ ...received, status: "action_required", action_required: "Internal finance check" }, "received"],
    [{ ...received, status: "completed" }, "complete"],
    [{ ...received, status: "rejected" }, "attention"],
    [{ ...received, status: "expired" }, "attention"],
    [{ ...received, status: "cancelled" }, "attention"],
    [{ ...received, funding_status: "refund_pending" }, "review"],
    [{ ...received, funding_status: "refunded" }, "attention"],
    [{ ...received, priority_fee_status: "refund_pending" }, "review"],
    [{ ...received, status: "completed", priority_fee_status: "refund_pending" }, "review"],
  ];
  for (const locale of ["en", "fa"]) for (const [request, expected] of cases) {
    const original = JSON.stringify(request);
    assert.equal(requestMotionIcon(journeyPresentation(request, locale)), expected, `${locale}: ${request.status}/${request.funding_status}/${request.priority_fee_status}`);
    assert.equal(JSON.stringify(request), original, "Presentation must never mutate a financial record");
  }
});

test("all motion assets are bounded local vectors without images, fonts, expressions or external links", () => {
  const h = dashboardHarness();
  const assets = h.load("lib/dashboard/motion-icons.ts").dashboardMotionIcons;
  assert.ok(Object.keys(assets).length >= 5, "Core workflow cues must be available locally");
  for (const [name, asset] of Object.entries(assets)) {
    for (const url of [asset.src, asset.poster]) {
      assert.match(url, /^\/animations\/[a-z0-9/_-]+\.(json|svg)$/i);
      assert.ok(fs.existsSync(path.join(__dirname, "../public", url)), `${name} is missing ${url}`);
    }
    const raw = fs.readFileSync(path.join(__dirname, "../public", asset.src), "utf8");
    const animation = JSON.parse(raw);
    assert.ok(Buffer.byteLength(raw) <= 30000, `${name} should stay a small icon`);
    assert.ok(animation.w > 0 && animation.w <= 256 && animation.h > 0 && animation.h <= 256);
    assert.ok(animation.fr > 0 && animation.fr <= 60);
    assert.ok((animation.op - animation.ip) / animation.fr > 0 && (animation.op - animation.ip) / animation.fr <= 5);
    assert.ok(animation.layers.length > 0);
    assert.ok(!animation.assets?.length);
    assert.equal(animation.fonts, undefined);
    assert.equal(animation.chars, undefined);
    assert.doesNotMatch(raw, /https?:|data:|javascript:/i);
    function inspect(value) {
      if (!value || typeof value !== "object") return;
      if (Array.isArray(value)) { value.forEach(inspect); return; }
      assert.equal(typeof value.x === "string", false, `${name} contains an executable expression`);
      if (value.ty !== undefined && typeof value.ty === "number") assert.ok([3, 4].includes(value.ty), `${name} contains a non-vector layer`);
      Object.values(value).forEach(inspect);
    }
    inspect(animation.layers);
    const poster = fs.readFileSync(path.join(__dirname, "../public", asset.poster), "utf8");
    assert.match(poster, /<svg\b/);
    assert.doesNotMatch(poster, /<script|<image|<foreignObject|\bon\w+=|(?:href|src)\s*=|<animate/i);
  }
});
