/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict"), { test } = require("node:test");
const React = require("react"), { renderToStaticMarkup } = require("react-dom/server");
const { dashboardHarness, request } = require("./helpers/dashboard-harness.cjs");
const tick = () => new Promise(resolve => setImmediate(resolve));
function elements(tree,predicate) {
  const found = []; const walk = node => {if (!React.isValidElement(node)) return; if(predicate(node)) found.push(node); React.Children.forEach(node.props.children,walk);}; walk(tree); return found;
}
function events() {
  const listeners = new Map();
  return { visibilityState:"visible", location:{pathname:"/en/dashboard",search:"?tab=history"}, addEventListener: (name,fn) => listeners.set(name,fn), removeEventListener: name => listeners.delete(name), setInterval: fn => {listeners.set("interval",fn); return 1;}, clearInterval: () => listeners.delete("interval"), emit:name => listeners.get(name)?.(), listeners };
}
test("dashboard URLs preserve deep links, legacy transfer links and validated tabs", () => {
  const { dashboardTab, dashboardHref } = dashboardHarness().load("lib/dashboard/navigation.ts");
  for (const locale of ["en","fa"]) {
    for (const tab of ["overview","transfer","recipients","history","profile","feedback"]) assert.equal(dashboardTab(`/${locale}/dashboard`,new URLSearchParams(`tab=${tab}`)),tab);
    assert.equal(dashboardHref(locale,"history"),`/${locale}/dashboard?tab=history`);
    assert.equal(dashboardTab(`/${locale}/dashboard/requests/abc`,new URLSearchParams()),"history");
    assert.equal(dashboardTab(`/${locale}/dashboard`,new URLSearchParams("tab=hub")),"transfer");
    assert.equal(dashboardTab(`/${locale}/dashboard`,new URLSearchParams("requestDirection=sell_aud")),"transfer");
    assert.equal(dashboardTab(`/${locale}/dashboard`,new URLSearchParams("tab=unknown")),"overview");
  }
});
test("attention filters never ask fully funded customers to act during internal review", () => {
  const { filterDashboardRequests: filter, requestNeedsAttention } = dashboardHarness().load("lib/dashboard/activity.ts");
  assert.equal(requestNeedsAttention(request),false);
  assert.equal(requestNeedsAttention({...request, customer_action_required:"Please confirm the recipient address"}),true);
  const waiting = {...request,id:"waiting",status:"awaiting_funds",funding_status:"unpaid",funds_confirmed_at:null,evidence_submitted_at:null};
  assert.equal(requestNeedsAttention(waiting),true);
  assert.equal(requestNeedsAttention({...waiting,evidence_submitted_at:request.created_at}),false);
  assert.equal(filter([request,waiting],"attention","").length,1);
  assert.equal(filter([request],"all","alex MORGAN").length,1);
  assert.equal(filter([request],"all","ZE36827").length,1);
  assert.equal(filter([{...request,status:"completed"},{...waiting,status:"cancelled"}],"active","").length,0);
  assert.equal(filter([{...request,status:"completed"},waiting],"completed","").length,1);
});
test("English and Persian activity render real funding milestones, English dates and escaped customer text", () => {
  for (const locale of ["en","fa"]) {
    const harness = dashboardHarness({locale}), { DashboardActivity } = harness.load("components/dashboard/DashboardActivity.tsx");
    const html = renderToStaticMarkup(React.createElement(DashboardActivity,{requests:[{...request,quote:{...request.quote,recipient_snapshot:{full_name:"<script>alert(1)</script>"}}}],loading:false,error:false,refreshing:false,onRefresh() {}}));
    assert.match(html,/ZE36827/); assert.match(html,/15 Sept 2026/); assert.doesNotMatch(html.match(/<time[^>]*>(.*?)<\/time>/)[1],/[۰-۹]/);
    assert.match(html,locale === "en" ? /Funds received/ : /وجه دریافت شد/);
    assert.match(html,/&lt;script&gt;/); assert.doesNotMatch(html,/<script>/);
    assert.match(html,new RegExp(`/${locale}/dashboard/requests/fixture-request`));
    assert.match(html,/aria-pressed="true"/);
  }
});
test("navigation has current-page semantics and language switching keeps the request route", () => {
  for (const locale of ["en","fa"]) {
    const harness = dashboardHarness({locale,pathname:`/${locale}/dashboard/requests/fixture-request`,query:"from=history"});
    const { DashboardSidebar } = harness.load("components/dashboard/DashboardSidebar.tsx"), { DashboardHeader } = harness.load("components/dashboard/DashboardHeader.tsx");
    const sidebar = renderToStaticMarkup(React.createElement(DashboardSidebar,{activeTab:"history"}));
    assert.equal((sidebar.match(/aria-current="page"/g)||[]).length,2);
    assert.match(sidebar,/logo-no-text-light.svg/);
    const header = renderToStaticMarkup(React.createElement(DashboardHeader,{activeTab:"history",profile:{kyc_status:"approved"},privateAmounts:false,onTogglePrivacy(){}}));
    assert.match(header,new RegExp(`/${locale === "fa" ? "en" : "fa"}/dashboard/requests/fixture-request\\?from=history`));
    assert.doesNotMatch(header,/aria-pressed/); // Do not offer an ineffective privacy toggle on detail pages.
  }
});
test("a background refresh failure preserves the mounted transfer form; initial failures offer retry", () => {
  for (const sessionChecked of [false,true]) {
    const harness = dashboardHarness({mocks:{"@/hooks/useDashboardData":{useDashboardData:()=>({profile:null,transactions:[],sessionChecked,error:true,loading:false,refresh(){}})}}});
    const {DashboardShell} = harness.load("components/dashboard/DashboardShell.tsx");
    const html = renderToStaticMarkup(React.createElement(DashboardShell,null,React.createElement("form",{"data-saved-draft":"present"})));
    assert.equal(html.includes('data-saved-draft="present"'),sessionChecked);
    assert.match(html,/Try again/);
    if (sessionChecked) assert.match(html,/Showing the last loaded details/);
  }
});
test("request feed refreshes on return, avoids overlapping reads, recovers from errors and ignores responses after cleanup", async () => {
  const previous = { window:global.window, document:global.document }; global.window = events(); global.document = events();
  let resolve, calls = 0;
  const harness = dashboardHarness({ mocks:{"@/app/actions/request.actions": {listMyRequests: () => {calls++; return new Promise(done => {resolve = done;});}}} });
  const { useDashboardRequests } = harness.load("hooks/useDashboardRequests.ts");
  try {
    harness.render(useDashboardRequests); harness.effects();
    global.window.emit("focus"); assert.equal(calls,1);
    resolve({error:"offline"}); await tick(); assert.equal(harness.render(useDashboardRequests).error,true);
    global.document.visibilityState = "hidden"; global.window.emit("interval"); assert.equal(calls,1);
    global.document.visibilityState = "visible"; global.document.emit("visibilitychange"); assert.equal(calls,2);
    resolve({data:[request]}); await tick(); assert.equal(harness.render(useDashboardRequests).requests.length,1); assert.equal(harness.render(useDashboardRequests).error,false);
    global.window.emit("focus"); harness.cleanup(); resolve({data:[]}); await tick();
    assert.equal(harness.render(useDashboardRequests).requests.length,1);
    assert.equal(global.window.listeners.size,0); assert.equal(global.document.listeners.size,0);
  } finally { global.window = previous.window; global.document = previous.document; }
});
test("dashboard account reads are user-scoped, fail visibly, and cannot restore private data after sign out", async () => {
  const previous = { window:global.window, document:global.document }; global.window = events(); global.document = events();
  let onAuth, resolveProfile, resolveTransactions; const scopes = [], redirects = [];
  const supabase = { auth:{ getUser:async () => ({data:{user:{id:"customer-id"}}}), onAuthStateChange:fn => {onAuth = fn; return {data:{subscription:{unsubscribe(){}}}};} }, from:table => {
    const query = {select(){return this;},eq(column,value){scopes.push([table,column,value]);return this;},order(){return this;},abortSignal(){return this;},single(){return this;},then(fn) {return new Promise(resolve => {if(table === "profiles") resolveProfile = resolve; else resolveTransactions = resolve;}).then(fn);} };return query;
  } };
  const harness = dashboardHarness({mocks:{"@/lib/supabase":{supabase},"next/navigation":{useRouter:()=>({replace:path=>redirects.push(path)})}}});
  const { useDashboardData } = harness.load("hooks/useDashboardData.ts");
  try {
    harness.render(useDashboardData); harness.effects(); await tick();
    resolveProfile({data:null,error:{message:"read failed"}}); resolveTransactions({data:[],error:null}); await tick();
    assert.equal(harness.render(useDashboardData).error,true);
    const refresh = harness.render(useDashboardData).refresh(); await tick(); onAuth("SIGNED_OUT");
    resolveProfile({data:{id:"customer-id"},error:null}); resolveTransactions({data:[{amount_aud:500}],error:null}); await refresh;
    const state = harness.render(useDashboardData); assert.equal(state.profile,null); assert.equal(state.transactions.length,0); assert.equal(state.sessionChecked,false);
    assert.deepEqual(scopes.slice(0,2),[["profiles","id","customer-id"],["transactions","user_id","customer-id"]]);
    assert.deepEqual(redirects,["/en/login"]);
  } finally { harness.cleanup(); global.window = previous.window; global.document = previous.document; }
});

test("transfer direction and rate changes invalidate recipients and pending promo responses", async () => {
  let resolvePromo;
  const SelectBox = () => null, OnlineRequestSubmit = () => null;
  const finance = {discount_step_volume:1000,discount_percent_per_step:0.005,max_discount_percent:0.25,fee_threshold:1000,applied_fee:30};
  const harness = dashboardHarness({mocks:{
    "@/components/ui/SelectBox/SelectBox":{SelectBox},
    "@/components/dashboard/RecipientModal":{RecipientModal:()=>null},
    "@/components/requests/OnlineRequestSubmit":{OnlineRequestSubmit},
    "@/context/FinanceConfigContext":{useFinanceConfig:()=>finance},
    "@/app/actions/transaction.actions":{getRecipients:async()=>({data:[]}),validatePromoCode:()=>new Promise(resolve=>{resolvePromo=resolve;})},
    "@/lib/supabase":{supabase:{from:()=>({select(){return this;},order(){return this;},limit(){return this;},single:async()=>({data:{market_active:true}})})}},
  }});
  const {DashboardRequestHub} = harness.load("components/dashboard/DashboardRequestHub.tsx");
  const props = {isApproved:true,txType:"buy_aud",setTxType(){},amountStr:"1,000",setAmountStr(value){props.amountStr=value;},loyaltyBonus:0,tailoredRate:100000,baseRate:100000,profile:{id:"fixture"}};
  const render = () => harness.render(DashboardRequestHub,props);
  const previousRAF = global.requestAnimationFrame; global.requestAnimationFrame = () => 1;
  try {
    render(); harness.effects(); await tick();
    const next = () => elements(render(),node=>node.type==="button" && String(node.props.className).includes("wizardNext"))[0].props.onClick();
    next();
    elements(render(),node=>node.type===SelectBox)[0].props.onChange("recipient-aud");
    elements(render(),node=>node.type===SelectBox)[1].props.onChange("Loan");
    elements(render(),node=>node.type===SelectBox)[2].props.onChange("Support Family");
    next();
    elements(render(),node=>node.props.id==="request-promo-code")[0].props.onChange({target:{value:"SAVE"}});
    const apply = () => elements(render(),node=>node.type==="button" && String(node.props.className).includes("promoApplyBtn"))[0].props.onClick();
    const pending = apply(); props.txType = "sell_aud"; render(); harness.effects();
    resolvePromo({discount_amount:100,effective_rate:99900}); await pending;
    let submitted = elements(render(),node=>node.type===OnlineRequestSubmit)[0].props.input;
    assert.equal(submitted.recipientId,""); assert.equal(submitted.promoCode,null); assert.equal(submitted.txType,"sell_aud");
    const second = apply(); props.tailoredRate = 100100; render(); harness.effects(); resolvePromo({discount_amount:100,effective_rate:99900}); await second;
    assert.equal(elements(render(),node=>node.type===OnlineRequestSubmit)[0].props.input.promoCode,null);
    const back = () => elements(render(),node=>node.type==="button" && String(node.props.className).includes("wizardBack"))[0].props.onClick();
    back();back();
    elements(render(),node=>node.props.id==="request-amount-aud")[0].props.onChange({target:{value:"\u0661\u0662\u0663\u066b\u0664\u0665"}}); assert.equal(props.amountStr,"123.45");
  } finally {global.requestAnimationFrame = previousRAF;}
});
