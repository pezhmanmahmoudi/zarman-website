/* eslint-disable @typescript-eslint/no-require-imports -- Offline dashboard interaction tests. */
const assert = require("node:assert/strict");
const { test } = require("node:test");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { dashboardHarness } = require("./helpers/dashboard-harness.cjs");

function elements(tree, predicate) {
  const found = [];
  function walk(node) {
    if (!React.isValidElement(node)) return;
    if (predicate(node)) found.push(node);
    React.Children.forEach(node.props.children, walk);
  }
  walk(tree);
  return found;
}
function motionMock(captured, reduced = false) {
  const component = tag => ({ children, initial, animate, transition, layout, layoutId, exit, ...props }) => {
    captured.push({ tag, initial, animate, transition, layout, layoutId, exit });
    return React.createElement(tag, props, children);
  };
  return { ...require("framer-motion"), useReducedMotion: () => reduced, motion: { div: component("div"), span: component("span") } };
}
const dialogMocks = Object.fromEntries(["Dialog", "DialogContent", "DialogTitle", "DialogDescription"].map(name => [name,
  ({ children, dir }) => React.createElement(name === "DialogTitle" ? "h2" : name === "DialogDescription" ? "p" : "div", { dir }, children),
]));

test("profile shortcut keeps its accessible name without visible text and mobile logout handles failure, retry and duplicate clicks", async () => {
  for (const locale of ["en", "fa"]) {
    const calls = [];
    let finish;
    const h = dashboardHarness({ locale, mocks: {
      "@/components/ui/dialog": dialogMocks,
      "next/navigation": { usePathname: () => `/${locale}/dashboard`, useSearchParams: () => new URLSearchParams("tab=profile"), useRouter: () => ({ replace: url => calls.push(url), refresh: () => calls.push("refresh") }) },
      "@/lib/supabase": { supabase: { auth: { signOut: options => { calls.push(options); return new Promise(resolve => { finish = resolve; }); } } } },
    } });
    const { DashboardHeader } = h.load("components/dashboard/DashboardHeader.tsx");
    const copy = h.load("lib/dashboard/navigation.ts").dashboardCopy[locale];
    const render = () => h.render(DashboardHeader, { activeTab: "profile", profile: { first_name: "Alex", last_name: "Morgan" }, privateAmounts: false, onTogglePrivacy() {} });
    const shortcut = elements(render(), n => n.props.href === `/${locale}/dashboard?tab=profile`)[0];
    assert.equal(shortcut.props["aria-current"], "page");
    assert.equal(shortcut.props["aria-label"], copy.profile);
    assert.equal(React.Children.count(shortcut.props.children), 1, "avatar only, without visible profile text");
    assert.equal(shortcut.props.title, copy.profile);
    const button = () => elements(render(), n => n.type === "button" && n.props["aria-label"] === copy.signOut)[0];
    assert.equal(React.Children.count(button().props.children), 1, "logout remains icon-only");
    const firstClick = button().props.onClick();
    await button().props.onClick();
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], { scope: "local" });
    assert.equal(button().props.disabled, true);
    finish({ error: Error("network") }); await firstClick;
    assert.equal(button().props.disabled, false);
    assert.equal(elements(render(), n => n.props.role === "alert").length, 1);
    const retry = button().props.onClick();
    finish({ error: null }); await retry;
    assert.deepEqual(calls.slice(-2), [`/${locale}/login`, "refresh"]);
    assert.equal(elements(render(), n => n.props.role === "alert").length, 0);
    const css = [...h.css.values()].join("\n");
    assert.match(css, /@media\(min-width:900px\)[^{]*\{[^}]*mobileSignOut[^}]*display:none/);
    h.cleanup();
  }
  const page = require("node:fs").readFileSync("app/[locale]/dashboard/page.tsx", "utf8");
  assert.doesNotMatch(page, /signOut|MessageSquare|copy\.feedback/);
});

test("initials use first and last names consistently, including Persian and missing names", () => {
  const h = dashboardHarness();
  const { nameInitials } = h.load("lib/dashboard/initials.ts");
  for (const [name, expected] of [["Pezhman Morgan", "PM"], ["  Alex James Morgan  ", "AM"], ["Alex", "A"], ["پژمان محمدی", "پ‌م"], ["", "—"], [null, "—"], ["1234", "—"], ["😀 Alex Morgan", "AM"]]) assert.equal(nameInitials(name), expected);
});

test("dashboard loading has one light full-page surface and a transparent panel variant", () => {
  const h = dashboardHarness();
  const { DashboardLoading } = h.load("components/dashboard/DashboardLoading.tsx");
  const page = renderToStaticMarkup(React.createElement(DashboardLoading, { fullPage: true }));
  const panel = renderToStaticMarkup(React.createElement(DashboardLoading));
  assert.match(page, /data-dashboard-loading="page"/);
  assert.match(page, /role="status"/);
  assert.match(page, /aria-busy="true"/);
  assert.match(page, /data-lottie-scene="dashboard-loading"/);
  assert.match(page, /lucide-hand/);
  assert.doesNotMatch(page, /bg-white|shadow-\[|lucide-loader-circle/);
  assert.match(panel, /data-dashboard-loading="panel"/);
  assert.doesNotMatch(panel, /DashboardShell_loadingPage/);
  const css = [...h.css.values()].join("\n");
  assert.match(css, /\.DashboardShell_loadingPage\s*\{min-height:100dvh/);
  const loadingRule = css.match(/\.DashboardShell_loadingState\s*\{([^}]+)\}/)[1];
  assert.doesNotMatch(loadingRule, /background|gradient|shadow/);
});

test("initial authentication shows only the full-page loader, without premature dashboard chrome", () => {
  const h = dashboardHarness({ mocks: {
    "./DashboardMessageChime": { DashboardMessageChime: () => null },
    "@/hooks/useDashboardData": { useDashboardData: () => ({ sessionChecked: false, error: false, loading: true }) },
  } });
  const { DashboardShell } = h.load("components/dashboard/DashboardShell.tsx");
  const html = renderToStaticMarkup(React.createElement(DashboardShell, null, "PRIVATE ACCOUNT CONTENT"));
  assert.match(html, /data-dashboard-loading="page"/);
  assert.doesNotMatch(html, /PRIVATE ACCOUNT CONTENT|<header|<footer|<nav/);
});

test("the dashboard light boundary renders before asynchronous rate/configuration reads", () => {
  let reads = 0;
  const h = dashboardHarness({ mocks: {
    "@/lib/rates": { getRatesSnapshot: async () => { reads++; return {}; } },
    "@/lib/finance-config": { getFinanceConfig: async () => { reads++; return {}; } },
    "@/components/providers/MarketProviders": { __esModule: true, default: () => null },
    "@/components/dashboard/DashboardShell": { DashboardShell: () => null },
  } });
  const { default: Layout, viewport } = h.load("app/[locale]/dashboard/layout.tsx");
  const tree = Layout({ children: "account" });
  assert.equal(tree.type, "div");
  assert.equal(tree.props["data-dashboard-surface"], true);
  assert.equal(tree.props.children.type, React.Suspense);
  assert.equal(tree.props.children.props.fallback.props.fullPage, true);
  assert.equal(reads, 0);
  assert.equal(viewport.themeColor, "#f7f7fb");
  assert.equal(viewport.colorScheme, "light");
});

test("shared reveal inherits the dashboard motion preference and respects reduced motion", () => {
  for (const { enabled, local, reduced, expected } of [
    { enabled: false, reduced: false, expected: false },
    { enabled: true, reduced: false, expected: true },
    { enabled: true, local: false, reduced: false, expected: false },
    { enabled: true, reduced: true, expected: false },
  ]) {
    const captured = [], h = dashboardHarness({ mocks: { "framer-motion": motionMock(captured, reduced) } });
    const { DashboardReveal } = h.load("components/dashboard/dashboard-ui.tsx");
    const { DashboardMotionProvider } = h.load("components/dashboard/DashboardMotion.tsx");
    const html = renderToStaticMarkup(React.createElement(DashboardMotionProvider, { enabled },
      React.createElement(DashboardReveal, local === undefined ? {} : { motionEnabled: local }, React.createElement("p", null, "Account information"))));
    assert.equal(captured.length, 1);
    assert.equal(captured[0].initial !== false, expected);
    assert.equal(captured[0].transition.duration > 0, expected);
    assert.equal(captured[0].animate.opacity, 1);
    assert.equal(captured[0].animate.filter, "blur(0px)");
    assert.match(html, /Account information/);
  }
});

for (const locale of ["en", "fa"]) {
  test(`${locale}: display preferences update shell privacy and motion without clearing customer content`, () => {
    const HeaderMarker = () => null, SidebarMarker = () => null, captured = [];
    const account = { profile: { first_name: "Alex", kyc_status: "approved" }, approvedVolume: 0, approvedCount: 0, loading: false, sessionChecked: true, error: false, refresh() {} };
    const shell = dashboardHarness({ locale, mocks: {
      "./DashboardMessageChime": { DashboardMessageChime: () => null },
      "@/hooks/useDashboardData": { useDashboardData: () => account },
      "./DashboardHeader": { DashboardHeader: HeaderMarker },
      "./DashboardSidebar": { DashboardSidebar: SidebarMarker },
      "framer-motion": motionMock(captured),
    } });
    const { DashboardShell } = shell.load("components/dashboard/DashboardShell.tsx");
    const { DashboardReveal } = shell.load("components/dashboard/dashboard-ui.tsx");
    const { DashboardMotionProvider } = shell.load("components/dashboard/DashboardMotion.tsx");
    const child = React.createElement(DashboardReveal, null, React.createElement("span", { "data-private-value": true }, "1,234 AUD"));
    const renderShell = () => shell.render(DashboardShell, { children: child });
    const headerProps = () => elements(renderShell(), node => node.type === HeaderMarker)[0].props;
    const wrapper = () => elements(renderShell(), node => node.props["data-dashboard-shell"])[0];
    const header = dashboardHarness({ locale, mocks: { "@/components/ui/dialog": dialogMocks } });
    const { DashboardHeader } = header.load("components/dashboard/DashboardHeader.tsx");
    const renderHeader = () => header.render(DashboardHeader, headerProps());
    const preferences = () => elements(renderHeader(), node => node.type === dialogMocks.Dialog)[0];
    const checkboxes = () => elements(renderHeader(), node => node.type === "input" && node.props.type === "checkbox");

    assert.equal(wrapper().props["data-private-amounts"], false);
    assert.equal(wrapper().props["data-motion"], "on");
    const openLabel = locale === "fa" ? "تنظیمات نمایش" : "Display preferences";
    elements(renderHeader(), node => node.type === "button" && node.props["aria-label"] === openLabel)[0].props.onClick();
    assert.equal(preferences().props.open, true);
    assert.equal(checkboxes()[0].props.checked, false);
    assert.equal(checkboxes()[1].props.checked, true);
    checkboxes()[0].props.onChange();
    assert.equal(wrapper().props["data-private-amounts"], true);
    assert.equal(checkboxes()[0].props.checked, true);
    checkboxes()[1].props.onChange();
    assert.equal(wrapper().props["data-motion"], "off");
    assert.equal(checkboxes()[1].props.checked, false);
    assert.equal(elements(renderShell(), node => node.type === DashboardMotionProvider)[0].props.enabled, false);
    captured.length = 0;
    const html = renderToStaticMarkup(renderShell());
    assert.match(html, locale === "fa" ? /زرمان؛ راهکاری هوشمند برای تبادل ارز/ : /Zarman; The smart way to exchange currency/);
    assert.match(html, locale === "fa" ? /دستیار هوشمند زرمان \(به‌زودی\)/ : /Zarman Assistant \(Coming soon\)/);
    const footer = elements(renderShell(), node => node.type === "footer")[0];
    const assistant = elements(footer, node => node.type === "button")[0];
    assert.equal(assistant.props.disabled, true);
    assert.match(assistant.props.className, /w-full.*sm:w-auto/);
    assert.match(footer.props.children.props.className, /flex-col.*sm:flex-row/);
    assert.match(html, /1,234 AUD/);
    assert.match(html, /data-private-value="true"/);
    assert.equal(captured[0].initial, false);
    assert.equal(captured[0].transition.duration, 0);
    assert.equal(preferences().props.open, true);
    const done = locale === "fa" ? "انجام شد" : "Done";
    elements(renderHeader(), node => typeof node.props.onClick === "function" && node.props.children === done)[0].props.onClick();
    assert.equal(preferences().props.open, false);
    assert.equal(wrapper().props["data-private-amounts"], true);
    assert.equal(wrapper().props["data-motion"], "off");
  });

  test(`${locale}: navigation preserves the request and query while the official mark stays static`, () => {
    const captured = [], images = [];
    const h = dashboardHarness({ locale, pathname: `/${locale}/dashboard/requests/request-123`, query: "from=history&focus=request-payment-details", mocks: {
      "framer-motion": motionMock(captured),
      "@/components/ui/dialog": dialogMocks,
      "next/image": { __esModule: true, default: ({ priority, ...props }) => { images.push({ ...props, priority }); return React.createElement("img", props); } },
    } });
    const { DashboardHeader } = h.load("components/dashboard/DashboardHeader.tsx");
    const nextLocale = locale === "fa" ? "en" : "fa";
    const header = h.render(DashboardHeader, { activeTab: "history", profile: { first_name: "Pezhman", last_name: "Morgan" }, privateAmounts: false, onTogglePrivacy() {}, motion: false, onToggleMotion() {} });
    const switchLink = elements(header, node => node.props.lang === nextLocale)[0];
    assert.equal(switchLink.props.href, `/${nextLocale}/dashboard/requests/request-123?from=history&focus=request-payment-details`);
    assert.equal(switchLink.props.children, nextLocale === "fa" ? "فارسی" : "English");
    assert.equal(switchLink.props.dir, nextLocale === "fa" ? "rtl" : "ltr");
    const headerHtml = renderToStaticMarkup(header);
    assert.match(headerHtml, /data-avatar-initials="true"[^>]*>PM<\/bdi>/);
    const controlCss = [...h.css.values()].join("\n");
    assert.match(controlCss, /box-shadow:none/);
    assert.match(controlCss, /\[lang="fa"\][^}]*font-family:IRANSansX/);
    assert.match(controlCss, /\[lang="en"\][^}]*font-family:var\(--font-en,Inter\)/);
    assert.ok(elements(header, node => node.props.href === `/${locale}/dashboard?tab=profile`).length);

    const { DashboardSidebar } = h.load("components/dashboard/DashboardSidebar.tsx");
    const html = renderToStaticMarkup(React.createElement(DashboardSidebar, { activeTab: "history", motionEnabled: false }));
    assert.equal((html.match(/aria-current="page"/g) || []).length, 2);
    for (const tab of ["transfer", "history", "recipients", "profile", "feedback"]) assert.ok(html.includes(`/${locale}/dashboard?tab=${tab}`));
    assert.match(html, locale === "fa" ? /گیرندگان/ : /Recipients/);
    assert.equal(images.length, 2);
    assert.equal(images[0].src, "/images/logo-no-text-light.svg");
    assert.equal(images[0].alt, "Zarman");
    assert.equal(images[1].style.transform, "none");
    assert.ok(captured.every(item => item.layoutId === undefined && item.transition.duration === 0));
    assert.doesNotMatch(html, /scale\(-1\)|rotate\(180deg\)|\?{3,}/);
  });
}
