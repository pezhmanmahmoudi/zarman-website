/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict"), {test} = require("node:test"), fs = require("node:fs");
const React = require("react"), {renderToStaticMarkup} = require("react-dom/server");
const {dashboardHarness,request} = require("./helpers/dashboard-harness.cjs");
const tick = () => new Promise(resolve=>setImmediate(resolve));
const markup = tree=>renderToStaticMarkup(tree);
function elements(tree,predicate) {
  const result=[];function walk(node){if(!React.isValidElement(node))return;if(predicate(node))result.push(node);React.Children.forEach(node.props.children,walk);}walk(tree);return result;
}
const finance = {discount_step_volume:1000,discount_percent_per_step:.005,max_discount_percent:.25,fee_threshold:1000,applied_fee:30};

test("the animated journey follows financial facts and offers only the correct next action in both languages",()=>{
  for(const locale of ["en","fa"]) {
    const h=dashboardHarness({locale}), {journeyPresentation:present}=h.load("lib/dashboard/journey-presentation.ts");
    const {RequestProgress}=h.load("components/requests/RequestProgress.tsx");
    const pending={...request,status:"submitted",funding_status:"unpaid",payment_approved_at:null,evidence_submitted_at:null,funds_confirmed_at:null};
    const approved={...pending,status:"awaiting_funds",payment_approved_at:request.created_at};
    const reviewed={...approved,status:"under_review",evidence_submitted_at:request.created_at};
    const complete={...request,status:"completed"};
    for(const [value,stage] of [[pending,0],[approved,1],[reviewed,2],[request,3],[complete,4]]) {
      const state=present(value,locale), html=markup(React.createElement(RequestProgress,{request:value,locale}));
      assert.equal(state.stage,stage);assert.match(html,new RegExp(`data-stage="${stage}"`));
      assert.equal((html.match(/aria-current="step"/g)||[]).length,1);
      assert.equal(Boolean(state.href),stage===1 || stage===4);
      if(stage===3) {assert.match(html,locale==="en" ? /No action needed/:/نیازی به اقدام شما نیست/);assert.doesNotMatch(html,/href="#request-payment-details"/);}
    }
    const question=present({...request,customer_action_required:"Please confirm"},locale);
    assert.equal(question.href,"#request-conversation");assert.equal(question.mood,"attention");
    const refund=present({...request,funding_status:"refund_pending"},locale);
    assert.equal(refund.href,null);assert.equal(refund.mood,"quiet");
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
    next();assert.equal(elements(render(),e=>e.type===SelectBox).length,0);assert.equal(elements(render(),e=>e.props.role==="alert").length,1);
    props.amountStr="1000";next();assert.equal(elements(render(),e=>e.type===SelectBox)[0].props.value,"saved");
    next();assert.equal(elements(render(),e=>e.type===OnlineRequestSubmit).length,0);
    elements(render(),e=>e.type===SelectBox)[1].props.onChange("Loan");
    elements(render(),e=>e.type===SelectBox)[2].props.onChange("Support Family");
    next();assert.equal(elements(render(),e=>e.type===OnlineRequestSubmit)[0].props.input.recipientId,"saved");
  }finally{global.requestAnimationFrame=previous;}
});

test("bank branch city remains separate from residential city and cannot change recipient ownership",()=>{
  const {normalizeRecipientInput:normalize}=dashboardHarness().load("lib/dashboard/recipient-input.ts");
  const result=normalize({direction:"irt",label:" Alex ",bank_city:" Tehran ",irt_city:"Shiraz",user_id:"victim",id:"forged",created_at:"forged",extra:"forged"});
  assert.deepEqual(result.data,{direction:"irt",label:"Alex",bank_city:"Tehran",irt_city:"Shiraz"});
  assert.ok(normalize({direction:"irt",label:"Alex",bank_city:"x".repeat(121)}).error);
  assert.ok(normalize({direction:"irt",label:"Alex",bank_city:{sql:"no"}}).error);
  assert.ok(normalize(null).error);assert.ok(normalize({direction:"irt",label:123}).error);
  assert.equal(normalize({direction:"aud",label:"Alex",bank_city:"Tehran"}).data.bank_city,undefined);
  assert.equal(normalize({direction:"irt",label:"Legacy"}).error,undefined);
});

test("recipient action saves only validated editable fields under the authenticated owner",async()=>{
  let inserted;const scopes=[];
  const h=dashboardHarness({mocks:{
    "@supabase/supabase-js":{createClient:()=>({from:()=>({insert(rows){inserted=rows;return this;},select(){return this;},eq(k,v){scopes.push([k,v]);return this;},order:async()=>({data:[],error:null}),single:async()=>({data:inserted[0],error:null})})})},
    "@/lib/supabase-server":{createSupabaseServerActionClient:async()=>({auth:{getUser:async()=>({data:{user:{id:"authenticated-owner"}},error:null})}})},
  }});
  const {createRecipient,getRecipients}=h.load("app/actions/transaction.actions.ts");
  const result=await createRecipient({direction:"irt",label:"Alex",bank_city:"Tehran",irt_city:"Shiraz",user_id:"victim",id:"forged"});
  assert.equal(result.success,true);assert.equal(inserted[0].user_id,"authenticated-owner");assert.equal(inserted[0].bank_city,"Tehran");
  assert.equal(inserted[0].irt_city,"Shiraz");assert.equal(inserted[0].id,undefined);
  inserted=null;assert.ok((await createRecipient({direction:"irt",label:"Alex",bank_city:"x".repeat(121)})).error);assert.equal(inserted,null);
  await getRecipients();assert.deepEqual(scopes,[["user_id","authenticated-owner"]]);
});

test("recipient modal saves Iranian bank city, keeps native validation and retries failed saves",async()=>{
  for(const locale of ["en","fa"]) {
    const calls=[];let closed=0,created=0,fail=true;
    const h=dashboardHarness({locale,mocks:{"@/app/actions/transaction.actions":{createRecipient:async payload=>{calls.push(payload);if(fail)throw Error("offline");return {data:{...payload,id:"new"}};}}}});
    const {RecipientModal}=h.load("components/dashboard/RecipientModal.tsx");
    const props={direction:"irt",locale,onClose(){closed++;},onCreated(){created++;}};
    const render=()=>h.render(RecipientModal,props),change=(id,value)=>elements(render(),e=>e.props.id===`recipient-${id}`)[0].props.onChange({target:{value}});
    const previous=global.requestAnimationFrame;global.requestAnimationFrame=()=>1;
    try {
      change("name","Alex");change("bank_name","Saman Bank");change("bank_city","Tehran");change("shaba","۱۲۳۴۵۶۷۸۹۰۱۲۳۴۵۶۷۸۹۰۱۲۳۴");
      let html=markup(render());assert.match(html,/<dialog[^>]*aria-labelledby="recipient-title"/);assert.match(html,/maxLength="120"/);assert.match(html,/pattern="\[0-9\]\{24\}"/);
      elements(render(),e=>e.type==="form")[0].props.onSubmit({preventDefault(){}});await tick();
      change("address","Street");change("city","Shiraz");change("state","Fars");change("country","Iran");change("phone","09123456789");
      elements(render(),e=>e.type==="form")[0].props.onSubmit({preventDefault(){}});await tick();
      assert.equal(closed,0);assert.equal(elements(render(),e=>e.props.role==="alert").length,1);
      fail=false;elements(render(),e=>e.type==="form")[0].props.onSubmit({preventDefault(){}});await tick();
      assert.equal(created,1);assert.equal(closed,1);assert.equal(calls[1].bank_city,"Tehran");assert.equal(calls[1].irt_city,"Shiraz");assert.equal(calls[1].shaba_number,"IR123456789012345678901234");
    }finally{global.requestAnimationFrame=previous;}
  }
});

test("recipient directory localises both directions and ignores reads after unmount",async()=>{
  for(const locale of ["en","fa"]) {
    let finish;const h=dashboardHarness({locale,mocks:{
      "./DashboardShell":{useDashboard:()=>({profile:{id:"customer"}})},
      "./RecipientModal":{RecipientModal:()=>null},
      "@/app/actions/transaction.actions":{getRecipients:()=>new Promise(resolve=>{finish=resolve;})},
    }});
    const {DashboardRecipients}=h.load("components/dashboard/DashboardRecipients.tsx"),render=()=>h.render(DashboardRecipients);
    render();h.effects();finish({data:[{id:"one",direction:"irt",full_name:"<script>bad</script>",bank_name:"Saman",bank_city:"Tehran",shaba_number:"IR1234567890"}]});await tick();
    elements(render(),e=>e.type==="button" && e.props["aria-pressed"]===false)[0].props.onClick();
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

test("bright surface tokens, pause control and reduced-motion rules protect readability and motion preferences",()=>{
  const css=fs.readFileSync("styles/dashboard/DashboardShell.module.css","utf8");
  assert.match(css,/--color-text-primary:#282337/);assert.match(css,/color-scheme:light/);assert.match(css,/data-motion="off"/);assert.match(css,/prefers-reduced-motion/);
  for(const file of ["TransferJourney","RecipientModal","DashboardRecipients","DashboardRequestHub"])assert.match(fs.readFileSync(`styles/dashboard/${file}.module.css`,"utf8"),/prefers-reduced-motion/);
  const {DashboardHeader}=dashboardHarness().load("components/dashboard/DashboardHeader.tsx");
  const html=markup(React.createElement(DashboardHeader,{activeTab:"overview",profile:null,privateAmounts:false,onTogglePrivacy(){},motion:false,onToggleMotion(){}}));
  assert.match(html,/Play animations/);
});
