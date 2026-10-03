/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict"), { test } = require("node:test");
const { dashboardHarness } = require("./helpers/dashboard-harness.cjs");

function link(pathname, props) {
  const harness = dashboardHarness({ pathname });
  return harness.render(harness.load("components/dashboard/DashboardTabLink.tsx").DashboardTabLink, props);
}

test("client dashboard tab changes keep full destination parameters and browser history without a server navigation", () => {
  const previous = global.window;
  const history = [], scrolls = [];
  global.window = { location: { pathname: "/fa/dashboard", search: "?tab=overview" },
    history: { pushState: (...args) => history.push(args), replaceState: () => assert.fail("Must preserve back navigation") },
    scrollTo: options => scrolls.push(options) };
  try {
    const href = "/fa/dashboard?tab=transfer&requestDirection=sell_aud&requestAmountAud=1000&recipient=saved%20recipient";
    const rendered = link("/fa/dashboard", { href });
    assert.equal(rendered.props.href, href);
    assert.equal(rendered.props.prefetch, false);
    let prevented = false;
    rendered.props.onNavigate({ preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
    assert.deepEqual(history, [[null, "", href]]);
    assert.deepEqual(scrolls, [{ top: 0, behavior: "instant" }]);
  } finally { global.window = previous; }
});

test("detail routes, locale changes, fragment links and external links use the Next router", () => {
  for (const [pathname, href] of [
    ["/en/dashboard/requests/one", "/en/dashboard?tab=history"],
    ["/en/dashboard", "/en/dashboard/requests/one"],
    ["/en/dashboard", "/fa/dashboard?tab=profile"],
    ["/en/dashboard", "/en/dashboard#details"],
    ["/en/dashboard", "https://example.com/en/dashboard?tab=profile"],
    ["/admin", "/admin?tab=history"],
  ]) {
    const rendered = link(pathname, { href, prefetch: true });
    assert.equal(rendered.props.onNavigate, undefined);
    assert.equal(rendered.props.prefetch, true);
  }
});

test("tab links keep native link options, skip duplicate history entries and respect replace and scroll options", () => {
  const previous = global.window, replacements = [];
  const href = "/en/dashboard?tab=profile";
  global.window = { location: { pathname: "/en/dashboard", search: "?tab=profile" },
    history: { pushState: () => assert.fail("No duplicate entries"), replaceState: (...args) => replacements.push(args) },
    scrollTo: () => assert.fail("Scroll disabled") };
  try {
    const onClick = () => {};
    const rendered = link("/en/dashboard", { href, scroll: false, replace: true, target: "_blank", onClick });
    assert.equal(rendered.props.target, "_blank");
    assert.equal(rendered.props.onClick, onClick);
    rendered.props.onNavigate({ preventDefault() {} });
    assert.equal(replacements.length, 0);
    global.window.location.search = "?tab=history";
    rendered.props.onNavigate({ preventDefault() {} });
    assert.deepEqual(replacements, [[null, "", href]]);
  } finally { global.window = previous; }
});
