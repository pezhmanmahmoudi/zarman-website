/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict"), {test} = require("node:test"), fs = require("node:fs");
const React = require("react"), {renderToStaticMarkup} = require("react-dom/server");
const {dashboardHarness,request} = require("./helpers/dashboard-harness.cjs");
const tick = () => new Promise(resolve=>setImmediate(resolve));
const markup = tree=>renderToStaticMarkup(tree);
function elements(tree,predicate) {
  const result=[];function walk(node){if(!React.isValidElement(node))return;if(predicate(node))result.push(node);React.Children.forEach(node.props.children,walk);}walk(tree);return result;
}
const modalMocks = {
  "framer-motion": { ...require("framer-motion"), useReducedMotion: () => false },
  "@/components/ui/dialog": Object.fromEntries(["Dialog", "DialogContent", "DialogTitle", "DialogDescription"].map(name => [name, ({children, dir, className}) => React.createElement(name === "DialogTitle" ? "h2" : name === "DialogDescription" ? "p" : "div", {dir, className, ...(name === "DialogContent" ? {role:"dialog", "aria-modal":true} : {})}, children)])),
};
const finance = {discount_step_volume:1000,discount_percent_per_step:.005,max_discount_percent:.25,fee_threshold:1000,applied_fee:30};
// Drives the 3-step RecipientModal: inputs by id, select boxes and suggestion fields by their data-field wrapper.
function modalDriver(h,RecipientModal,props) {
  const previousFrame=global.requestAnimationFrame, previousDocument=global.document;
  global.requestAnimationFrame=()=>1;global.document={activeElement:null,getElementById:()=>null,querySelector:()=>null};
  const render=()=>h.render(RecipientModal,props), find=predicate=>elements(render(),predicate)[0];
  const control=key=>elements(find(e=>e.props["data-field"]===key),e=>e.props.labeledOptions!==undefined || typeof e.props.onSelect==="function")[0];
  const change=(key,value)=>{
    const input=find(e=>e.props.id===`recipient-${key}`);
    if(input) input.props.onChange({target:{value},currentTarget:{selectionStart:value.length,setSelectionRange(){}}});
    else control(key).props.onChange(value);
  };
  const submit=async()=>{find(e=>e.type==="form").props.onSubmit({preventDefault(){}});await tick();};
  return {render,find,control,change,submit,restore(){global.requestAnimationFrame=previousFrame;global.document=previousDocument;}};
}

test("the React Bits stepper follows controlled updates and read-only indicators cannot advance funds",()=>{
  const h=dashboardHarness(), {default:Stepper,Step}=h.load("components/Stepper.jsx");
  const changes=[], indicators=[];let completed=0;
  const props={currentStep:2,readOnly:true,showContent:false,onStepChange:step=>changes.push(step),onFinalStepCompleted:()=>completed++,
    backButtonText:"Previous",nextButtonText:"Next",
    renderStepIndicator:indicator=>{indicators.push(indicator);return React.createElement("li",{"data-step":indicator.step,"data-current":indicator.step===indicator.currentStep});},
    children:[1,2,3,4,5].map(step=>React.createElement(Step,{key:step},`Step ${step}`)),
  };
  let tree=h.render(Stepper,props);
  assert.equal(elements(tree,e=>e.type==="button").length,0);
  for(const indicator of indicators){indicator.onStepClick(5);indicator.onStepClick(6);}
  indicators.length=0;tree=h.render(Stepper,props);
  assert.deepEqual(changes,[]);assert.equal(completed,0);
  assert.equal(elements(tree,e=>e.props["data-current"]===true)[0].props["data-step"],2);
  props.currentStep=4;tree=h.render(Stepper,props);
  assert.equal(elements(tree,e=>e.props["data-current"]===true)[0].props["data-step"],4);
  assert.doesNotMatch(markup(tree),/>Previous<|>Next<|>Complete</);
});

test("an interactive controlled stepper requests changes without inventing a new current step",()=>{
  const h=dashboardHarness(), {default:Stepper,Step}=h.load("components/Stepper.jsx"), changes=[];
  const props={currentStep:2,showContent:false,onStepChange:step=>changes.push(step),backButtonText:"Previous",nextButtonText:"Next",
    children:[1,2,3].map(step=>React.createElement(Step,{key:step},`Step ${step}`)),
  };
  const next=elements(h.render(Stepper,props),e=>e.type==="button" && e.props.children==="Next")[0];
  next.props.onClick();assert.deepEqual(changes,[3]);
  assert.match(markup(h.render(Stepper,props)),/aria-current="step"/);
  const before=markup(h.render(Stepper,props));props.currentStep=3;
  const after=markup(h.render(Stepper,props));
  assert.notEqual(after,before);assert.match(after,/>Complete</);
});

test("the customer stepper rerenders confirmed funds, preserves missing receipts and localises its chronology",()=>{
  const dates={};
  const approved={...request,status:"awaiting_funds",funding_status:"unpaid",funding_received:0,evidence_submitted_at:null,funds_confirmed_at:null};
  const received={...approved,status:"ready",funding_status:"confirmed",funding_received:request.funding_received,funds_confirmed_at:request.funds_confirmed_at};
  const completion={id:"completed-event",event_type:"complete",sequence:8,created_at:"2026-09-16T04:00:00Z"};
  const rows=html=>[...html.matchAll(/<li\b([^>]*)>([\s\S]*?)<\/li>/g)].filter(([,attrs])=>/class="request-journey-step"/.test(attrs));
  for(const locale of ["en","fa"]) {
    const h=dashboardHarness({locale}), {RequestProgress}=h.load("components/requests/RequestProgress.tsx");
    const render=(value,events=[])=>markup(React.createElement(RequestProgress,{request:value,events,locale}));
    const before=render(approved), after=render(received);
    assert.equal(rows(before).length,5);assert.equal(rows(after).length,5);
    assert.match(rows(before)[1][1],/aria-current="step"/);
    assert.match(rows(after)[3][1],/aria-current="step"/);
    assert.doesNotMatch(rows(after)[1][1],/aria-current="step"/);
    assert.match(rows(after)[2][1],/data-done="false"/);
    assert.doesNotMatch(rows(after)[2][2],/<svg|<time/);
    assert.match(after,new RegExp(`dir="${locale==="fa"?"rtl":"ltr"}"`));
    assert.doesNotMatch(after,/>Previous<|>Next<|class="(?:next|back)-button"/);
    const done=render({...received,status:"completed",updated_at:"2026-09-20T00:00:00Z"},[completion]);
    assert.match(rows(done)[4][1],/data-done="true"/);assert.match(rows(done)[4][1],/aria-current="step"/);
    assert.match(rows(done)[4][2],/<svg/);assert.match(rows(done)[4][2],new RegExp(completion.created_at));
    assert.match(rows(done)[2][1],/data-done="false"/);
    dates[locale]=[...done.matchAll(/<time dir="ltr" dateTime="([^"]+)">([^<]+)<\/time>/g)].map(([,iso,text])=>[iso,text]);
    assert.equal(dates[locale].length,4);assert.ok(dates[locale].every(([,text])=>/Sept? 2026/.test(text) && !/[\u06f0-\u06f9]/.test(text)));
    assert.doesNotMatch(render({...approved,status:"cancelled"}),/aria-current="step"/);
  }
  assert.deepEqual(dates.fa,dates.en);
});

test("the animated journey follows financial facts and offers only the correct next action in both languages",()=>{
  const actorLabels={
    en:{customer:"Action Required",zarman:"Under review by Zarman",complete:"Complete",closed:"Closed"},
    fa:{customer:"نیازمند اقدام شما",zarman:"در حال بررسی توسط زرمان",complete:"تکمیل شده",closed:"بسته شده"},
  };
  for(const locale of ["en","fa"]) {
    const h=dashboardHarness({locale}), {journeyPresentation:present}=h.load("lib/dashboard/journey-presentation.ts");
    const {RequestProgress}=h.load("components/requests/RequestProgress.tsx");
    const pending={...request,status:"submitted",funding_status:"unpaid",payment_approved_at:null,evidence_submitted_at:null,funds_confirmed_at:null};
    const approved={...pending,status:"awaiting_funds",payment_approved_at:request.created_at};
    const reviewed={...approved,status:"under_review",evidence_submitted_at:request.created_at};
    const complete={...request,status:"completed"};
    const states=[[pending,0,"zarman"],[approved,1,"customer"],[reviewed,2,"zarman"],[request,3,"zarman"],[complete,4,"complete"]];
    for(const [value,stage,nextActor] of states) {
      const state=present(value,locale), html=markup(React.createElement(RequestProgress,{request:value,locale}));
      assert.equal(state.stage,stage);assert.match(html,new RegExp(`data-stage="${stage}"`));
      assert.equal(state.nextActor,nextActor);assert.equal(state.actorLabel,stage===0 ? (locale==="fa" ? "در حال بررسی توسط زرمان" : "Under Review by Zarman") : actorLabels[locale][nextActor]);
      assert.equal((html.match(/aria-current="step"/g)||[]).length,1);
      assert.equal(Boolean(state.href),stage===1 || stage===4);
      if(stage===3) {assert.match(html,locale==="en" ? /No action required at this stage/:/در این مرحله نیازی به اقدام از سوی شما نیست/);assert.doesNotMatch(html,/href="#request-payment-details"/);}
    }
    const {DashboardActivity}=h.load("components/dashboard/DashboardActivity.tsx");
    const activity=markup(React.createElement(DashboardActivity,{requests:[approved,complete],loading:false,refreshing:false,error:false,onRefresh(){}}));
    assert.match(activity,new RegExp(actorLabels[locale].customer));
    assert.match(activity,/data-transaction-summary="emerald"/);
    const question=present({...request,customer_action_required:"Please confirm"},locale);
    assert.equal(question.href,"#request-conversation");assert.equal(question.mood,"attention");assert.equal(question.nextActor,"customer");assert.equal(question.actorLabel,actorLabels[locale].customer);
    const rejected=present({...pending,status:"rejected"},locale);
    assert.equal(rejected.href,null);assert.equal(rejected.mood,"failed");assert.equal(rejected.nextActor,"closed");assert.equal(rejected.actorLabel,actorLabels[locale].closed);
    const refund=present({...request,funding_status:"refund_pending"},locale);
    assert.equal(refund.href,null);assert.equal(refund.mood,"quiet");assert.equal(refund.nextActor,"zarman");
    const priorityRefund=present({...complete,priority_fee_status:"refund_pending"},locale);
    assert.equal(priorityRefund.href,null);assert.equal(priorityRefund.mood,"quiet");assert.equal(priorityRefund.nextActor,"zarman");
    assert.match(priorityRefund.status,locale==="en" ? /Express processing fee refund/:/بازپرداخت هزینه پردازش اکسپرس/);
    const {DashboardTransactionHistory}=h.load("components/dashboard/DashboardTransactionHistory.tsx");
    const legacy=markup(React.createElement(DashboardTransactionHistory,{transactions:[{id:"legacy",type:"buy_aud",status:"pending",amount_aud:100,equivalent_toman:10000000,created_at:request.created_at,reference_code:"ZE10000",recipients:{label:"Alex"}}],onDeleteTransaction(){}}));
    assert.match(legacy,new RegExp(actorLabels[locale].zarman));
    const spotlight=markup(React.createElement(RequestProgress,{request:approved,locale,spotlight:true}));
    assert.match(spotlight,new RegExp(`/${locale}/dashboard/requests/fixture-request#request-payment-details`));
  }
});

test("overview keeps four static metrics and restores the separate loyalty card",()=>{
  for(const locale of ["en","fa"]) {
    const h=dashboardHarness({locale,mocks:{
      "./DashboardShell":{useDashboard:()=>({profile:{first_name:"Alex",kyc_status:"approved",loyalty_discount_toman:12345}})},
      "@/hooks/useDashboardRequests":{useDashboardRequests:()=>({requests:[],loading:false,error:false,refreshing:false,refresh(){}})},
      "./DashboardOverviewRecipients":{DashboardOverviewRecipients:({locale})=>React.createElement("a",{href:`/${locale}/dashboard?tab=recipients`},"Manage recipients")},
    }});
    const {DashboardOverview}=h.load("components/dashboard/DashboardOverview.tsx");
    const html=markup(React.createElement(DashboardOverview,{volume:2500,completedCount:2,baseBuyRate:99500,baseSellRate:100000}));
    assert.equal((html.match(/data-overview-card="(?:volume|completed|buy-rate|sell-rate)"/g)||[]).length,4);
    assert.match(html,locale === "fa" ? /حجم تبادلات تأییدشده/ : /Approved exchange volume/);
    assert.match(html,locale === "fa" ? /تعداد تراکنش‌های موفق/ : /Successful transfers/);
    assert.match(html,locale === "fa" ? /نرخ پایه خرید/ : /Base buy rate/);
    assert.match(html,locale === "fa" ? /نرخ پایه فروش/ : /Base sell rate/);
    assert.match(html,locale === "fa" ? /۲٬۵۰۰/ : /2,500/);
    assert.match(html,locale === "fa" ? /۹۹٬۵۰۰/ : /99,500/);
    assert.match(html,locale === "fa" ? /۱۰۰٬۰۰۰/ : /100,000/);
    assert.doesNotMatch(html,/Toman \/ 1 AUD|تومان \/ ۱ AUD/);
    for(const fill of ["#e3eaff","#f4e2f4","#ffebcf","#fbe3e8"]) assert.ok(html.includes(fill));
    assert.match(html,/lucide-arrow-down-left/);assert.match(html,/lucide-arrow-up-right/);
    assert.match(html,/data-overview-card="loyalty"/);
    assert.match(html,locale === "fa" ? /۱۲٬۳۴۵/ : /12,345/);
    assert.match(html,locale === "fa" ? /باشگاه مشتریان زرمان/ : /Zarman Loyalty Club/);
    assert.doesNotMatch(html,/discount on the exchange-rate spread|تخفیف از فاصله نرخ خرید و فروش/);
    for (const id of ["volume", "completed"]) {
      const card = html.split(`data-overview-card="${id}"`)[1].split('data-overview-card=')[0];
      assert.doesNotMatch(card, /<a\b|<button\b/);
    }
    assert.match(html,new RegExp(`/${locale}/dashboard\\?tab=recipients`));
    assert.doesNotMatch(html,/undefined|NaN/);
  }
});

test("loyalty shows monetary savings, conditional two-way rates and live tier progress in both locales",()=>{
  const config={discount_step_volume:5000,discount_percent_per_step:.03,max_discount_percent:.25};
  for(const locale of ["fa","en"]) {
    const h=dashboardHarness({locale,mocks:{"@/context/FinanceConfigContext":{useFinanceConfig:()=>config}}});
    const {DashboardLoyaltyCard}=h.load("components/dashboard/DashboardLoyaltyCard.tsx");
    const props={volume:5000,savings:45000,motionEnabled:false,loyaltyBonus:300,customerBuyRate:109700,customerSellRate:100300};
    const render=updates=>markup(React.createElement(DashboardLoyaltyCard,{...props,...updates}));
    const html=render({});
    assert.match(html,locale==="fa" ? /انتقال بیشتر، سود بیشتر/ : /Transfer More, Save More/);
    assert.match(html,locale==="fa" ? /۳۰۰/ : /300/);
    assert.match(html,locale==="fa" ? /تنها ۵٬۰۰۰ دلار استرالیا تا سطح بعدی فاصله دارید/ : /Only 5,000 AUD left to unlock the next tier/);
    assert.match(html,/data-loyalty-rate="buy"/); assert.match(html,/data-loyalty-rate="sell"/);
    assert.match(html,locale==="fa" ? /۱۰۹٬۷۰۰/ : /109,700/);
    assert.match(html,locale==="fa" ? /۱۰۰٬۳۰۰/ : /100,300/);
    assert.match(html,locale==="fa" ? /مجموع صرفه‌جویی شما تا امروز/ : /Total savings to date/);
    assert.doesNotMatch(html,/٪|>[^<]*%<|discount on the exchange-rate spread|تخفیف از فاصله نرخ خرید و فروش/);
    assert.doesNotMatch(render({loyaltyBonus:0}),/data-loyalty-rates|data-loyalty-rate="/);
    assert.match(render({volume:7500}),/aria-valuenow="50"/);
    const maxed=render({volume:100000});
    assert.match(maxed,/aria-valuenow="100"/);
    assert.doesNotMatch(maxed,/Only .*AUD left|تنها .*تا سطح بعدی/);
    assert.doesNotMatch(render({customerBuyRate:null,customerSellRate:null}),/NaN|undefined/);
  }
});

test("loyalty rates improve both customer directions using only approved volume",()=>{
  const Overview=()=>null;
  const h=dashboardHarness({mocks:{
    "next/dynamic":{__esModule:true,default:()=>()=>null},
    "@/context/RateContext":{useRates:()=>({currentRates:{buyAUD:100000,sellAUD:110000}})},
    "@/context/FinanceConfigContext":{useFinanceConfig:()=>({discount_step_volume:5000,discount_percent_per_step:.03,max_discount_percent:.25})},
    "@/components/dashboard/DashboardShell":{useDashboard:()=>({profile:{},motionEnabled:false,approvedVolume:5000,approvedCount:1}),DashboardLoading:()=>null},
    "@/components/dashboard/DashboardOverview":{DashboardOverview:Overview},
  }});
  const Page=h.load("app/[locale]/dashboard/page.tsx").default;
  const tree=h.render(Page);
  assert.equal(tree.type,Overview);
  assert.equal(tree.props.volume,5000);
  assert.equal(tree.props.completedCount,1);
  assert.equal(tree.props.loyaltyBonus,300);
  assert.equal(tree.props.customerBuyRate,109700);
  assert.equal(tree.props.customerSellRate,100300);
  assert.equal(tree.props.baseBuyRate,100000);
  assert.equal(tree.props.baseSellRate,110000);
});

test("overview identity prompt distinguishes a new account, review, correction and approval",()=>{
  let profile={id:"customer",kyc_status:"pending",document_type:null};
  const h=dashboardHarness({locale:"fa",mocks:{
    "./DashboardShell":{useDashboard:()=>({profile,motionEnabled:false}),useDashboardMotion:()=>false},
    "@/hooks/useDashboardRequests":{useDashboardRequests:()=>({requests:[],loading:false,error:false,refreshing:false,refresh(){}})},
    "@/context/FinanceConfigContext":{useFinanceConfig:()=>finance},
    "./DashboardOverviewRecipients":{DashboardOverviewRecipients:()=>null},
    "./recent-activity-list":{RecentActivityList:()=>null},
    "./TransferOverviewCard":{TransferOverviewCard:()=>null},
  }});
  const {DashboardOverview}=h.load("components/dashboard/DashboardOverview.tsx");
  const show=()=>markup(React.createElement(DashboardOverview,{volume:0,completedCount:0,baseBuyRate:null,baseSellRate:null}));
  let html=show();
  assert.match(html,/حساب خود را برای اولین انتقال آماده کنید/);
  assert.match(html,/data-lottie-scene="identity-rejected"/);
  assert.match(html,/href="\/fa\/dashboard\?tab=profile"/);
  assert.doesNotMatch(html,/مدارک شما در حال بررسی است/);
  profile={...profile,document_type:"passport"};html=show();
  assert.match(html,/مدارک شما در حال بررسی است/);
  assert.match(html,/data-lottie-scene="compliance-review"/);
  profile={...profile,kyc_status:"rejected"};html=show();
  assert.match(html,/اطلاعات هویتی نیاز به اصلاح دارد/);
  profile={...profile,kyc_status:"approved"};html=show();
  assert.match(html,/هویت شما تأیید شده است/);
  assert.match(html,/data-lottie-scene="identity-approved"/);
});

test("unverified transfer access uses exactly the shared overview identity card in both locales",()=>{
  for(const locale of ["fa","en"]) for(const profile of [null,{kyc_status:"pending",document_type:null},{kyc_status:"pending",document_type:"passport"},{kyc_status:"under_review",document_type:"passport"},{kyc_status:"rejected",document_type:"passport"}]) {
    const h=dashboardHarness({locale,mocks:{
      "@/components/ui/SelectBox/SelectBox":{SelectBox:()=>null},
      "@/components/dashboard/RecipientModal":{RecipientModal:()=>null},
      "@/components/requests/OnlineRequestSubmit":{OnlineRequestSubmit:()=>{throw Error("Unverified customer reached submission");}},
      "@/context/FinanceConfigContext":{useFinanceConfig:()=>finance},
      "@/app/actions/transaction.actions":{getRecipients:async()=>({data:[]})},
    }});
    const {DashboardRequestHub}=h.load("components/dashboard/DashboardRequestHub.tsx");
    const {DashboardIdentityCard}=h.load("components/dashboard/DashboardIdentityCard.tsx");
    // Identity remains the next step even while exchange rates are unavailable.
    const tree=h.render(DashboardRequestHub,{isApproved:false,txType:"buy_aud",setTxType(){},amountStr:"1000",setAmountStr(){},loyaltyBonus:0,tailoredRate:null,baseRate:null,profile,motionEnabled:false});
    assert.equal(tree.type,DashboardIdentityCard);
    assert.equal(tree.props.profile,profile);
    assert.equal(tree.props.motionEnabled,false);
    const html=markup(tree);
    const standalone=dashboardHarness({locale}).load("components/dashboard/DashboardIdentityCard.tsx").DashboardIdentityCard;
    assert.equal(html,markup(React.createElement(standalone,{profile,motionEnabled:false})));
    assert.doesNotMatch(html,/<form|react-bits-stepper|دسترسی محدود/);
    const review=profile?.document_type && ["pending","under_review"].includes(profile.kyc_status);
    assert.match(html,new RegExp(`data-lottie-scene="${review?"compliance-review":"identity-rejected"}"`));
    if(!review) assert.match(html,new RegExp(`href="/${locale}/dashboard\\?tab=profile"`));
  }
});

test("transfer matches the identity stepper, clarifies all four controls and scopes hover to its summary",()=>{
  for (const locale of ["en", "fa"]) for (const txType of ["sell_aud", "buy_aud"]) {
    const h=dashboardHarness({locale,mocks:{
      "@/components/ui/SelectBox/SelectBox":{SelectBox:()=>null},
      "@/components/dashboard/RecipientModal":{RecipientModal:()=>null},
      "@/components/requests/OnlineRequestSubmit":{OnlineRequestSubmit:()=>null},
      "@/context/FinanceConfigContext":{useFinanceConfig:()=>finance},
      "@/app/actions/transaction.actions":{getRecipients:async()=>({data:[]})},
    }});
    const {DashboardRequestHub}=h.load("components/dashboard/DashboardRequestHub.tsx");
    let chosen;
    const props={isApproved:true,txType,setTxType(value){chosen=value;},amountStr:"500",setAmountStr(){},loyaltyBonus:0,tailoredRate:100000,baseRate:100000,profile:{id:"test"},motionEnabled:true};
    const tree=h.render(DashboardRequestHub,props);
    assert.equal(elements(tree,n=>n.props["data-transfer-form"])[0].props.pointerEffect,false);
    assert.equal(elements(tree,n=>n.props["data-transfer-summary"])[0].props.pointerEffect,true);
    const stepper=elements(tree,n=>n.props.stepListLabel)[0];
    assert.match(stepper.props.className,/DashboardProfileFlow_stepper/);
    assert.equal(stepper.props.dir,locale==="fa"?"rtl":"ltr");
    const routes=elements(tree,n=>n.type==="button"&&typeof n.props["aria-pressed"]==="boolean");
    assert.equal(routes.length,2);
    assert.equal(routes.filter(n=>n.props["aria-pressed"]).length,1);
    routes[txType==="sell_aud"?1:0].props.onClick();
    assert.equal(chosen,txType==="sell_aud"?"buy_aud":"sell_aud");
    const amounts=elements(tree,n=>n.type==="input"&&n.props["data-amount-input"]);
    assert.deepEqual(amounts.map(n=>n.props.id),txType==="sell_aud"?["request-amount-aud","request-amount-toman"]:["request-amount-toman","request-amount-aud"]);
    assert.equal(amounts.find(n=>n.props.id==="request-amount-aud").props.pattern,"[0-9۰-۹٠-٩.,٫،٬]*");
    for (const amount of amounts) {
      assert.equal(amount.props.style["--amount-characters"],Math.max(amount.props.value.length,6));
      assert.equal(amount.props.disabled,false);
      assert.equal(typeof amount.props.onChange,"function");
      assert.equal(amount.props["aria-describedby"],"transfer-amount-hint");
      const labels=elements(tree,n=>n.type==="label"&&n.props.htmlFor===amount.props.id);
      assert.ok(labels.length);
    }
    const html=markup(tree);
    assert.doesNotMatch(html,/→|←|AUD → IRT|IRT → AUD|Enter or edit amount|مبلغ را وارد یا ویرایش کنید|مسیر انتقال را انتخاب کنید|Not submitted yet/);
    assert.equal(elements(tree,n=>n.props.name==="transfer-setup").length,1);
    assert.equal(elements(tree,n=>n.props.name==="mobile-payment").length,1);
    assert.equal(elements(tree,n=>n.props.name==="bank-card"||n.props.name==="activity-history").length,0);
    assert.equal(elements(tree,n=>n.props.name==="transfer-setup")[0].props.size,96);
    assert.ok(html.includes(locale==="fa"?"هر دلار استرالیا":"1 AUD"));
    const header=elements(tree,n=>n.type==="header"&&String(n.props.className).includes("DashboardTransferFlow_header"))[0];
    assert.ok(header);
    assert.equal(elements(header,n=>n.props.name==="mobile-payment")[0].props.size,112);
    assert.equal(elements(header,n=>String(n.props.className).includes("DashboardTransferFlow_draftStatus")).length,1);
    const units=elements(tree,n=>n.type==="bdi"&&String(n.props.className).includes("DashboardTransferFlow_currency"));
    assert.ok(units.some(n=>n.props.children==="AUD"&&n.props.lang==="en"&&n.props.dir==="ltr"));
    if(locale==="fa")assert.ok(units.some(n=>n.props.children==="تومان"&&n.props.lang==="fa"&&n.props.dir==="rtl"));
    const phrases=locale==="en"?["Specify Transfer Amount","To get started, select your transfer route and enter the amount.","Transfer Summary","Next: Recipient Details",txType==="sell_aud"?"Recipient Gets (in Tomans)":"Recipient Gets (in AUD)"]:["مبلغ انتقال را مشخص کنید","برای شروع، مسیر انتقال و مبلغ مورد نظر خود را وارد کنید.","خلاصه تراکنش","مرحله بعد: اطلاعات گیرنده",txType==="sell_aud"?"گیرنده دریافت می‌کند (به تومان)":"گیرنده دریافت می‌کند (به دلار استرالیا)"];
    for(const phrase of phrases)assert.ok(html.includes(phrase),phrase);
    if(txType==="sell_aud")assert.ok(html.includes(locale==="en"?"Net Transfer Amount":"مبلغ قابل تبدیل"));
    const css=[...h.css.values()].join("\n");
    assert.match(css,/container-type:inline-size/);
    assert.match(css,/@media\(max-width:768px\)/);
    assert.match(css,/input\.DashboardTransferFlow_amountInput\[data-amount-input\]\[data-number-locale\]/);
    assert.match(css,/font-size:clamp\(22px,calc\(\(100cqi - 60px\) \/ var\(--amount-characters,6\) \* 1.6\),38px\)!important/);
    assert.match(css,/font-weight:700;line-height:1.3!important/);
    assert.match(css,/draftStatus\{padding-bottom:14px\}/);
    assert.match(css,/border-radius:999px;background:#eceef3/);
    assert.match(css,/\.DashboardTransferFlow_routeGrid\{[^}]*width:100%;margin-inline:auto;/);
    assert.doesNotMatch(css,/\.DashboardTransferFlow_routeGrid\{[^}]*max-width:/);
    assert.match(css,/\.DashboardTransferFlow_routeButton\{[^}]*min-height:52px;/);
    assert.match(css,/background:#fff;color:#18283e;box-shadow:0 1px 4px/);
    assert.match(css,/headerAnimation\{width:96px!important;height:96px!important\}/);
    assert.match(css,/@container\(min-width:560px\)/);
    assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
    h.cleanup();
  }
});

test("guided transfer prevents skipping missing details and preserves a selected saved recipient",async()=>{
  const SelectBox=()=>null, OnlineRequestSubmit=()=>null;
  const h=dashboardHarness({mocks:{
    "@/components/ui/SelectBox/SelectBox":{SelectBox},
    "@/components/dashboard/RecipientModal":{RecipientModal:()=>null},
    "@/components/requests/OnlineRequestSubmit":{OnlineRequestSubmit},
    "@/context/FinanceConfigContext":{useFinanceConfig:()=>finance},
    "@/app/actions/transaction.actions":{getRecipients:async()=>({data:[{id:"saved",direction:"aud",label:"Alex"}]})},
    "@/lib/supabase":{supabase:{from:()=>({select(){return this;},order(){return this;},limit(){return this;},single:async()=>({data:{market_active:true}})})}},
  }});
  const {DashboardRequestHub}=h.load("components/dashboard/DashboardRequestHub.tsx");
  const props={isApproved:true,txType:"buy_aud",setTxType(){},amountStr:"",setAmountStr(){},loyaltyBonus:0,tailoredRate:100000,baseRate:100000,profile:{id:"test"},initialRecipientId:"saved"};
  const {TransferRecipientPicker}=h.load("components/dashboard/TransferRecipientPicker.tsx");
  const previous=global.requestAnimationFrame;global.requestAnimationFrame=()=>1;
  const render=()=>h.render(DashboardRequestHub,props),next=()=>elements(render(),e=>String(e.props.className).includes("wizardNext"))[0].props.onClick();
  try {
    render();h.effects();await tick();render();h.effects();
    const labels=markup(render());for(const label of ["Amount","Recipient","Review"])assert.match(labels,new RegExp(label));
    assert.match(labels,/react-bits-stepper/);
    next();assert.equal(elements(render(),e=>e.type===SelectBox).length,0);assert.equal(elements(render(),e=>e.props.role==="alert").length,1);
    props.amountStr="1000";next();assert.equal(elements(render(),e=>e.type===TransferRecipientPicker)[0].props.selectedId,"saved");
    assert.equal(elements(render(),e=>e.props.name==="recipient-selection")[0].props.size,112);
    next();let submit=elements(render(),e=>e.type===OnlineRequestSubmit)[0];assert.ok(submit);assert.ok(submit.props.validationMessage);
    let reviewSelects=elements(render(),e=>e.type===SelectBox);assert.equal(reviewSelects.length,2);
    reviewSelects[0].props.onChange("Loan");reviewSelects[1].props.onChange("Support Family");
    submit=elements(render(),e=>e.type===OnlineRequestSubmit)[0];assert.equal(submit.props.input.recipientId,"saved");assert.equal(submit.props.input.sourceOfFunds,"Loan");assert.equal(submit.props.input.reasonForTransfer,"Support Family");assert.equal(submit.props.validationMessage,null);
    elements(render(),e=>String(e.props.className).includes("wizardBack"))[0].props.onClick();
    assert.equal(elements(render(),e=>e.type===TransferRecipientPicker)[0].props.selectedId,"saved");
    next();submit=elements(render(),e=>e.type===OnlineRequestSubmit)[0];assert.equal(submit.props.input.sourceOfFunds,"Loan");assert.equal(submit.props.input.reasonForTransfer,"Support Family");
  }finally{global.requestAnimationFrame=previous;}
});

test("bilingual amount inputs keep Persian formatting separate from the actual submitted AUD value",()=>{
  const previous=global.requestAnimationFrame;global.requestAnimationFrame=()=>1;
  try { for(const locale of ["en","fa"]) {
    const OnlineRequestSubmit=()=>null;
    const h=dashboardHarness({locale,mocks:{
      "@/components/ui/SelectBox/SelectBox":{SelectBox:()=>null},
      "@/components/dashboard/RecipientModal":{RecipientModal:()=>null},
      "@/components/requests/OnlineRequestSubmit":{OnlineRequestSubmit},
      "@/context/FinanceConfigContext":{useFinanceConfig:()=>finance},
      "@/app/actions/transaction.actions":{getRecipients:async()=>({data:[]})},
    }});
    const {DashboardRequestHub}=h.load("components/dashboard/DashboardRequestHub.tsx");
    const props={isApproved:true,txType:"buy_aud",setTxType(){},amountStr:"1,000.05",setAmountStr(value){props.amountStr=value;},loyaltyBonus:0,tailoredRate:100000,baseRate:100000,profile:{id:"test"}};
    const render=()=>h.render(DashboardRequestHub,props);
    const input=()=>elements(render(),e=>e.props.id==="request-amount-aud")[0];
    assert.equal(input().props.value,locale==="fa" ? "۱٬۰۰۰٫۰۵" : "1,000.05");
    assert.equal(input().props.dir,"ltr");assert.equal(input().props["data-number-locale"],locale);
    input().props.onChange({target:{value:"۱٬۲۳۴٫۰۵"}});
    assert.equal(input().props.value,locale==="fa" ? "۱٬۲۳۴٫۰۵" : "1,234.05");
    // Review mounts the existing submit component; no network or write is performed.
    h.values[0]=2;
    const submit=elements(render(),e=>e.type===OnlineRequestSubmit)[0];
    assert.equal(submit.props.input.rawAmount,1234.05);
  }} finally {global.requestAnimationFrame=previous;}
});

test("successful submission replaces the editable draft shell with a bilingual acknowledgement",async()=>{
  for(const locale of ["en","fa"]) {
    const SelectBox=()=>null, OnlineRequestSubmit=()=>null;
    const h=dashboardHarness({locale,mocks:{
      "@/components/ui/SelectBox/SelectBox":{SelectBox},
      "@/components/dashboard/RecipientModal":{RecipientModal:()=>null},
      "@/components/requests/OnlineRequestSubmit":{OnlineRequestSubmit},
      "@/context/FinanceConfigContext":{useFinanceConfig:()=>finance},
      "@/app/actions/transaction.actions":{getRecipients:async()=>({data:[{id:"saved",direction:"aud",label:"Alex"}]})},
      "@/lib/supabase":{supabase:{from:()=>({select(){return this;},order(){return this;},limit(){return this;},single:async()=>({data:{market_active:true}})})}},
    }});
    const {DashboardRequestHub}=h.load("components/dashboard/DashboardRequestHub.tsx");
    const props={isApproved:true,txType:"buy_aud",setTxType(){},amountStr:"1000",setAmountStr(){},loyaltyBonus:0,tailoredRate:100000,baseRate:100000,profile:{id:"test"},initialRecipientId:"saved"};
    const previous=global.requestAnimationFrame;global.requestAnimationFrame=()=>1;
    const render=()=>h.render(DashboardRequestHub,props);
    try {
      render();h.effects();await tick();render();h.effects();
      elements(render(),e=>String(e.props.className).includes("wizardNext"))[0].props.onClick();
      elements(render(),e=>String(e.props.className).includes("wizardNext"))[0].props.onClick();
      const submit=elements(render(),e=>e.type===OnlineRequestSubmit)[0];
      assert.ok(submit);submit.props.onSubmitted({id:"saved-request",reference_code:"ZE12345"});
      const tree=render(), html=markup(tree);
      assert.equal(elements(tree,e=>e.type===OnlineRequestSubmit).length,1);
      assert.equal(elements(tree,e=>String(e.props.className).includes("wizardSteps")).length,0);
      assert.equal(elements(tree,e=>String(e.props.className).includes("wizardFooter")).length,0);
      assert.doesNotMatch(html,locale==="fa" ? /پیش‌نویس|هنوز ثبت نشده|ویرایش/ : /Draft|Not submitted yet|Edit/);
      // The mounted submission component owns the single receipt/reference acknowledgement.
      assert.equal(elements(tree,e=>e.type===OnlineRequestSubmit)[0].key,submit.key);
      assert.equal(elements(tree,e=>e.props.id==="request-amount-aud").length,0);
      assert.equal(elements(tree,e=>e.type===SelectBox).length,0);
    } finally { global.requestAnimationFrame=previous; }
  }
});

test("bank branch city remains separate from residential city and cannot change recipient ownership",()=>{
  const {normalizeRecipientInput:normalize}=dashboardHarness().load("lib/dashboard/recipient-input.ts");
  const irt={direction:"irt",label:" Alex ",bank_name:"Saman Bank",bank_city:" Tehran ",full_name:"Alex",shaba_number:"ir820540102680020817909002",irt_address:"Street",irt_city:"Shiraz",irt_state:"Fars",irt_country:"Iran",irt_phone:"09123456789"};
  const result=normalize({...irt,user_id:"victim",id:"forged",created_at:"forged",extra:"forged",irt_account_number:"legacy"});
  assert.deepEqual(result.data,{...irt,label:"Alex",bank_city:"Tehran",shaba_number:"IR820540102680020817909002"});
  assert.equal(result.data.irt_account_number,undefined);
  assert.ok(normalize({...irt,bank_city:"x".repeat(121)}).error);
  assert.ok(normalize({...irt,bank_city:{sql:"no"}}).error);
  assert.ok(normalize({...irt,shaba_number:"IR123"}).error);
  assert.ok(normalize({...irt,shaba_number:"IR820540102680020817909003"}).error);
  assert.ok(normalize({...irt,card_number:"123"}).error);
  assert.equal(normalize({...irt,card_number:"1234567890123456"}).data.card_number,"1234567890123456");
  assert.ok(normalize(null).error);assert.ok(normalize({direction:"irt",label:123}).error);
  const aud={direction:"aud",label:"Taylor",bank_name:"Commonwealth Bank",bank_city:"Sydney",account_name:"Taylor",bsb:"123456",account_number:"12345",residential_address:"1 George Street",residential_city:"Sydney",residential_state:"NSW",residential_postcode:"2000",residential_country:"Australia",recipient_email:"taylor@example.com",recipient_phone:"0412345678"};
  assert.equal(normalize({...aud,shaba_number:"IR123456789012345678901234"}).data.shaba_number,undefined);
  assert.equal(normalize(aud).data.bank_city,"Sydney");
  assert.ok(normalize({...aud,bank_city:""}).fieldErrors.bank_city);
  assert.ok(normalize({...aud,bsb:"123-456"}).error);
  assert.ok(normalize({...aud,account_number:"1234"}).error);
  assert.ok(normalize({...aud,residential_postcode:"20"}).error);
  assert.ok(normalize({...aud,recipient_email:"not-an-email"}).error);
  assert.ok(normalize({...aud,recipient_phone:"abc"}).error);
  assert.ok(normalize({...irt,irt_phone:"abc"}).error);
  assert.ok(normalize({direction:"irt",label:"Legacy"}).error);
});

test("recipient action saves only validated editable fields under the authenticated owner",async()=>{
  let inserted;const scopes=[];
  const h=dashboardHarness({mocks:{
    "@supabase/supabase-js":{createClient:()=>({from:()=>({insert(rows){inserted=rows;return this;},select(){return this;},eq(k,v){scopes.push([k,v]);return this;},order:async()=>({data:[],error:null}),single:async()=>({data:inserted[0],error:null})})})},
    "@/lib/supabase-server":{createSupabaseServerActionClient:async()=>({auth:{getUser:async()=>({data:{user:{id:"authenticated-owner"}},error:null})}})},
  }});
  const {createRecipient,getRecipients}=h.load("app/actions/transaction.actions.ts");
  const valid={direction:"irt",label:"Alex",bank_name:"Saman Bank",bank_city:"Tehran",full_name:"Alex",shaba_number:"IR820540102680020817909002",irt_address:"Street",irt_city:"Shiraz",irt_state:"Fars",irt_country:"Iran",irt_phone:"09123456789"};
  const result=await createRecipient({...valid,user_id:"victim",id:"forged"});
  assert.equal(result.success,true);assert.equal(inserted[0].user_id,"authenticated-owner");assert.equal(inserted[0].bank_city,"Tehran");
  assert.equal(inserted[0].irt_city,"Shiraz");assert.equal(inserted[0].id,undefined);
  inserted=null;assert.ok((await createRecipient({...valid,bank_city:"x".repeat(121)})).error);assert.equal(inserted,null);
  await getRecipients();assert.deepEqual(scopes,[["user_id","authenticated-owner"]]);
});

test("recipient modal validates Iranian bank details inline and preserves values on a failed save",async()=>{
  for(const locale of ["en","fa"]) {
    const calls=[];let closed=0,created=0,fail=true;
    const h=dashboardHarness({locale,mocks:{...modalMocks,"@/app/actions/transaction.actions":{createRecipient:async payload=>{calls.push(payload);if(fail)throw Error("offline");return {data:{...payload,id:"new"}};}}}});
    const {RecipientModal}=h.load("components/dashboard/RecipientModal.tsx");
    const props={direction:"irt",locale,onClose(){closed++;},onCreated(){created++;}};
    const {render,find,control,change,submit,restore}=modalDriver(h,RecipientModal,props);
    const persian=value=>value.replace(/\d/g,d=>String.fromCharCode(0x6f0+Number(d)));
    try {
      await submit();assert.equal(find(e=>e.props.id==="recipient-name").props["aria-invalid"],true);
      change("name","Alex");await submit();
      change("bank_name","Saman Bank");change("bank_city","Tehran");change("shaba",persian("820540102680020817909003"));
      await submit();assert.equal(calls.length,0);assert.equal(find(e=>e.props.id==="recipient-shaba").props["aria-invalid"],true);
      change("shaba",persian("820540102680020817909002"));await submit();
      change("address","Street");change("state","Fars");change("city","Shiraz");change("phone","09123456789");
      await submit();
      assert.equal(calls.length,1);assert.equal(closed,0);assert.equal(created,0);
      assert.equal(find(e=>e.props.id==="recipient-save-error").props.role,"alert");
      assert.equal(control("city").props.value,"Shiraz");
      assert.equal(render().type,modalMocks["@/components/ui/dialog"].Dialog);
      fail=false;await submit();
      assert.equal(created,1);assert.equal(closed,1);assert.equal(calls[1].bank_city,"Tehran");assert.equal(calls[1].irt_city,"Shiraz");assert.equal(calls[1].shaba_number,"IR820540102680020817909002");
    }finally{restore();}
  }
});

test("recipient directory localises both directions and ignores reads after unmount",async()=>{
  for(const locale of ["en","fa"]) {
    let finish;const previousWindow=global.window;global.window={setTimeout:()=>0,clearTimeout(){}};
    const h=dashboardHarness({locale,mocks:{
      "./DashboardShell":{useDashboard:()=>({profile:{id:"customer"}})},
      "./RecipientModal":{RecipientModal:()=>null},
      "@/app/actions/transaction.actions":{getRecipientPage:()=>new Promise(resolve=>{finish=resolve;}),deleteRecipient:async()=>({})},
    }});
    try {
      const {DashboardRecipients}=h.load("components/dashboard/DashboardRecipients.tsx"),render=()=>h.render(DashboardRecipients);
      const row={id:"one",direction:"irt",full_name:"<script>bad</script>",bank_name:"Saman",bank_city:"Tehran",shaba_number:"IR1234567890"};
      render();h.effects();finish({data:[row],total:1,page:1,counts:{all:1,aud:0,irt:1}});await tick();
      const html=markup(render());assert.match(html,locale==="fa" ? /Tehran · ایران/ : /Tehran · Iran/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/IR1234567890/);assert.match(html,/recipient=one/);
      assert.match(html,new RegExp(`dir="${locale==="fa"?"rtl":"ltr"}"`));
      elements(render(),e=>e.props.dataKey==="data-recipient-country")[0].props.onChange("aud");render();h.effects();
      h.cleanup();finish({data:[],total:0,page:1,counts:{all:1,aud:0,irt:1}});await tick();
      assert.equal(elements(render(),e=>e.type==="article").length,1);
    } finally { global.window=previousWindow; }
  }
});

test("the new bank city migration preserves existing rows and enforces length on direct database writes",async()=>{
  const {PGlite}=require("@electric-sql/pglite");const db=new PGlite();
  try{
    await db.exec("CREATE TABLE public.recipients (id integer primary key, irt_city text); INSERT INTO public.recipients VALUES(1,'Shiraz');");
    const sql=fs.readFileSync("supabase/migrations/20260920_32_recipient_bank_city.sql","utf8");
    await db.exec(sql);await db.exec(sql);
    assert.deepEqual((await db.query("SELECT * FROM recipients")).rows,[{id:1,irt_city:"Shiraz",bank_city:null}]);
    await db.query("UPDATE recipients SET bank_city=$1 WHERE id=1",["Tehran"]);
    assert.deepEqual((await db.query("SELECT irt_city,bank_city FROM recipients")).rows,[{irt_city:"Shiraz",bank_city:"Tehran"}]);
    await assert.rejects(db.query("UPDATE recipients SET bank_city=$1",["x".repeat(121)]),/recipients_bank_city_length/);
  }finally{await db.close();}
});

test("own Iranian account requires only the contact fields used for Iranian recipients",async()=>{
  const calls=[];let created=0,closed=0;
  const h=dashboardHarness({mocks:{...modalMocks,"@/app/actions/transaction.actions":{createRecipient:async payload=>{calls.push(payload);return {data:{...payload,id:"own-irt"}};}}}});
  const {RecipientModal}=h.load("components/dashboard/RecipientModal.tsx");
  const props={direction:"irt",mode:"self_destination",locale:"en",profile:{address:"Street",suburb:"Shiraz",state:"Fars",country:"Iran",mobile_number:"09123456789",postcode:"",email:""},onClose(){closed++;},onCreated(){created++;}};
  const {change,submit,restore}=modalDriver(h,RecipientModal,props);
  try {
    change("name","Alex");await submit();
    change("bank_name","Saman Bank");change("bank_city","Tehran");change("shaba","820540102680020817909002");await submit();
    await submit();
    assert.equal(created,1);assert.equal(closed,1);assert.equal(calls[0].irt_postcode,"");assert.equal(calls[0].irt_city,"Shiraz");assert.equal(calls[0].shaba_number,"IR820540102680020817909002");
  }finally{restore();}
});

test("the circular logo replaces the old ribbon and currency ornaments in both languages",()=>{
  const h=dashboardHarness(), {TransferJourneyVisual}=h.load("components/dashboard/TransferJourneyVisual.tsx");
  for(const locale of ["en","fa"]){
    const html=markup(React.createElement(TransferJourneyVisual,{stage:2,from:"AUD",to:"IRT",locale}));
    assert.match(html,/data-stage="2"/);assert.match(html,/src="\/images\/logo-no-text-light\.svg"/);
    assert.match(html,/data-logo-orbit="true"/);assert.match(html,/data-duration="7"/);
    assert.match(html,/dir="ltr"/);assert.match(html,/transform:none/);
    assert.doesNotMatch(html,/ZARMAN CONNECTION|>AUD<|>IRT<|AUSTRALIA|IRAN|signatureRibbon/);
  }
  const source=fs.readFileSync("components/dashboard/TransferBrandMotif.tsx","utf8");
  assert.match(source,/LOGO_ORBIT_DURATION = 7/);
  assert.match(source,/motionEnabled && dashboardMotion && systemReducedMotion === false && !quiet/);
  assert.match(source,/useInView\(ref, \{ once: true/);
  assert.match(source,/key=\{`\$\{safeStage\}-\$\{replayKey\}-\$\{loading\}`\}/);
  // Infinite loops are reserved for the loading state; otherwise the orbit plays once.
  assert.match(source,/const looping = animate && inView && loading, intro = animate && inView && !loading/);
  assert.doesNotMatch(source,/\bsetInterval\(|\bsetTimeout\(|signatureRibbon|M38 43h87/);
});

test("bright surface tokens, pause control and reduced-motion rules protect readability and motion preferences",()=>{
  const css=fs.readFileSync("styles/dashboard/DashboardShell.module.css","utf8");
  assert.match(css,/--color-text-primary:#182027/);assert.match(css,/color-scheme:light/);assert.match(css,/data-motion="off"/);assert.match(css,/prefers-reduced-motion/);
  for(const file of ["RecipientModal","DashboardRecipients","DashboardRequestHub"])assert.match(fs.readFileSync(`styles/dashboard/${file}.module.css`,"utf8"),/prefers-reduced-motion/);
  const h=dashboardHarness(), {DashboardHeader}=h.load("components/dashboard/DashboardHeader.tsx");
  let toggled=0;
  const props={activeTab:"overview",profile:null,privateAmounts:false,onTogglePrivacy(){},motion:false,onToggleMotion(){toggled++;}};
  let tree=h.render(DashboardHeader,props);
  elements(tree,e=>e.props["aria-label"]==="Display preferences")[0].props.onClick();
  tree=h.render(DashboardHeader,props);
  assert.equal(elements(tree,e=>e.props.open===true).length,1);
  const checkbox=elements(tree,e=>e.type==="input" && e.props.type==="checkbox")[1];
  assert.equal(checkbox.props.checked,false);checkbox.props.onChange();assert.equal(toggled,1);
});

test("the transfer hero displays each quoted currency, preserves privacy hooks and escapes recipient text in EN and FA",()=>{
  for(const locale of ["en","fa"]) {
    const h=dashboardHarness({locale}), {TransferOverviewCard}=h.load("components/dashboard/TransferOverviewCard.tsx");
    const render=value=>markup(React.createElement(TransferOverviewCard,{request:value,locale,loading:false,error:false,onRetry(){},motionEnabled:false}));
    const quote={...request.quote,applied_rate:105000,recipient_snapshot:{full_name:"<script>recipient</script>"}};
    const html=render({...request,quote});
    assert.match(html,/ZE36827/);assert.match(html,/&lt;script&gt;recipient&lt;\/script&gt;/);assert.doesNotMatch(html,/<script>/);
    const privateValues=[...html.matchAll(/<[^>]+data-private-value(?:="true")?[^>]*>([\s\S]*?)<\/[^>]+>/g)].map(([,value])=>value.replace(/<[^>]+>/g,"")).join(" ");
    assert.match(privateValues,locale==="en" ? /234,675,000/ : /۲۳۴٬۶۷۵٬۰۰۰/);
    assert.match(privateValues,locale==="en" ? /2,235/ : /۲٬۲۳۵/);
    assert.match(html,locale==="en" ? /Toman/ : /تومان/);assert.match(html,/AUD/);
    const reverse=render({...request,reference_code:"ZE99999",quote:{...quote,funding_total:1234.56,funding_currency:"AUD",recipient_amount:129628800,recipient_currency:"IRT"}});
    assert.match(reverse,/ZE99999/);assert.doesNotMatch(reverse,/ZE36827/);
    assert.match(reverse,locale==="en" ? /1,234\.56/ : /۱٬۲۳۴٫۵۶/);
    assert.match(reverse,locale==="en" ? /129,628,800/ : /۱۲۹٬۶۲۸٬۸۰۰/);
    assert.doesNotMatch(reverse,/NaN|undefined/);
  }
});

test("hero state changes follow admin facts and only expose the currently valid customer action",()=>{
  for(const locale of ["en","fa"]) {
    const h=dashboardHarness({locale}), {TransferOverviewCard}=h.load("components/dashboard/TransferOverviewCard.tsx");
    const render=value=>markup(React.createElement(TransferOverviewCard,{request:value,locale,loading:false,error:false,onRetry(){},motionEnabled:false}));
    const unpaid={...request,status:"submitted",funding_status:"unpaid",funding_received:0,payment_approved_at:null,evidence_submitted_at:null,funds_confirmed_at:null};
    const pending=render(unpaid);assert.doesNotMatch(pending,/href="[^"]*#request-payment-details/);
    for(const label of locale==="fa"
      ? ["درخواست شما ثبت شد (در حال بررسی)","کارشناسان ما در حال بررسی درخواست شما هستند. به محض تأیید، اطلاعات حساب بانکی جهت واریز وجه در همین صفحه نمایش داده خواهد شد.","در انتظار تأیید","در حال بررسی توسط زرمان","جزئیات تراکنش","به‌روزرسانی وضعیت","در این مرحله نیازی به اقدام از سوی شما نیست.","بررسی درخواست","تأیید درخواست (آماده واریز)","بررسی رسید بانکی","تأیید دریافت وجه","تکمیل تراکنش"]
      : ["Request Submitted (Under Review)","Our team is reviewing your request. Once approved, the bank account details for your deposit will be displayed here.","Pending Approval","Under Review by Zarman","Transaction Details","Refresh Status","No action required at this stage.","Request Review","Approved (Ready to Pay)","Receipt Review","Funds Confirmed","Transfer Completed"]) assert.ok(pending.includes(label),label);
    const approved={...unpaid,status:"awaiting_funds",payment_approved_at:request.payment_approved_at};
    assert.match(render(approved),new RegExp(`href="/${locale}/dashboard/requests/fixture-request#request-payment-details"`));
    for(const value of [{...approved,status:"under_review",evidence_submitted_at:request.evidence_submitted_at},request,{...request,status:"processing"}]) {
      const html=render(value);assert.doesNotMatch(html,/href="[^"]*#request-payment-details|href="[^"]*#request-conversation/);
      assert.match(html,locale==="en" ? /No action required at this stage/ : /در این مرحله نیازی به اقدام از سوی شما نیست/);
    }
    const received=render(request);assert.match(received,locale==="en" ? /Funds received/ : /وجه دریافت شد/);
    assert.match(render({...request,customer_action_required:"Confirm the recipient"}),new RegExp(`href="/${locale}/dashboard/requests/fixture-request#request-conversation"`));
    assert.match(render({...request,status:"completed"}),/href="\/api\/requests\/fixture-request\/receipt"/);
    for(const value of [{...unpaid,status:"cancelled"},{...request,funding_status:"refund_pending"},{...request,funding_status:"refunded"},{...request,status:"completed",priority_fee_status:"refund_pending"}]) {
      assert.doesNotMatch(render(value),/href="[^"]*#request-payment-details|href="\/api\/requests\/fixture-request\/receipt"/);
    }
  }
});

test("an approved request returned to admin review never invites payment before review is cleared",()=>{
  for(const locale of ["en","fa"]) {
    const h=dashboardHarness({locale}), {journeyPresentation}=h.load("lib/dashboard/journey-presentation.ts");
    const {TransferOverviewCard}=h.load("components/dashboard/TransferOverviewCard.tsx");
    const held={...request,status:"under_review",funding_status:"unpaid",funding_received:0,evidence_submitted_at:null,funds_confirmed_at:null};
    const state=journeyPresentation(held,locale);
    assert.equal(state.approved,true);assert.equal(state.stage,1);assert.equal(state.canPay,false);
    assert.equal(state.nextActor,"zarman");assert.equal(state.href,null);assert.equal(state.action,null);assert.equal(state.mood,"waiting");
    assert.match(state.heading,locale==="en" ? /reviewing your request/ : /در حال بررسی درخواست شما/);
    assert.match(state.description,locale==="en" ? /No action needed/ : /نیازی به اقدام شما نیست/);
    const html=markup(React.createElement(TransferOverviewCard,{request:held,locale,motionEnabled:false}));
    assert.match(html,/data-next-actor="zarman"/);
    assert.match(html,locale==="en" ? /No action needed/ : /نیازی به اقدام شما نیست/);
    assert.doesNotMatch(html,/href="[^"]*#request-payment-details/);
    assert.doesNotMatch(html,locale==="en" ? /ready to pay|Your turn|Transfer the exact amount/ : /آماده واریز وجه هستید|نوبت شما|مبلغ مشخص‌شده را واریز کنید/);
  }
});

test("the transfer hero distinguishes loading and unavailable data from a genuinely empty account",()=>{
  for(const locale of ["en","fa"]) {
    const buttons=[];let retried=0;
    const h=dashboardHarness({locale,mocks:{"@/components/ui/button":{Button:({asChild,children,...props})=>{
      buttons.push(props);return asChild ? React.cloneElement(React.Children.only(children),props) : React.createElement("button",props,children);
    }}}});
    const {TransferOverviewCard}=h.load("components/dashboard/TransferOverviewCard.tsx");
    const render=props=>markup(React.createElement(TransferOverviewCard,{request:null,locale,loading:false,error:false,onRetry(){retried++;},motionEnabled:false,...props}));
    const loading=render({loading:true});assert.match(loading,/aria-busy="true"|role="status"/);
    assert.doesNotMatch(loading,/href="[^"]*#request-payment-details|href="\/api\/requests\//);
    const empty=render({});assert.match(empty,new RegExp(`href="/${locale}/dashboard\\?tab=transfer"`));
    assert.match(empty,locale==="fa" ? /فراتر از مرزها/ : /Beyond Borders/);
    assert.match(empty,locale==="fa" ? /تجربه جدیدی از پرداخت‌های بین‌المللی/ : /A New Experience in International Payments/);
    assert.match(empty,locale==="fa" ? /حواله‌های شخصی و تجاری خود را با بالاترین امنیت ارسال کنید/ : /Send your personal and business transfers with top security/);
    assert.match([...h.css.values()].join("\n"),/@container \(min-width: 580px\)/);
    for(const value of [null,{...request,status:"awaiting_funds",funding_status:"unpaid",funds_confirmed_at:null,evidence_submitted_at:null}]) {
      buttons.length=0;const failure=render({request:value,error:true});
      assert.match(failure,/role="alert"|role="status"/);
      assert.doesNotMatch(failure,/href="[^"]*#request-payment-details|href="\/api\/requests\//);
      const retry=buttons.find(props=>typeof props.onClick==="function");assert.ok(retry,"an unavailable or stale feed must offer retry");retry.onClick();
    }
    assert.equal(retried,2);
  }
});

test("the overview hero stays connected to the request feed and prioritises the customer's next action",()=>{
  let feed={requests:[],loading:false,error:false,refreshing:false,refresh(){}};
  const h=dashboardHarness({mocks:{
    "./DashboardShell":{useDashboard:()=>({profile:{first_name:"Alex",kyc_status:"approved",loyalty_discount_toman:0},motionEnabled:false}),useDashboardMotion:()=>false},
    "@/hooks/useDashboardRequests":{useDashboardRequests:()=>feed},
    "@/context/FinanceConfigContext":{useFinanceConfig:()=>finance},
    "./TransferOverviewCard":{TransferOverviewCard:()=>null},
    "./DashboardOverviewRecipients":{DashboardOverviewRecipients:()=>null},
  }});
  const {DashboardOverview}=h.load("components/dashboard/DashboardOverview.tsx");
  const props={volume:0,completedCount:0,baseBuyRate:105000,baseSellRate:106000};
  const hero=()=>elements(h.render(DashboardOverview,props),e=>"onRetry" in e.props && "request" in e.props)[0];
  const attention={...request,id:"attention",reference_code:"ZE00001",status:"awaiting_funds",funding_status:"unpaid",funds_confirmed_at:null,evidence_submitted_at:null,created_at:"2026-09-14T01:20:00Z"};
  feed={...feed,requests:[request,attention]};assert.equal(hero().props.request.id,"attention");assert.equal(hero().props.motionEnabled,false);
  const confirmed={...attention,funding_status:"confirmed",funds_confirmed_at:request.funds_confirmed_at};
  feed={...feed,requests:[confirmed]};assert.equal(hero().props.request,confirmed);
  feed={...feed,error:true};assert.equal(hero().props.error,true);
  feed={...feed,requests:[],loading:true,error:false};assert.equal(hero().props.loading,true);assert.ok(hero().props.request == null);
});

test("detail status card shares the overview layout with local action links and no stage counter",()=>{
  for(const locale of ["en","fa"]) {
    const h=dashboardHarness({locale}), {RequestProgress}=h.load("components/requests/RequestProgress.tsx");
    const render=value=>markup(React.createElement(RequestProgress,{request:value,locale,onRefresh(){}}));
    const pending={...request,status:"submitted",funding_status:"unpaid",payment_approved_at:null,evidence_submitted_at:null,funds_confirmed_at:null};
    const html=render(pending);
    assert.match(html,/data-transfer-overview/);
    assert.match(html,/TransferOverviewCard_activeCard/);
    assert.match(html,/data-lottie-scene=/);
    assert.match(html,/href="#request-transfer-details"/);
    assert.match(html,locale==="fa" ? /به‌روزرسانی وضعیت/ : /Refresh Status/);
    assert.doesNotMatch(html,/Step 1 of 5|Stage 1 of 5|مرحله ۱ از ۵/);
    const payable={...pending,status:"awaiting_funds",payment_approved_at:request.payment_approved_at,funding_due_at:"2026-09-15T12:30:00Z"};
    const payment=render(payable);
    assert.match(payment,/href="#request-payment-details"/);
    assert.match(payment,locale==="fa" ? /مهلت واریز تا/ : /Payment due by/);
    assert.match(payment,/dateTime="2026-09-15T12:30:00Z"/);
    assert.doesNotMatch(render({...payable,evidence_submitted_at:request.evidence_submitted_at}),/Payment due by|مهلت واریز تا/);
    assert.match(render({...pending,customer_action_required:"Confirm recipient"}),/href="#request-conversation"/);
    assert.match(render({...request,status:"completed"}),/href="\/api\/requests\/fixture-request\/receipt"/);
  }
});

test("hero and stepper honor both the dashboard pause control and the system motion preference",()=>{
  for(const [motionEnabled,reducedMotion,expected] of [[false,false,false],[true,true,false],[true,false,true]]) {
    let scene,journeyStepper,baseStepper;
    const h=dashboardHarness({mocks:{
      "framer-motion":{...require("framer-motion"),useReducedMotion:()=>reducedMotion},
      "motion/react":{...require("motion/react"),useReducedMotion:()=>reducedMotion},
      "./DashboardLottieScene":{DashboardLottieScene:props=>{scene=props;return null;}},
      "@/components/requests/RequestJourneyStepper":{RequestJourneyStepper:props=>{journeyStepper=props;return null;}},
      "@/components/Stepper":{__esModule:true,default:props=>{baseStepper=props;return null;},Step:()=>null},
    }});
    const {TransferOverviewCard}=h.load("components/dashboard/TransferOverviewCard.tsx");
    markup(React.createElement(TransferOverviewCard,{request,locale:"en",motionEnabled}));
    assert.equal(scene.motionEnabled,motionEnabled);assert.equal(journeyStepper.motionEnabled,expected);
    const {RequestJourneyStepper}=h.load("components/requests/RequestJourneyStepper.tsx");
    markup(React.createElement(RequestJourneyStepper,journeyStepper));
    assert.equal(baseStepper.motionEnabled,expected);assert.equal(baseStepper.readOnly,true);assert.equal(baseStepper.currentStep,4);
  }
});
