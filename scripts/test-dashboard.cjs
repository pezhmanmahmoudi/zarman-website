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
    assert.match(html,/ZE36827/); assert.match(html,/15\/09\/26/); assert.doesNotMatch(html.match(/<time[^>]*>(.*?)<\/time>/)[1],/[۰-۹]/);
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
    const harness = dashboardHarness({mocks:{"./DashboardMessageChime":{DashboardMessageChime:()=>null},"@/hooks/useDashboardData":{useDashboardData:()=>({profile:null,approvedVolume:0,approvedCount:0,sessionChecked,error:true,loading:false,refresh(){}})}}});
    const {DashboardShell} = harness.load("components/dashboard/DashboardShell.tsx");
    const html = renderToStaticMarkup(React.createElement(DashboardShell,null,React.createElement("form",{"data-saved-draft":"present"})));
    assert.equal(html.includes('data-saved-draft="present"'),sessionChecked);
    assert.match(html,/Try again/);
    if (sessionChecked) assert.match(html,/Showing the last loaded details/);
  }
});
test("request feed waits five minutes for automatic refresh, allows manual refresh and ignores responses after cleanup", async () => {
  const previous = { window:global.window, document:global.document }; global.window = events(); global.document = events();
  const originalNow = Date.now; let now = 1000000; Date.now = () => now;
  let resolve, calls = 0, signal, removed = false;
  const interval = global.window.setInterval;
  global.window.setInterval = (fn, delay) => { assert.equal(delay, 300000); return interval(fn); };
  const channel = { on(_event, _filter, callback) { signal = callback; return this; }, subscribe() { return this; } };
  const harness = dashboardHarness({ mocks:{
    "@/app/actions/request.actions": {listMyRequests: () => {calls++; return new Promise(done => {resolve = done;});}},
    "@/lib/supabase": {supabase: {channel: () => channel, removeChannel: () => {removed = true;}}},
  } });
  const { useDashboardRequests } = harness.load("hooks/useDashboardRequests.ts");
  try {
    harness.render(useDashboardRequests); harness.effects();
    global.window.emit("focus"); assert.equal(calls,1);
    resolve({error:"offline"}); await tick(); assert.equal(harness.render(useDashboardRequests).error,true);
    global.document.visibilityState = "hidden"; global.window.emit("interval"); assert.equal(calls,1);
    global.document.visibilityState = "visible"; global.document.emit("visibilitychange"); signal(); assert.equal(calls,1);
    now += 299999; global.window.emit("interval"); assert.equal(calls,1);
    now++; global.document.visibilityState = "hidden"; signal(); global.window.emit("interval"); assert.equal(calls,1);
    global.document.visibilityState = "visible"; global.document.emit("visibilitychange"); assert.equal(calls,2);
    resolve({data:[request]}); await tick(); assert.equal(harness.render(useDashboardRequests).requests.length,1); assert.equal(harness.render(useDashboardRequests).error,false);
    global.window.emit("focus"); signal(); assert.equal(calls,2);
    void harness.render(useDashboardRequests).refresh(); assert.equal(calls,3);
    void harness.render(useDashboardRequests).refresh(); assert.equal(calls,3);
    harness.cleanup(); resolve({data:[]}); await tick();
    assert.equal(harness.render(useDashboardRequests).requests.length,1);
    assert.equal(global.window.listeners.size,0); assert.equal(global.document.listeners.size,0);
    assert.equal(removed,true);
  } finally { harness.cleanup(); Date.now = originalNow; global.window = previous.window; global.document = previous.document; }
});
test("dashboard account reads are user-scoped, fail visibly, and cannot restore private data after sign out", async () => {
  const previous = { window:global.window, document:global.document }; global.window = events(); global.document = events();
  let onAuth, resolveProfile, resolveTransactions; const scopes = [], redirects = [], rpcs = [];
  global.window.location.replace = path => redirects.push(path);
  const query = table => ({select(){return this;},eq(column,value){scopes.push([table,column,value]);return this;},order(){return this;},range(){return this;},abortSignal(){return this;},single(){return this;},then(fn,reject) {return new Promise(resolve => {if(table === "profiles") resolveProfile = resolve; else resolveTransactions = resolve;}).then(fn,reject);} });
  const supabase = { auth:{ getUser:async () => ({data:{user:{id:"customer-id"}}}), onAuthStateChange:fn => {onAuth = fn; return {data:{subscription:{unsubscribe(){}}}};} }, from:query, rpc:name => {rpcs.push(name); return query("rpc");} };
  const harness = dashboardHarness({mocks:{"@/lib/supabase":{supabase},"next/navigation":{useRouter:()=>({replace:path=>redirects.push(path)})}}});
  const { useDashboardData } = harness.load("hooks/useDashboardData.ts");
  try {
    harness.render(useDashboardData); harness.effects(); await tick();
    resolveProfile({data:null,error:{message:"read failed"}}); resolveTransactions({data:{volume:0,approved_count:0},error:null}); await tick();
    assert.equal(harness.render(useDashboardData).error,true);
    const refresh = harness.render(useDashboardData).refresh(); await tick(); onAuth("SIGNED_OUT");
    resolveProfile({data:{id:"customer-id"},error:null}); resolveTransactions({data:{volume:"500.00",approved_count:1},error:null}); await refresh;
    const state = harness.render(useDashboardData); assert.equal(state.profile,null); assert.equal(state.approvedVolume,0); assert.equal(state.approvedCount,0); assert.equal(state.sessionChecked,false); assert.equal(state.signedOut,true); assert.equal(state.loading,false);
    await state.refresh();
    assert.deepEqual(scopes,[["profiles","id","customer-id"],["profiles","id","customer-id"]]);
    assert.deepEqual(rpcs,["my_approved_transaction_summary","my_approved_transaction_summary"]);
    assert.deepEqual(redirects,["/en/login"]);
  } finally { harness.cleanup(); global.window = previous.window; global.document = previous.document; }
});
test("server-rendered account data is shown immediately without a duplicate client read", async () => {
  const previous = { window:global.window, document:global.document }; global.window = events(); global.document = events();
  const originalNow = Date.now; let now = 5000000; Date.now = () => now;
  let reads = 0;
  const supabase = { auth:{ getUser:async () => {reads++; return {data:{user:{id:"customer-id"}}};}, onAuthStateChange:() => ({data:{subscription:{unsubscribe(){}}}}) },
    from:() => {reads++; return {select(){return this;},eq(){return this;},abortSignal(){return this;},single:async()=>({data:{id:"customer-id",first_name:"Fresh"},error:null})};},
    rpc:() => {reads++; return {abortSignal(){return this;},single:async()=>({data:{volume:"750.50",approved_count:"3"},error:null})};} };
  const harness = dashboardHarness({mocks:{"@/lib/supabase":{supabase},"next/navigation":{useRouter:()=>({replace(){}})}}});
  const { useDashboardData } = harness.load("hooks/useDashboardData.ts");
  const initial = { profile:{id:"customer-id",first_name:"Server"}, approved:{volume:500,count:2} };
  try {
    let state = harness.render(useDashboardData,initial);
    assert.equal(state.sessionChecked,true); assert.equal(state.loading,false); assert.equal(state.profile.first_name,"Server");
    assert.equal(state.approvedVolume,500); assert.equal(state.approvedCount,2);
    harness.effects(); await tick(); global.window.emit("focus"); await tick();
    assert.equal(reads,0);
    now += 300000; global.window.emit("focus"); await tick(); await tick();
    assert.equal(reads,3);
    state = harness.render(useDashboardData,initial);
    assert.equal(state.profile.first_name,"Fresh"); assert.equal(state.approvedVolume,750.5); assert.equal(state.approvedCount,3);
  } finally { harness.cleanup(); Date.now = originalNow; global.window = previous.window; global.document = previous.document; }
});
test("approved summary falls back to paged rows until the database function is applied", async () => {
  const { readApprovedSummary } = dashboardHarness().load("lib/dashboard/approved-summary.ts");
  const ranges = [];
  const client = {
    rpc:() => ({single:async()=>({data:null,error:{code:"PGRST202",message:"Could not find the function"}})}),
    from:() => { let range; const q = {select(){return q;},eq(){return q;},order(){return q;},range(from,to){range=[from,to];ranges.push(range);return q;},then(fn,reject){
      const rows = range[0] === 0 ? Array.from({length:1000},()=>({amount_aud:"1.50"})) : [{amount_aud:2}];
      return Promise.resolve({data:rows,error:null}).then(fn,reject);
    }}; return q; },
  };
  assert.deepEqual(await readApprovedSummary(client,"customer-id"),{volume:1502,count:1001});
  assert.deepEqual(ranges,[[0,999],[1000,1999]]);
  const direct = { rpc:() => ({single:async()=>({data:{volume:"12.34",approved_count:2},error:null})}), from(){ throw Error("Unexpected paging"); } };
  assert.deepEqual(await readApprovedSummary(direct,"customer-id"),{volume:12.34,count:2});
});
test("a session refreshed in the proxy is forwarded to Server Components and returned to the browser", () => {
  let handlers;
  const { NextRequest } = require("next/server");
  const harness = dashboardHarness({mocks:{"@supabase/ssr":{createServerClient:(_url,_key,options) => {handlers = options.cookies; return {};}}}});
  const { createSupabaseProxyClient } = harness.load("lib/supabase-server.ts");
  const request = new NextRequest("https://example.test/en/dashboard",{headers:{cookie:"sb-auth=expired"}});
  const { getResponse } = createSupabaseProxyClient(request);
  assert.equal(getResponse().headers.get("x-middleware-request-cookie"),"sb-auth=expired");
  handlers.setAll([{name:"sb-auth",value:"fresh",options:{path:"/"}}]);
  const response = getResponse();
  assert.equal(response.headers.get("x-middleware-request-cookie"),"sb-auth=fresh");
  assert.equal(response.cookies.get("sb-auth").value,"fresh");
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
    "@/app/actions/transaction.actions":{getRecipients:async()=>({data:[{id:"recipient-aud",direction:"aud",label:"Alex"}]}),validatePromoCode:()=>new Promise(resolve=>{resolvePromo=resolve;})},
    "@/lib/supabase":{supabase:{from:()=>({select(){return this;},order(){return this;},limit(){return this;},single:async()=>({data:{market_active:true}})})}},
  }});
  const {DashboardRequestHub} = harness.load("components/dashboard/DashboardRequestHub.tsx");
  const {TransferRecipientPicker} = harness.load("components/dashboard/TransferRecipientPicker.tsx");
  const props = {isApproved:true,txType:"buy_aud",setTxType(){},amountStr:"1,000",setAmountStr(value){props.amountStr=value;},loyaltyBonus:0,tailoredRate:100000,baseRate:100000,profile:{id:"fixture"}};
  const render = () => harness.render(DashboardRequestHub,props);
  const previousRAF = global.requestAnimationFrame; global.requestAnimationFrame = () => 1;
  try {
    render(); harness.effects(); await tick();
    const next = () => elements(render(),node=>node.type==="button" && String(node.props.className).includes("wizardNext"))[0].props.onClick();
    next();
    elements(render(),node=>node.type===TransferRecipientPicker)[0].props.onSelect("recipient-aud");
    next();
    elements(render(),node=>node.type===SelectBox)[0].props.onChange("Loan");
    elements(render(),node=>node.type===SelectBox)[1].props.onChange("Support Family");
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


test("logout across tabs and browser history clears private data before navigation", () => {
  const previous = { window: global.window, document: global.document };
  try {
    for (const event of ["storage", "pageshow"]) {
      global.window = events(); global.document = events();
      const destinations = [];
      global.window.location.replace = path => destinations.push(path);
      global.window.location.reload = () => destinations.push("reload");
      const supabase = { auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), getUser() { throw Error("Unexpected private read"); } } };
      const h = dashboardHarness({ mocks: { "@/lib/supabase": { supabase } } });
      const { useDashboardData } = h.load("hooks/useDashboardData.ts");
      const initial = { profile: { id: "synthetic-id", first_name: "Private" }, approved: { volume: 500, count: 1 } };
      h.render(useDashboardData, initial); h.effects();
      global.window.listeners.get(event)(event === "storage" ? { key: "zarman:sign-out", newValue: "notification" } : { persisted: true });
      const state = h.render(useDashboardData, initial);
      assert.equal(state.profile, null); assert.equal(state.approvedVolume, 0); assert.equal(state.signedOut, true);
      assert.deepEqual(destinations, [event === "storage" ? "/en/login" : "reload"]);
      h.cleanup(); assert.equal(global.window.listeners.size, 0);
    }
  } finally { global.window = previous.window; global.document = previous.document; }
});
