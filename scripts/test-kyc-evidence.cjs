/* eslint-disable @typescript-eslint/no-require-imports -- Offline KYC security and policy regression tests. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const React = require("react");
const { dashboardHarness } = require("./helpers/dashboard-harness.cjs");
const policy = dashboardHarness().load("lib/kyc/evidence.ts");
const OWNER="11111111-1111-4111-8111-111111111111";
const FRONT="22222222-2222-4222-8222-222222222222";
const BACK="33333333-3333-4333-8333-333333333333";
const ADDRESS="44444444-4444-4444-8444-444444444444";
const draft=()=>({front:{id:FRONT,name:"front.jpg"},back:{id:BACK,name:"back.jpg"},address:{id:ADDRESS,name:"address.pdf"},addressType:"utility_bill",addressDate:"2026-09-01",documentNumber:"ID100",documentIssuer:"NSW"});
test("each supported document has the required sides and maps to the existing admin reporting vocabulary",()=>{
  const types=dashboardHarness().load("lib/compliance/austrac-id-types.ts").AUSTRAC_ID_TYPES;
  for(const doc of policy.KYC_ID_DOCUMENTS){
    assert.ok(types.includes(doc.reportType));
    const roles=policy.requiredKycUploads(doc.value);assert.ok(roles.includes("front"));
    assert.equal(roles.includes("back"),doc.back);assert.equal(roles.includes("address"),doc.address);
    assert.deepEqual(policy.validateKycEvidence(doc.value,draft(),new Date("2026-09-29")),{});
    const missing=policy.validateKycEvidence(doc.value,undefined,new Date("2026-09-29"));
    for(const role of roles)assert.ok(missing[`evidence-${role}`]);
  }
  assert.deepEqual(policy.requiredKycUploads("passport"),["front"]);
  assert.deepEqual(policy.requiredKycUploads("driver_license"),["front","back"]);
  for(const type of ["none","Credit/debit card","Telephone/fax number","Membership ID"]){assert.ok(policy.validateKycEvidence(type,draft()).docType);}
});
test("proof of address type and actual issue date are mandatory, future and stale dates fail",()=>{
  const now=new Date("2026-09-29T12:00:00Z");
  for(const date of ["","2026-02-30","2026-09-30","2026-01-01"]){assert.ok(policy.validateKycEvidence("photo_id",{...draft(),addressDate:date},now).addressDate);}
  assert.ok(policy.validateKycEvidence("photo_id",{...draft(),addressType:"passport"},now).addressType);
  assert.equal(policy.validateKycEvidence("photo_id",{...draft(),addressType:"government_notice",addressDate:"2026-01-01"},now).addressDate,undefined);
  assert.equal(policy.kycToday(new Date("2026-09-29T15:00:00Z")),"2026-09-30");
  assert.equal(policy.validateKycEvidence("photo_id",{...draft(),addressDate:"2026-09-30"},new Date("2026-09-29T15:00:00Z")).addressDate,undefined);
});
test("empty, oversized and unsupported uploads are rejected and signatures must match MIME",()=>{
  assert.ok(policy.validateKycFile({size:0,type:"image/jpeg"}));
  assert.ok(policy.validateKycFile({size:4194305,type:"application/pdf"}));
  assert.ok(policy.validateKycFile({size:100,type:"image/svg+xml"}));
  assert.equal(policy.validateKycFile({size:4194304,type:"application/pdf"}),null);
  assert.equal(policy.matchesKycFileSignature(Buffer.from("<html>"),"application/pdf"),false);
  assert.equal(policy.matchesKycFileSignature(Buffer.from("%PDF-1.7"),"application/pdf"),true);
  assert.equal(policy.matchesKycFileSignature(Uint8Array.from([255,216,255]),"image/jpeg"),true);
  assert.equal(policy.matchesKycFileSignature(Uint8Array.from([137,80,78,71,13,10,26,10]),"image/png"),true);
});

function actionHarness({rows,auth=true,role="customer",rpcError=null}={}){
  const calls=[];
  const db={from(table){const q={select(...args){calls.push([table,"select",...args]);return q;},eq(...args){calls.push([table,"eq",...args]);return q;},in(){return q;},order(){return q;},limit(){return q;},maybeSingle(){return q;},single(){return q;},then(resolve,reject){return Promise.resolve({data:table==="customer_kyc_uploads"?rows:[],error:null}).then(resolve,reject);}};return q;},async rpc(name,args){calls.push(["rpc",name,args]);return {data:"submission-id",error:rpcError};}};
  const h=dashboardHarness({mocks:{
    "@supabase/supabase-js":{createClient:()=>db},
    "@/lib/supabase-server":{createSupabaseServerActionClient:async()=>({auth:{getUser:async()=>({data:{user:auth?{id:OWNER,app_metadata:{role}}:null},error:null})}})},
  }});
  return {actions:h.load("app/actions/kyc-evidence.actions.ts"),calls};
}
const passport=()=>({first_name:"Alex",last_name:"Morgan",mobile_number:"0412345678",dob:"1990-01-01",country:"Australia",address:"1 Test Street",city:"Sydney",state:"NSW",postcode:"2000",document_type:"passport",passport_number:"N100",expiry_date:"2090-01-01",consent_notice:true,consent_dvs:true,evidence:{...draft(),back:undefined,address:undefined}});
const frontRow={id:FRONT,user_id:OWNER,role:"front",document_type:"passport",sha256:"unique"};
test("server submission rejects missing evidence, false consent, foreign slots and invalid identifiers before any write",async()=>{
  for(const payload of [{...passport(),evidence:undefined},{...passport(),consent_dvs:false},{...passport(),expiry_date:"2000-01-01"},{...passport(),evidence:{...draft(),front:{id:"https://example.com/document",name:"fake"}}}]){
    const h=actionHarness({rows:[frontRow]});const result=await h.actions.submitCustomerKycEvidence(payload);assert.ok(result.error);assert.equal(h.calls.filter(c=>c[0]==="rpc").length,0);
  }
  for(const rows of [[],[{...frontRow,role:"back"}],[{...frontRow,document_type:"photo_id"}]]){
    const h=actionHarness({rows});assert.ok((await h.actions.submitCustomerKycEvidence(passport())).error);assert.equal(h.calls.filter(c=>c[0]==="rpc").length,0);
  }
});
test("server checks authenticated ownership and commits consent/evidence through the atomic pending-only RPC",async()=>{
  const h=actionHarness({rows:[frontRow]});const result=await h.actions.submitCustomerKycEvidence(passport());assert.equal(result.success,true);
  assert.ok(h.calls.some(c=>c[0]==="customer_kyc_uploads"&&c[1]==="eq"&&c[2]==="user_id"&&c[3]===OWNER));
  const rpc=h.calls.find(c=>c[0]==="rpc");assert.equal(rpc[1],"submit_customer_kyc_evidence");assert.equal(rpc[2].p_user_id,OWNER);
  assert.equal(rpc[2].p_details.profile_document_type,"passport");assert.equal(rpc[2].p_details.consent_version,"customer-evidence-2026-09-29");
  assert.equal(rpc[2].p_details.compliance_dvs_status,undefined);
  const fail=actionHarness({rows:[frontRow],rpcError:{message:"rollback"}});assert.ok((await fail.actions.submitCustomerKycEvidence(passport())).error);
});
test("identical front and back files cannot satisfy a licence submission",async()=>{
  const rows=[{...frontRow,document_type:"driver_license"},{...frontRow,id:BACK,role:"back",document_type:"driver_license"}];
  const h=actionHarness({rows});const result=await h.actions.submitCustomerKycEvidence({...passport(),document_type:"driver_license",license_number:"123",card_number:"456",state_of_issue:"NSW",evidence:draft()});assert.match(result.error,/different file/);assert.equal(h.calls.filter(c=>c[0]==="rpc").length,0);
});
test("unsigned users cannot submit and ordinary customers cannot read admin evidence or signed links",async()=>{
  const h=actionHarness({auth:false});await assert.rejects(()=>h.actions.submitCustomerKycEvidence(passport()),/Sign in/);
  const customer=actionHarness();await assert.rejects(()=>customer.actions.getCustomerKycEvidenceForAdmin(OWNER),/Administrator/);await assert.rejects(()=>customer.actions.getCustomerKycFileForAdmin(FRONT),/Administrator/);assert.equal(customer.calls.length,0);
});
test("migration is private, atomic, audited and cannot promote an account to approved",()=>{
  const sql=fs.readFileSync("supabase/migrations/20260929_37_customer_kyc_evidence.APPLY_MANUALLY.sql","utf8");
  assert.match(sql,/ENABLE ROW LEVEL SECURITY/);assert.match(sql,/AS RESTRICTIVE/);assert.match(sql,/REVOKE ALL ON FUNCTION[^;]*FROM PUBLIC,anon,authenticated/);
  assert.match(sql,/FOR UPDATE/);assert.match(sql,/v_status='approved'/);assert.match(sql,/kyc_status='pending'/);assert.doesNotMatch(sql,/SET[^;]*kyc_status='approved'/);
  assert.match(sql,/INSERT INTO public.audit_logs/);assert.match(sql,/submission_id IS NULL/);
  const source=fs.readFileSync("app/actions/kyc.actions.ts","utf8");const draftAction=source.slice(source.indexOf("export async function savePersonalData"),source.indexOf("export async function updatePersonalIdentityData"));assert.doesNotMatch(draftAction,/kyc_status: "pending"/);
});

function elements(tree,predicate){const out=[];function walk(n){if(!React.isValidElement(n))return;if(predicate(n))out.push(n);React.Children.forEach(n.props.children,walk);}walk(tree);return out;}
test("upload UI preserves previous successful files when replacement fails and stops its animation",async()=>{
  let busy=false,changed=false;
  const h=dashboardHarness({mocks:{
    "@/components/ui/SelectBox/SelectBox":{SelectBox:()=>null},
    "@/components/ui/DatePicker/CustomDatePicker":{__esModule:true,default:()=>null},
    "@/components/dashboard/DashboardLottieScene":{DashboardLottieScene:()=>null},
    "@/app/actions/kyc-evidence.actions":{uploadCustomerKycEvidence:async()=>{throw Error("Upload failed");}},
  }});
  const {KycDocumentEvidence}=h.load("components/dashboard/KycDocumentEvidence.tsx");
  const props={documentType:"passport",evidence:draft(),errors:{},disabled:false,motionEnabled:true,onDocumentTypeChange(){},onChange(){changed=true;},onBusyChange(value){busy=value;}};
  const render=()=>h.render(KycDocumentEvidence,props);
  assert.equal(elements(render(),n=>n.props.name==="document-upload-success").length,1);
  const file=elements(render(),n=>n.type==="input"&&n.props.type==="file")[0];
  file.props.onChange({target:{files:[{name:"new.jpg",type:"image/jpeg",size:50}],value:"new.jpg"}});
  assert.equal(busy,true);assert.equal(elements(render(),n=>n.props.name==="document-upload")[0].props.motionEnabled,true);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(busy,false);assert.equal(changed,false);assert.equal(elements(render(),n=>n.props.name==="document-upload").length,0);
  assert.equal(elements(render(),n=>n.props.name==="document-upload-success").length,0);
  assert.equal(elements(render(),n=>n.props.name==="document-upload-idle").length,1);
  assert.ok(elements(render(),n=>n.props.role==="alert").length);
  assert.equal(elements(render(),n=>n.props.name==="warning").length,1);
});

test("each upload slot shows idle, uploading and success independently and respects paused motion",async()=>{
  let resolveUpload;
  const h=dashboardHarness({mocks:{
    "@/components/ui/SelectBox/SelectBox":{SelectBox:()=>null},
    "@/components/ui/DatePicker/CustomDatePicker":{__esModule:true,default:()=>null},
    "@/components/dashboard/DashboardLottieScene":{DashboardLottieScene:()=>null},
    "@/app/actions/kyc-evidence.actions":{uploadCustomerKycEvidence:()=>new Promise(resolve=>{resolveUpload=resolve;})},
  }});
  const {KycDocumentEvidence}=h.load("components/dashboard/KycDocumentEvidence.tsx");
  const props={documentType:"driver_license",evidence:policy.emptyKycEvidence(),errors:{},disabled:false,motionEnabled:true,onDocumentTypeChange(){},onChange(value){props.evidence=value;},onBusyChange(){}};
  const render=()=>h.render(KycDocumentEvidence,props);
  const scenes=()=>elements(render(),n=>String(n.props.name||"").startsWith("document-upload"));
  assert.equal(elements(render(),n=>n.props.name==="announcement").length,1);
  assert.equal(elements(render(),n=>n.props.name==="warning").length,0);
  assert.deepEqual(scenes().map(n=>n.props.name),["document-upload-idle","document-upload-idle"]);
  assert.deepEqual(scenes().map(n=>n.props.size),[80,80]);
  elements(render(),n=>n.type==="input"&&n.props.type==="file")[0].props.onChange({target:{files:[{name:"front.jpg",type:"image/jpeg",size:50}],value:"front.jpg"}});
  assert.deepEqual(scenes().map(n=>n.props.name),["document-upload","document-upload-idle"]);
  assert.deepEqual(scenes().map(n=>n.props.size),[80,80]);
  resolveUpload({id:FRONT,name:"front.jpg"});await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(scenes().map(n=>n.props.name),["document-upload-success","document-upload-idle"]);
  assert.deepEqual(scenes().map(n=>n.props.size),[96,80]);
  props.motionEnabled=false;assert.ok(scenes().every(n=>n.props.motionEnabled===false));
  assert.equal(elements(render(),n=>n.props.name==="announcement")[0].props.motionEnabled,false);
});

test("document selections replay their illustrations without clearing files on same-type reselection",()=>{
  const h=dashboardHarness({mocks:{
    "@/components/ui/SelectBox/SelectBox":{SelectBox:()=>null},
    "@/components/ui/DatePicker/CustomDatePicker":{__esModule:true,default:()=>null},
    "@/components/dashboard/DashboardLottieScene":{DashboardLottieScene:()=>null},
    "@/app/actions/kyc-evidence.actions":{uploadCustomerKycEvidence:async()=>{}},
  }});
  const {KycDocumentEvidence}=h.load("components/dashboard/KycDocumentEvidence.tsx");
  const props={documentType:"driver_license",evidence:policy.emptyKycEvidence(),errors:{},disabled:false,motionEnabled:true,
    onDocumentTypeChange(value){props.documentType=value;props.evidence=policy.emptyKycEvidence();},
    onChange(value){props.evidence=value;},onBusyChange(){}};
  const render=()=>h.render(KycDocumentEvidence,props);
  const scenes=()=>elements(render(),n=>String(n.props.name||"").startsWith("document-upload"));
  const select=(placeholder,value)=>elements(render(),n=>n.props.placeholder===placeholder)[0].props.onChange(value);
  let previous=scenes().map(n=>n.key);
  select("Choose an identity document","photo_id");
  assert.notEqual(scenes()[0].key,previous[0]);
  previous=scenes().map(n=>n.key);
  props.evidence.documentNumber="ID123";
  assert.deepEqual(scenes().map(n=>n.key),previous,"typing must not restart animations");
  props.evidence.front={id:FRONT,name:"front.jpg"};
  previous=scenes().map(n=>n.key);
  select("Choose an identity document","photo_id");
  assert.ok(scenes().every((n,i)=>n.key!==previous[i]));
  assert.equal(props.evidence.front.id,FRONT);
  previous=scenes().map(n=>n.key);
  select("Choose proof of address","utility_bill");
  assert.deepEqual(scenes().slice(0,2).map(n=>n.key),previous.slice(0,2));
  assert.notEqual(scenes()[2].key,previous[2]);
  props.evidence.address={id:ADDRESS,name:"bill.pdf"};
  props.evidence.addressDate="2026-09-01";
  previous=scenes().map(n=>n.key);
  select("Choose proof of address","utility_bill");
  assert.notEqual(scenes()[2].key,previous[2]);
  assert.equal(props.evidence.address.id,ADDRESS);
  assert.equal(props.evidence.addressDate,"2026-09-01");
  select("Choose proof of address","bank_statement");
  assert.equal(props.evidence.address,undefined);
  assert.equal(scenes()[2].props.name,"document-upload-idle");
  h.cleanup();
});
