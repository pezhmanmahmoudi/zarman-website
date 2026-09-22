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
    const account = { profile: { first_name: "Alex", kyc_status: "approved" }, transactions: [], loading: false, sessionChecked: true, error: false, refresh() {} };
    const shell = dashboardHarness({ locale, mocks: {
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
    const header = h.render(DashboardHeader, { activeTab: "history", profile: { first_name: "Alex" }, privateAmounts: false, onTogglePrivacy() {}, motion: false, onToggleMotion() {} });
    const switchLink = elements(header, node => node.props.lang === nextLocale)[0];
    assert.equal(switchLink.props.href, `/${nextLocale}/dashboard/requests/request-123?from=history&focus=request-payment-details`);
    assert.equal(switchLink.props.children, nextLocale === "fa" ? "فارسی" : "English");
    assert.ok(elements(header, node => node.props.href === `/${locale}/dashboard?tab=profile`).length);

    const { DashboardSidebar } = h.load("components/dashboard/DashboardSidebar.tsx");
    const html = renderToStaticMarkup(React.createElement(DashboardSidebar, { activeTab: "history", motionEnabled: false }));
    assert.equal((html.match(/aria-current="page"/g) || []).length, 2);
    for (const tab of ["transfer", "history", "recipients", "profile", "feedback"]) assert.ok(html.includes(`/${locale}/dashboard?tab=${tab}`));
    assert.match(html, locale === "fa" ? /گیرندگان/ : /Recipients/);
    assert.equal(images.length, 1);
    assert.equal(images[0].src, "/images/logo-no-text-light.svg");
    assert.equal(images[0].alt, "Zarman");
    assert.equal(images[0].style.transform, "none");
    assert.ok(captured.every(item => item.layoutId === undefined && item.transition.duration === 0));
    assert.doesNotMatch(html, /scale\(-1\)|rotate\(180deg\)|\?{3,}/);
  });
}
