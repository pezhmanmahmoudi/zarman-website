/* eslint-disable @typescript-eslint/no-require-imports -- Offline scene registry checks. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { dashboardHarness } = require("./helpers/dashboard-harness.cjs");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

test("customer Lottie scenes are local, vector-only and bounded for lazy card loading", () => {
  const h = dashboardHarness();
  const scenes = h.load("lib/dashboard/lottie-scenes.ts").dashboardLottieScenes;
  assert.ok(Object.keys(scenes).length >= 18);

  for (const [name, scene] of Object.entries(scenes)) {
    assert.match(scene.src, /^\/animations\/dashboard\/preview\/[a-z0-9-]+\.json$/);
    const file = path.join(__dirname, "../public", scene.src);
    assert.ok(fs.existsSync(file), `${name} is missing ${scene.src}`);
    const raw = fs.readFileSync(file, "utf8");
    const animation = JSON.parse(raw);
    assert.ok(Buffer.byteLength(raw) <= 500_000, `${name} exceeds the reviewed per-scene budget`);
    assert.ok(animation.w > 0 && animation.h > 0 && animation.w <= 3200 && animation.h <= 3200);
    assert.ok(animation.fr > 0 && animation.fr <= 60);
    assert.ok((animation.op - animation.ip) / animation.fr > 0 && (animation.op - animation.ip) / animation.fr <= 13);
    assert.ok(Array.isArray(animation.layers) && animation.layers.length > 0);
    assert.ok(!animation.assets?.some(asset => asset.p || asset.u), `${name} contains a raster or external asset`);
    if (animation.fonts) assert.ok(animation.fonts.list.every(font => !font.fPath), `${name} references an external font`);
    if (animation.chars) assert.ok(animation.chars.every(char => !char.ch.trim() || Array.isArray(char.data?.shapes)), `${name} has invalid embedded glyphs`);
    assert.doesNotMatch(raw, /https?:|javascript:/i);
  }
});

test("request scenes follow recorded payment facts without claiming false success", () => {
  const h = dashboardHarness();
  const { requestLottieScene } = h.load("lib/dashboard/request-lottie-scene.ts");
  const base = { mood: "waiting", customerActionRequired: false, canPay: false, receiptSubmitted: false, fundsReceived: false, closed: false };
  const cases = [
    [{ ...base, mood: "complete" }, "transfer-complete"],
    [{ ...base, mood: "failed" }, "payment-failed"],
    [{ ...base, customerActionRequired: true }, "alert"],
    [{ ...base, canPay: true }, "mobile-payment"],
    [{ ...base, fundsReceived: true }, "payment-confirmed"],
    [{ ...base, mood: "quiet" }, "warning"],
    [{ ...base, closed: true }, "warning"],
    [base, "compliance-review"],
  ];
  for (const [journey, expected] of cases) assert.equal(requestLottieScene(journey), expected);
});

test("recipient avatar trims its tail to 3.5 seconds at original speed without changing other scenes", () => {
  const h = dashboardHarness({ mocks: { "lottie-react": { LottieLight: () => null } } });
  const scenes = h.load("lib/dashboard/lottie-scenes.ts").dashboardLottieScenes;
  const { DashboardLottieScenePlayer } = h.load("components/dashboard/DashboardLottieScenePlayer.tsx");
  for (const [name, scene] of Object.entries(scenes)) {
    const tree = h.render(DashboardLottieScenePlayer, { name, playing: true, onReady() {}, onComplete() {}, onError() {} });
    if (name === "recipient-avatar") {
      const animation = JSON.parse(fs.readFileSync(path.join(__dirname, "../public", scene.src), "utf8"));
      assert.deepEqual(tree.props.segment, [0, 84]);
      assert.equal(tree.props.speed, 1);
      assert.equal((tree.props.segment[1] - tree.props.segment[0]) / animation.fr, 3.5);
      assert.ok(tree.props.segment[1] < animation.op);
      assert.equal(tree.props.loop, false);
      assert.equal(scene.holdOnComplete, true);
    } else if (name === "document-upload-success") {
      assert.deepEqual(tree.props.segment, [0, 47]);
      assert.equal(tree.props.speed, 1);
      assert.equal(tree.props.loop, false);
      assert.equal(scene.holdOnComplete, true);
    } else {
      assert.equal(tree.props.speed, 1);
      assert.equal(tree.props.segment, undefined);
    }
  }
});

test("upload success holds a fully drawn check and blue circle before the asset's blank tail", () => {
  const h = dashboardHarness();
  const scene = h.load("lib/dashboard/lottie-scenes.ts").dashboardLottieScenes["document-upload-success"];
  const animation = JSON.parse(fs.readFileSync(path.join(__dirname, "../public", scene.src), "utf8"));
  const lastFrame = scene.segment[1] - 1;
  for (const name of ["check", "elipse bold"]) {
    const layer = animation.layers.find(item => item.nm === name);
    assert.ok(layer, `${name} must be present`);
    assert.ok(lastFrame >= layer.ip && lastFrame < layer.op, `${name} must still be visible at completion`);
    const opacity = layer.ks.o;
    assert.equal(opacity.a ? opacity.k.at(-1).s[0] : opacity.k, 100);
    if (opacity.a) assert.ok(opacity.k.at(-1).t <= lastFrame);
    if (name === "check") {
      const trim = layer.shapes.find(shape => shape.ty === "tm").e.k.at(-1);
      assert.equal(trim.s[0], 100);
      assert.ok(trim.t <= lastFrame, "check must be fully drawn");
    }
    assert.ok(layer.op < animation.op, "source has a blank tail that must not play");
  }
});

test("card hover replay is mouse-only, opt-in and respects both motion preferences", () => {
  for (const options of [{}, { reduced: true }, { reduced: null }, { enabled: false }, { motionEnabled: false }, { replayLottieOnHover: false }]) {
    let forwarded = 0;
    const h = dashboardHarness({ mocks: {
      "framer-motion": { useReducedMotion: () => options.reduced === undefined ? false : options.reduced },
      "./DashboardMotion": { useDashboardMotion: () => options.enabled !== false },
    } });
    const { DashboardMagicCard } = h.load("components/dashboard/dashboard-ui.tsx");
    const props = { replayLottieOnHover: true, ...options, onPointerEnter() { forwarded++; } };
    const render = () => h.render(DashboardMagicCard, props);
    const counter = () => render().props.children.props.value;
    assert.equal(counter(), 0);
    for (const pointerType of ["touch", "pen"]) render().props.onPointerEnter({ pointerType });
    assert.equal(counter(), 0);
    render().props.onPointerEnter({ pointerType: "mouse" });
    const expected = Object.keys(options).length ? 0 : 1;
    assert.equal(counter(), expected);
    render().props.onPointerEnter({ pointerType: "mouse" });
    assert.equal(counter(), expected * 2);
    assert.equal(forwarded, 4);
    h.cleanup();
  }
});

test("scene player rewinds the existing instance on replay and defers replay while paused", () => {
  const h = dashboardHarness({ mocks: { "lottie-react": { LottieLight: () => null } } });
  const { DashboardLottieScenePlayer } = h.load("components/dashboard/DashboardLottieScenePlayer.tsx");
  const calls = [];
  const props = { name: "recipient-avatar", playing: true, replayKey: 0, onReady() {}, onComplete() {}, onError() {} };
  const render = updates => { Object.assign(props, updates); const tree = h.render(DashboardLottieScenePlayer, props); h.effects(); return tree; };
  const first = h.render(DashboardLottieScenePlayer, props);
  first.props.lottieRef.current = { play() { calls.push("play"); }, pause() { calls.push("pause"); }, seek(frame) { calls.push(["seek", frame]); } };
  h.effects(); calls.length = 0;
  const replay = render({ replayKey: 1 });
  assert.equal(replay.props.lottieRef, first.props.lottieRef);
  assert.equal(replay.props.src, first.props.src);
  assert.deepEqual(calls, [["seek", 0], "play"]);
  calls.length = 0; render({ playing: false, replayKey: 2 });
  assert.deepEqual(calls, ["pause"]);
  calls.length = 0; render({ playing: true });
  assert.deepEqual(calls, [["seek", 0], "play"]);
  assert.equal(replay.props.loop, false);
  h.cleanup();
});

test("refresh lives in the active transfer hero, never the empty or finished hero", () => {
  const { request } = require("./helpers/dashboard-harness.cjs");
  const h = dashboardHarness();
  const { TransferOverviewCard } = h.load("components/dashboard/TransferOverviewCard.tsx");
  const render = value => renderToStaticMarkup(React.createElement(TransferOverviewCard, { request: value, locale: "en", motionEnabled: false, onRetry() {} }));
  assert.match(render(request), /aria-label="Refresh Status"/);
  assert.doesNotMatch(render(request), /New transfer/);
  for (const value of [null, { ...request, status: "completed" }, { ...request, status: "cancelled" }]) assert.doesNotMatch(render(value), /aria-label="Refresh Status"/);
  assert.match(render(null), /New transfer/);
});
