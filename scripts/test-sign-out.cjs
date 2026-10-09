/* eslint-disable @typescript-eslint/no-require-imports */
// Synthetic cookies and mocked Auth transport only; never signs out a real user.
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { NextRequest } = require("next/server");

function compile(file, mocks, globals = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(readFileSync(resolve(__dirname, "..", file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, {
    module, exports: module.exports, require: name => mocks[name] ?? require(name),
    URL, URLSearchParams, AbortController, Event, setTimeout, clearTimeout,
    process: { env: { NEXT_PUBLIC_SUPABASE_URL: "https://fixture.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-only" } },
    ...globals,
  });
  return module.exports;
}
function server(implementation = async () => ({ error: null })) {
  const calls = [], timers = [];
  let options;
  const route = compile("app/api/auth/signout/route.ts", {
    "@supabase/ssr": { createServerClient: (_url, _key, settings) => {
      options = settings;
      return { auth: { signOut: args => { calls.push(args); return implementation(settings); } } };
    } },
  }, { setTimeout: fn => { timers.push(fn); return timers.length; }, clearTimeout() {} });
  const request = (origin = "https://zarman.test", cookie = "sb-fixture-auth-token.0=synthetic; sb-fixture-auth-token.1=chunk; sb-fixture-auth-token-code-verifier=proof; sb-fixture-auth-token-user=user; preference=keep; sb-other-auth-token=keep") => new NextRequest("https://zarman.test/api/auth/signout", {
    method: "POST", headers: { ...(origin ? { origin } : {}), cookie },
  });
  return { ...route, request, calls, timers, options: () => options };
}

test("logout server revokes only the supplied session and clears every auth cookie chunk", async () => {
  const h = server(async settings => {
    settings.cookies.setAll([{ name: "sb-fixture-auth-token.2", value: "a-refreshed-chunk", options: {} }]);
    return { error: null };
  });
  const result = await h.POST(h.request());
  assert.equal(result.status, 200); assert.equal((await result.json()).signedOut, true);
  assert.equal(h.calls.length, 1); assert.equal(h.calls[0].scope, "local");
  assert.match(result.headers.get("cache-control"), /private, no-store/);
  const cookies = result.cookies.getAll();
  assert.equal(cookies.length, 5);
  for (const cookie of cookies) {
    assert.equal(cookie.value, ""); assert.equal(cookie.maxAge, 0);
    assert.equal(cookie.path, "/"); assert.equal(cookie.secure, true);
  }
  assert.equal(result.cookies.get("preference"), undefined); assert.equal(result.cookies.get("sb-other-auth-token"), undefined);
});

test("logout rejects foreign or missing Origin before touching authentication", async () => {
  const h = server();
  for (const origin of ["https://attacker.test", null]) assert.equal((await h.POST(h.request(origin))).status, 403);
  assert.equal(h.calls.length, 0); assert.equal(h.GET, undefined);
});

test("logout failures preserve the session for retry and never claim success", async () => {
  const h = server(async () => ({ error: { message: "private upstream detail" } }));
  const response = await h.POST(h.request());
  assert.equal(response.status, 503); assert.equal(response.headers.get("set-cookie"), null);
  assert.doesNotMatch(await response.text(), /private upstream detail|signedOut/);
});

test("logout server timeout aborts auth transport without clearing unconfirmed sessions", async () => {
  let signal;
  const h = server();
  let fire;
  const route = compile("app/api/auth/signout/route.ts", {
    "@supabase/ssr": { createServerClient: (_url, _key, settings) => ({ auth: { signOut: () => settings.global.fetch("https://fixture.invalid") } }) },
  }, {
    fetch: (_input, init) => { signal = init.signal; return new Promise(() => {}); },
    setTimeout: fn => { fire = fn; return 1; }, clearTimeout() {},
  });
  const pending = route.POST(h.request()); fire();
  const response = await pending;
  assert.equal(signal.aborted, true); assert.equal(response.status, 503);
  assert.equal(response.headers.get("set-cookie"), null);
});

test("logout works with the installed Supabase SSR client and a synthetic cookie session", async () => {
  const calls = [];
  const route = compile("app/api/auth/signout/route.ts", {}, {
    fetch: async (url, init) => { calls.push({ url: String(url), init }); return new Response(null, { status: 204 }); },
  });
  const session = { access_token: "synthetic-access", refresh_token: "synthetic-refresh", expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: "bearer", user: { id: "00000000-0000-4000-8000-000000000001" } };
  const cookie = `sb-fixture-auth-token=base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
  const response = await route.POST(server().request("https://zarman.test", cookie));
  assert.equal(response.status, 200); assert.equal(calls.length, 1);
  const destination = new URL(calls[0].url);
  assert.equal(destination.pathname, "/auth/v1/logout"); assert.equal(destination.searchParams.get("scope"), "local");
  assert.equal(calls[0].init.method, "POST"); assert.equal(response.cookies.get("sb-fixture-auth-token").maxAge, 0);
});

test("logout is idempotent when there is no session cookie", async () => {
  const h = server();
  assert.equal((await h.POST(h.request("https://zarman.test", "preference=keep"))).status, 200);
});

function browser(fetch) {
  const events = [], redirects = [], storage = [], timers = [], auth = [];
  const api = compile("lib/auth/sign-out.ts", {
    "@/lib/supabase": { supabase: { auth: {
      stopAutoRefresh: async () => { auth.push("stop"); }, startAutoRefresh: async () => { auth.push("start"); },
      signOut: () => { throw Error("Browser auth locks must not govern logout"); },
    } } },
  }, {
    fetch, crypto: { randomUUID: () => "synthetic-notification" },
    window: {
      setTimeout: fn => { timers.push(fn); return timers.length; }, clearTimeout() {},
      dispatchEvent: event => events.push(event.type),
      localStorage: { setItem: (key, value) => storage.push([key, value]) },
      location: { replace: path => redirects.push(path) },
    },
  });
  return { api, events, redirects, storage, timers, auth };
}
test("logout clicks share one POST and use a single fresh-document redirect after success", async () => {
  let finish; const calls = [];
  const h = browser((path, init) => { calls.push({ path, init }); return new Promise(resolve => { finish = resolve; }); });
  const first = h.api.signOutAndRedirect("fa"), second = h.api.signOutAndRedirect("fa");
  assert.equal(first, second); assert.equal(calls.length, 1); assert.equal(calls[0].init.method, "POST");
  assert.equal(h.redirects.length, 0);
  finish({ ok: true, json: async () => ({ signedOut: true, redirect: "https://attacker.test" }) });
  await first; h.api.redirectToSignIn("fa");
  assert.deepEqual(h.redirects, ["/fa/login"]);
  assert.deepEqual(h.events, [h.api.SIGN_OUT_STARTED, h.api.SIGNED_OUT]);
  assert.deepEqual(h.auth, ["stop"]); assert.equal(h.storage.length, 1);
});

test("logout network timeout restores controls for retry without reporting a signed-out session", async () => {
  let succeed = false;
  const h = browser((_path, init) => succeed ? Promise.resolve({ ok: true, json: async () => ({ signedOut: true }) })
    : new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(Error("offline")))));
  const first = h.api.signOutAndRedirect("en"); h.timers[0]();
  await assert.rejects(first, /offline/);
  assert.equal(h.api.isSigningOut(), false); assert.equal(h.redirects.length, 0); assert.equal(h.storage.length, 0);
  assert.deepEqual(h.auth, ["stop", "start"]);
  succeed = true; await h.api.signOutAndRedirect("en");
  assert.deepEqual(h.redirects, ["/en/login"]);
});
