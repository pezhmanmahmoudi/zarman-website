/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { dashboardHarness } = require("./helpers/dashboard-harness.cjs");

function elements(node, predicate) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(item => elements(item, predicate));
  return [...(predicate(node) ? [node] : []), ...elements(node.props?.children, predicate)];
}

test("admin payment account is on-demand, funding-gated, masked and closable", async () => {
  let calls = 0;
  const h = dashboardHarness({ mocks: {
    "@/app/actions/request.actions": { getAdminPaymentAccount: async () => { calls++; return { data: { username: "synthetic-user", password: "synthetic-password" } }; } },
  } });
  try {
    const { RequestPaymentAccount } = h.load("components/requests/RequestPaymentAccount.tsx");
    const props = { requestId: "synthetic-request", funded: false };
    const render = () => h.render(RequestPaymentAccount, props);
    assert.equal(elements(render(), n => n.type === "button").length, 0);
    assert.equal(calls, 0);
    props.funded = true;
    assert.equal(elements(render(), n => n.type === "input").length, 0);
    assert.equal(calls, 0);
    await elements(render(), n => n.type === "button")[0].props.onClick();
    assert.equal(calls, 1);
    assert.equal(elements(render(), n => n.type === "input" && n.props.type === "password").length, 1);
    elements(render(), n => n.type === "button")[0].props.onClick();
    assert.equal(elements(render(), n => n.type === "input" && n.props.type === "password").length, 0);
    elements(render(), n => n.type === "button")[1].props.onClick();
    assert.equal(elements(render(), n => n.type === "input").length, 0);
  } finally { h.cleanup(); }
});
