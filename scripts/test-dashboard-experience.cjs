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
    const render=(value,events=[])=>markup(h.render(RequestProgress,{request:value,events,locale}));
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
    en:{customer:"Your turn",zarman:"With Zarman",complete:"Complete",closed:"Closed"},
    fa:{customer:"\u0646\u0648\u0628\u062a \u0634\u0645\u0627",zarman:"\u0646\u0632\u062f \u0632\u0631\u0645\u0627\u0646",complete:"\u062a\u06a9\u0645\u06cc\u0644 \u0634\u062f\u0647",closed:"\u0628\u0633\u062a\u0647 \u0634\u062f\u0647"},
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
      assert.equal(state.nextActor,nextActor);assert.equal(state.actorLabel,actorLabels[locale][nextActor]);
      assert.equal((html.match(/aria-current="step"/g)||[]).length,1);
      assert.equal(Boolean(state.href),stage===1 || stage===4);
      if(stage===3) {assert.match(html,locale==="en" ? /No action needed/:/نیازی به اقدام شما نیست/);assert.doesNotMatch(html,/href="#request-payment-details"/);}
    }
    const {DashboardActivity}=h.load("components/dashboard/DashboardActivity.tsx");
    const activity=markup(React.createElement(DashboardActivity,{requests:[approved,complete],loading:false,refreshing:false,error:false,onRefresh(){}}));
    assert.match(activity,new RegExp(actorLabels[locale].customer));
    assert.match(activity,new RegExp(actorLabels[locale].complete));
    const question=present({...request,customer_action_required:"Please confirm"},locale);
    assert.equal(question.href,"#request-conversation");assert.equal(question.mood,"attention");assert.equal(question.nextActor,"customer");assert.equal(question.actorLabel,actorLabels[locale].customer);
    const rejected=present({...pending,status:"rejected"},locale);
    assert.equal(rejected.href,null);assert.equal(rejected.mood,"failed");assert.equal(rejected.nextActor,"closed");assert.equal(rejected.actorLabel,actorLabels[locale].closed);
    const refund=present({...request,funding_status:"refund_pending"},locale);
    assert.equal(refund.href,null);assert.equal(refund.mood,"quiet");assert.equal(refund.nextActor,"zarman");
    const priorityRefund=present({...complete,priority_fee_status:"refund_pending"},locale);
    assert.equal(priorityRefund.href,null);assert.equal(priorityRefund.mood,"quiet");assert.equal(priorityRefund.nextActor,"zarman");
    assert.match(priorityRefund.status,locale==="en" ? /Priority fee refund/:/بازپرداخت هزینه سرویس اولویت‌دار/);
    const {DashboardTransactionHistory}=h.load("components/dashboard/DashboardTransactionHistory.tsx");
    const legacy=markup(React.createElement(DashboardTransactionHistory,{transactions:[{id:"legacy",type:"buy_aud",status:"pending",amount_aud:100,equivalent_toman:10000000,created_at:request.created_at,reference_code:"ZE10000",recipients:{label:"Alex"}}],onDeleteTransaction(){}}));
    assert.match(legacy,new RegExp(actorLabels[locale].zarman));
    const spotlight=markup(React.createElement(RequestProgress,{request:approved,locale,spotlight:true}));
    assert.match(spotlight,new RegExp(`/${locale}/dashboard/requests/fixture-request#request-payment-details`));
  }
});

test("loyalty, personalised rates and savings use the existing financial configuration",()=>{
  for(const locale of ["en","fa"]) {
    const h=dashboardHarness({locale,mocks:{
      "./DashboardShell":{useDashboard:()=>({profile:{first_name:"Alex",kyc_status:"approved",loyalty_discount_toman:12345}})},
      "@/hooks/useDashboardRequests":{useDashboardRequests:()=>({requests:[],loading:false,error:false,refreshing:false,refresh(){}})},
      "@/context/FinanceConfigContext":{useFinanceConfig:()=>finance},
    }});
    const {DashboardOverview}=h.load("components/dashboard/DashboardOverview.tsx");
    const html=markup(React.createElement(DashboardOverview,{volume:2500,completedCount:2,tailoredRate:99900,baseRate:100000,loyaltyBonus:100}));
    assert.match(html,/aria-valuenow="50"/);assert.match(html,/500 AUD/);assert.match(html,/12,345/);
    assert.match(html,/<bdi data-private-value="true">500 AUD<\/bdi>/);
    assert.match(html,/99,900/);assert.match(html,/100,000/);assert.match(html,/100 /);
    assert.match(html,locale==="en" ? /discount on the exchange-rate spread/:/تخفیف از فاصله نرخ خرید و فروش/);
    assert.match(html,new RegExp(`/${locale}/dashboard\\?tab=recipients`));
    assert.doesNotMatch(html,/undefined|NaN/);
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
  const previous=global.requestAnimationFrame;global.requestAnimationFrame=()=>1;
  const render=()=>h.render(DashboardRequestHub,props),next=()=>elements(render(),e=>String(e.props.className).includes("wizardNext"))[0].props.onClick();
  try {
    render();h.effects();await tick();render();h.effects();
    const labels=markup(render());for(const label of ["Amount","Recipient","Review"])assert.match(labels,new RegExp(label));
    assert.match(labels,/react-bits-stepper/);
    next();assert.equal(elements(render(),e=>e.type===SelectBox).length,0);assert.equal(elements(render(),e=>e.props.role==="alert").length,1);
    props.amountStr="1000";next();assert.equal(elements(render(),e=>e.type===SelectBox)[0].props.value,"saved");
    next();let submit=elements(render(),e=>e.type===OnlineRequestSubmit)[0];assert.ok(submit);assert.ok(submit.props.validationMessage);
    let reviewSelects=elements(render(),e=>e.type===SelectBox);assert.equal(reviewSelects.length,2);
    reviewSelects[0].props.onChange("Loan");reviewSelects[1].props.onChange("Support Family");
    submit=elements(render(),e=>e.type===OnlineRequestSubmit)[0];assert.equal(submit.props.input.recipientId,"saved");assert.equal(submit.props.input.sourceOfFunds,"Loan");assert.equal(submit.props.input.reasonForTransfer,"Support Family");assert.equal(submit.props.validationMessage,null);
    elements(render(),e=>String(e.props.className).includes("wizardBack"))[0].props.onClick();
    assert.equal(elements(render(),e=>e.type===SelectBox)[0].props.value,"saved");
    next();submit=elements(render(),e=>e.type===OnlineRequestSubmit)[0];assert.equal(submit.props.input.sourceOfFunds,"Loan");assert.equal(submit.props.input.reasonForTransfer,"Support Family");
  }finally{global.requestAnimationFrame=previous;}
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
  const aud={direction:"aud",label:"Taylor",bank_name:"Commonwealth Bank",account_name:"Taylor",bsb:"123456",account_number:"12345",residential_address:"1 George Street",residential_city:"Sydney",residential_state:"NSW",residential_postcode:"2000",residential_country:"Australia",recipient_email:"taylor@example.com",recipient_phone:"0412345678"};
  assert.equal(normalize({...aud,bank_city:"Tehran",shaba_number:"IR123456789012345678901234"}).data.bank_city,undefined);
  assert.equal(normalize({...aud,bank_city:"Tehran"}).data.shaba_number,undefined);
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
    const render=()=>h.render(RecipientModal,props),change=(id,value)=>elements(render(),e=>e.props.id===`recipient-${id}`)[0].props.onChange({target:{value}});
    const submit=async()=>{elements(render(),e=>e.type==="form")[0].props.onSubmit({preventDefault(){}});await tick();};
    const persian=value=>value.replace(/\d/g,d=>String.fromCharCode(0x6f0+Number(d)));
    const previous=global.requestAnimationFrame;global.requestAnimationFrame=()=>1;
    try {
      await submit();assert.equal(elements(render(),e=>e.props.id==="recipient-name")[0].props["aria-invalid"],true);
      change("name","Alex");change("relationship","family");await submit();
      change("bank_name","Saman Bank");change("bank_city","Tehran");change("shaba",persian("820540102680020817909003"));
      let html=markup(render());assert.match(html,/role="dialog"/);assert.match(html,/maxLength="120"/);assert.match(html,/pattern="\[0-9\]\{24\}"/);
      change("address","Street");change("city","Shiraz");change("state","Fars");change("residential_country","Iran");change("phone","09123456789");
      await submit();assert.equal(calls.length,0);assert.equal(elements(render(),e=>e.props.id==="recipient-shaba")[0].props["aria-invalid"],true);
      change("shaba",persian("820540102680020817909002"));await submit();
      assert.equal(closed,0);assert.equal(elements(render(),e=>e.props.role==="alert").length,1);
      assert.equal(elements(render(),e=>e.props.id==="recipient-bank_city")[0].props.value,"Tehran");
      fail=false;await submit();
      assert.equal(created,1);assert.equal(closed,1);assert.equal(calls[1].bank_city,"Tehran");assert.equal(calls[1].irt_city,"Shiraz");assert.equal(calls[1].shaba_number,"IR820540102680020817909002");assert.equal(calls[1].relationship,"family");
    }finally{global.requestAnimationFrame=previous;}
  }
});

test("recipient directory localises both directions and ignores reads after unmount",async()=>{
  for(const locale of ["en","fa"]) {
    let finish;const h=dashboardHarness({locale,mocks:{
      "framer-motion": modalMocks["framer-motion"],
      "./DashboardShell":{useDashboard:()=>({profile:{id:"customer"}})},
      "./RecipientModal":{RecipientModal:()=>null},
      "@/app/actions/transaction.actions":{getRecipients:()=>new Promise(resolve=>{finish=resolve;})},
    }});
    const {DashboardRecipients}=h.load("components/dashboard/DashboardRecipients.tsx"),render=()=>h.render(DashboardRecipients);
    render();h.effects();finish({data:[{id:"one",direction:"irt",full_name:"<script>bad</script>",bank_name:"Saman",bank_city:"Tehran",shaba_number:"IR1234567890"}]});await tick();
    elements(render(),e=>e.props["data-recipient-country"]==="irt")[0].props.onClick();
    const html=markup(render());assert.match(html,/Tehran/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/IR1234567890/);assert.match(html,/recipient=one/);
    h.cleanup();assert.equal(elements(render(),e=>e.type==="article").length,1);
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
  const render=()=>h.render(RecipientModal,props),change=(id,value)=>elements(render(),e=>e.props.id===`recipient-${id}`)[0].props.onChange({target:{value}});
  const previous=global.requestAnimationFrame;global.requestAnimationFrame=()=>1;
  try {
    change("name","Alex");
    elements(render(),e=>e.type==="form")[0].props.onSubmit({preventDefault(){}});await tick();
    change("bank_name","Saman Bank");change("shaba","820540102680020817909002");
    elements(render(),e=>e.type==="form")[0].props.onSubmit({preventDefault(){}});await tick();
    assert.equal(created,1);assert.equal(closed,1);assert.equal(calls[0].irt_postcode,"");assert.equal(calls[0].shaba_number,"IR820540102680020817909002");
  }finally{global.requestAnimationFrame=previous;}
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
  assert.match(source,/key=\{`\$\{safeStage\}-\$\{replayKey\}`\}/);
  assert.doesNotMatch(source,/\brepeat\s*:|\bsetInterval\(|\bsetTimeout\(|signatureRibbon|M38 43h87/);
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
    const approved={...unpaid,status:"awaiting_funds",payment_approved_at:request.payment_approved_at};
    assert.match(render(approved),new RegExp(`href="/${locale}/dashboard/requests/fixture-request#request-payment-details"`));
    for(const value of [{...approved,status:"under_review",evidence_submitted_at:request.evidence_submitted_at},request,{...request,status:"processing"}]) {
      const html=render(value);assert.doesNotMatch(html,/href="[^"]*#request-payment-details|href="[^"]*#request-conversation/);
      assert.match(html,locale==="en" ? /No action needed/ : /نیازی به اقدام شما نیست/);
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
  }});
  const {DashboardOverview}=h.load("components/dashboard/DashboardOverview.tsx");
  const props={volume:0,completedCount:0,tailoredRate:105000,baseRate:105000};
  const hero=()=>elements(h.render(DashboardOverview,props),e=>"onRetry" in e.props && "request" in e.props)[0];
  const attention={...request,id:"attention",reference_code:"ZE00001",status:"awaiting_funds",funding_status:"unpaid",funds_confirmed_at:null,evidence_submitted_at:null,created_at:"2026-09-14T01:20:00Z"};
  feed={...feed,requests:[request,attention]};assert.equal(hero().props.request.id,"attention");assert.equal(hero().props.motionEnabled,false);
  const confirmed={...attention,funding_status:"confirmed",funds_confirmed_at:request.funds_confirmed_at};
  feed={...feed,requests:[confirmed]};assert.equal(hero().props.request,confirmed);
  feed={...feed,error:true};assert.equal(hero().props.error,true);
  feed={...feed,requests:[],loading:true,error:false};assert.equal(hero().props.loading,true);assert.ok(hero().props.request == null);
});

test("hero and stepper honor both the dashboard pause control and the system motion preference",()=>{
  for(const [motionEnabled,reducedMotion,expected] of [[false,false,false],[true,true,false],[true,false,true]]) {
    let motif,journeyStepper,baseStepper;
    const h=dashboardHarness({mocks:{
      "framer-motion":{...require("framer-motion"),useReducedMotion:()=>reducedMotion},
      "motion/react":{...require("motion/react"),useReducedMotion:()=>reducedMotion},
      "./TransferBrandMotif":{__esModule:true,default:props=>{motif=props;return null;}},
      "@/components/requests/RequestJourneyStepper":{RequestJourneyStepper:props=>{journeyStepper=props;return null;}},
      "@/components/Stepper":{__esModule:true,default:props=>{baseStepper=props;return null;},Step:()=>null},
    }});
    const {TransferOverviewCard}=h.load("components/dashboard/TransferOverviewCard.tsx");
    markup(React.createElement(TransferOverviewCard,{request,locale:"en",motionEnabled}));
    assert.equal(motif.motionEnabled,expected);assert.equal(journeyStepper.motionEnabled,expected);
    const {RequestJourneyStepper}=h.load("components/requests/RequestJourneyStepper.tsx");
    markup(React.createElement(RequestJourneyStepper,journeyStepper));
    assert.equal(baseStepper.motionEnabled,expected);assert.equal(baseStepper.readOnly,true);assert.equal(baseStepper.currentStep,4);
  }
});
