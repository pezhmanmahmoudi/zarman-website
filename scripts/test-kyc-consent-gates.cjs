/* eslint-disable @typescript-eslint/no-require-imports -- Offline route security regression tests. */
const {test}=require("node:test"), assert=require("node:assert/strict");
const {dashboardHarness}=require("./helpers/dashboard-harness.cjs");
const OWNER="11111111-1111-4111-8111-111111111111";
const profile={id:OWNER,first_name:"Alex",last_name:"Morgan",dob:"1990-01-01",country:"Australia",document_type:"passport",passport_number:"N100",expiry_date:"2090-01-01",license_number:null,card_number:null,state_of_issue:null};
const details={...profile,profile_document_type:"passport",consent_notice:true,consent_dvs:true,consent_version:"customer-details-2026-10-07"};
const submission={id:"submission",details,created_at:"2026-10-07T01:00:00Z"};

function routeHarness(kind,{record=submission,readError=null,subject=profile,role="admin"}={}){
  const calls=[];
  const db={from(table){const q={select(){return q;},eq(){return q;},order(){return q;},limit(){return q;},maybeSingle(){return q;},update(value){calls.push(["update",table,value]);return q;},insert(value){calls.push(["insert",table,value]);return q;},then(resolve,reject){return Promise.resolve({data:table==="profiles"?subject:record,error:table==="customer_kyc_submissions"?readError:null}).then(resolve,reject);}};return q;}};
  const h=dashboardHarness({mocks:{
    "next/server":{NextResponse:{json:(body,{status})=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json"}})}},
    "@supabase/supabase-js":{createClient:()=>db},
    "@/lib/supabase-server":{createSupabaseServerActionClient:async()=>({auth:{getUser:async()=>({data:{user:{id:"admin",email:"admin@example.test",app_metadata:{role}}},error:null})}})},
    "@/lib/compliance/manual":{
      runManualDvsCheck:async()=>{calls.push(["provider"]);return {outcome:"VERIFIED",checkType:"Passport",resultCode:"Y",referenceId:"ref",rawResponse:{}};},
      runManualAmlCheck:async()=>{calls.push(["provider"]);return {outcome:"CLEAR",matchCount:0,possibleMatchCount:0,listsScreened:[],referenceId:"ref",rawResponse:{}};},
    },
    "@/lib/compliance/pdf":{generateDvsPdf:async()=>{calls.push(["pdf"]);return Buffer.from("%PDF-test");},generateAmlPdf:async()=>{calls.push(["pdf"]);return Buffer.from("%PDF-test");}},
  }});
  const route=h.load(`app/api/admin/compliance/${kind}/route.ts`);
  const request=()=>new Request("http://localhost/test",{method:"POST",body:JSON.stringify({userId:OWNER,consent_granted:true})});
  return {calls,run:()=>route.POST(request())};
}
for(const kind of ["dvs","aml"]){
  test(`${kind}: absent, declined, malformed, stale or unreadable consent never sends a provider request`,async()=>{
    for(const options of [
      {record:null},
      {record:{...submission,details:{...details,consent_dvs:false}}},
      {record:{...submission,details:{...details,consent_dvs:"true"}}},
      {record:{...submission,details:{...details,consent_notice:false}}},
      {record:{...submission,details:{...details,consent_version:""}}},
      {record:{...submission,created_at:"invalid"}},
      {subject:{...profile,first_name:"Different"}},
      {readError:{message:"database unavailable"}},
    ]){
      const h=routeHarness(kind,options);const response=await h.run();
      assert.equal(response.status,options.readError?503:403);assert.equal(h.calls.length,0);
    }
  });
  test(`${kind}: recorded current customer consent permits the check and is linked in the audit`,async()=>{
    const h=routeHarness(kind);const response=await h.run();assert.equal(response.status,200);
    assert.equal(h.calls.filter(c=>c[0]==="provider").length,1);
    const audit=h.calls.find(c=>c[0]==="insert"&&c[1]==="audit_logs")[2][0];
    assert.equal(audit.new_value.consentSubmissionId,"submission");assert.equal(audit.new_value.consentVersion,details.consent_version);
  });
  test(`${kind}: ordinary users cannot trigger provider checks`,async()=>{
    const h=routeHarness(kind,{role:"customer"});assert.equal((await h.run()).status,403);assert.equal(h.calls.length,0);
  });
}
test("DVS consent cannot be reused after changing the passport or document type",async()=>{
  for(const subject of [{...profile,passport_number:"CHANGED"},{...profile,document_type:"driver_license"}]){
    const h=routeHarness("dvs",{subject});assert.equal((await h.run()).status,403);assert.equal(h.calls.length,0);
  }
});
