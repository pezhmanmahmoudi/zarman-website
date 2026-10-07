// Isolated in-memory PostgreSQL; never connects to a Supabase project.
import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {PGlite} from "@electric-sql/pglite";

test("text identity rollout: no primary images, atomic consent, retry/correction and retained supporting files",async()=>{
  const db=new PGlite();
  const owner="11111111-1111-4111-8111-111111111111", other="55555555-5555-4555-8555-555555555555";
  const front="22222222-2222-4222-8222-222222222222",back="33333333-3333-4333-8333-333333333333",address="44444444-4444-4444-8444-444444444444",funds="66666666-6666-4666-8666-666666666666";
  try{
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth; CREATE SCHEMA storage;
      CREATE TABLE auth.users(id uuid PRIMARY KEY,email text);
      CREATE TABLE public.profiles(id uuid PRIMARY KEY,kyc_status text,first_name text,last_name text,mobile_number text,dob date,country text,address text,city text,state text,postcode text,document_type text,license_number text,card_number text,state_of_issue text,passport_number text,expiry_date date,compliance_dvs_status text DEFAULT 'not_started',compliance_aml_status text DEFAULT 'not_started',compliance_customer_flagged boolean DEFAULT false);
      CREATE TABLE public.audit_logs(actor_id uuid,actor_email text NOT NULL,action text,target_type text,target_id uuid,new_value jsonb);
      CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(),bucket_id text,name text);
      ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
      GRANT USAGE ON SCHEMA storage TO anon,authenticated; GRANT ALL ON storage.objects TO anon,authenticated;
      CREATE POLICY legacy_policy ON storage.objects FOR ALL TO anon,authenticated USING(true) WITH CHECK(true);
    `);
    await db.exec(readFileSync(new URL("../supabase/migrations/20260929_37_customer_kyc_evidence.APPLY_MANUALLY.sql",import.meta.url),"utf8"));
    await db.query("INSERT INTO auth.users VALUES($1,'synthetic@example.test'),($2,'other@example.test')",[owner,other]);
    await db.query("INSERT INTO profiles(id,kyc_status,compliance_dvs_status,compliance_customer_flagged) VALUES($1,'rejected','completed',true),($2,'pending','not_started',false)",[owner,other]);
    const upload=(id,role,type="photo_id",user=owner)=>db.query("INSERT INTO customer_kyc_uploads(id,user_id,document_type,role,address_type,storage_path,original_name,mime_type,byte_size,sha256) VALUES($1,$2,$3,$4,$5,$6,'synthetic.pdf','application/pdf',100,$6)",[id,user,type,role,role==="address"?"utility_bill":null,`synthetic/${id}.pdf`]);
    // Historical primary images must remain intact during the non-destructive rollout.
    await upload(front,"front","passport");
    const migration=readFileSync(new URL("../supabase/migrations/20261007_50_kyc_text_identity_details.APPLY_MANUALLY.sql",import.meta.url),"utf8");
    await db.exec(migration);await db.exec(migration);
    for(const type of ["passport","driver_license","medicare"])for(const role of ["front","back"])await assert.rejects(()=>upload(back,role,type),/text details/i);
    assert.equal((await db.query("SELECT count(*)::int AS n FROM customer_kyc_uploads")).rows[0].n,1);
    const details={first_name:"Alex",last_name:"Morgan",mobile_number:"0412345678",dob:"1990-01-01",country:"Australia",address:"1 Test Street",city:"Sydney",state:"NSW",postcode:"2000",document_type:"passport",profile_document_type:"passport",passport_number:"N100",expiry_date:"2090-01-01",consent_notice:true,consent_dvs:true,consent_version:"customer-details-2026-10-07",consent_statement:"Recorded exact model statement"};
    const submit=(body=details,ids=[],user=owner)=>db.query("SELECT submit_customer_kyc_evidence($1,$2::jsonb,$3::uuid[]) AS id",[user,JSON.stringify(body),ids]);
    for(const value of [false,"true",null])await assert.rejects(()=>submit({...details,consent_dvs:value}),/consent/i);
    await assert.rejects(()=>submit(details,[front]),/ownership, role or state/i);
    await db.exec("ALTER TABLE audit_logs ADD CONSTRAINT simulated_audit_outage CHECK(false)");
    await assert.rejects(()=>submit(),/simulated_audit_outage/i);
    assert.equal((await db.query("SELECT count(*)::int AS n FROM customer_kyc_submissions")).rows[0].n,0);
    assert.equal((await db.query("SELECT kyc_status FROM profiles WHERE id=$1",[owner])).rows[0].kyc_status,"rejected");
    await db.exec("ALTER TABLE audit_logs DROP CONSTRAINT simulated_audit_outage");
    const first=await submit(),retry=await submit();assert.equal(first.rows[0].id,retry.rows[0].id);
    const state=(await db.query("SELECT * FROM profiles WHERE id=$1",[owner])).rows[0];assert.equal(state.kyc_status,"pending");assert.equal(state.compliance_dvs_status,"not_started");assert.equal(state.compliance_customer_flagged,true);
    await db.query("UPDATE profiles SET kyc_status='rejected' WHERE id=$1",[owner]);
    const corrected=await submit({...details,passport_number:"N200"});assert.notEqual(corrected.rows[0].id,first.rows[0].id);
    const medicare={...details,document_type:"medicare",profile_document_type:"none",passport_number:null,expiry_date:null,document_number:"1234567890",medicare_irn:"1",medicare_colour:"green",medicare_expiry:"2090-01"};
    const med=await submit(medicare);assert.equal((await db.query("SELECT details->>'medicare_expiry' AS expiry,cardinality(upload_ids) AS n FROM customer_kyc_submissions WHERE id=$1",[med.rows[0].id])).rows[0].expiry,"2090-01");
    await submit({...details,document_type:"driver_license",profile_document_type:"driver_license",passport_number:null,license_number:"12345",card_number:"6789",state_of_issue:"NSW"});
    // All non-DVS alternatives still require their original files.
    await upload(back,"front");await upload(address,"back");await upload(funds,"address");
    const alternative={...details,document_type:"photo_id",profile_document_type:"none",passport_number:null,document_number:"PHOTO100",document_issuer:"NSW",address_type:"utility_bill"};
    await assert.rejects(()=>submit(alternative,[]),/evidence/i);
    await assert.rejects(()=>submit(alternative,[back,address]),/evidence/i);
    await assert.rejects(()=>submit(alternative,[back,address,funds],other),/ownership/i);
    await submit(alternative,[back,address,funds]);
    await assert.rejects(()=>submit({...alternative,document_number:"changed"},[back,address,funds]),/state/i);
    const audit=(await db.query("SELECT new_value FROM audit_logs ORDER BY ctid LIMIT 1")).rows[0].new_value;
    assert.equal(audit.consent_dvs,true);assert.equal(audit.consent_version,details.consent_version);assert.equal(audit.consent_statement,details.consent_statement);assert.ok(audit.submitted_at);
    // An optional source-of-funds attachment may accompany text details.
    const support="77777777-7777-4777-8777-777777777777";await upload(support,"source_of_funds","passport");await submit(details,[support]);
    // The database also rejects bypasses of the Iran residence requirement.
    const iranFront="88888888-8888-4888-8888-888888888888";await upload(iranFront,"front","foreign_passport");
    const iran={...details,country:"Iran",document_type:"foreign_passport",profile_document_type:"none",passport_number:null,document_number:"IR100",document_issuer:"Iran"};
    for(const country of ["Iran"," IR ","irn","ایران","Iran (Islamic Republic of)"]){
      for(const document_type of ["passport","driver_license","medicare","national_id","certified_copy"]){
        await assert.rejects(()=>submit({...iran,country,document_type},[]),/Iranian passport/i);
      }
    }
    for(const document_issuer of [null,"Australia",""])await assert.rejects(()=>submit({...iran,document_issuer},[iranFront]),/Iranian passport/i);
    for(const document_number of [null,"",123,"N".repeat(201)])await assert.rejects(()=>submit({...iran,document_number},[iranFront]),/passport number/i);
    for(const expiry_date of [null,"2000-01-01"])await assert.rejects(()=>submit({...iran,expiry_date},[iranFront]),/current Iranian passport/i);
    await assert.rejects(()=>submit(iran,[]),/evidence/i);
    await assert.rejects(()=>submit(iran,[front]),/ownership, role or state/i);
    await assert.rejects(()=>submit(iran,[iranFront],other),/ownership, role or state/i);
    const iranSubmission=await submit(iran,[iranFront]);
    const recorded=(await db.query("SELECT details,upload_ids FROM customer_kyc_submissions WHERE id=$1",[iranSubmission.rows[0].id])).rows[0];
    assert.equal(recorded.details.document_issuer,"Iran");assert.deepEqual(recorded.upload_ids,[iranFront]);
    assert.equal((await db.query("SELECT country,document_type FROM profiles WHERE id=$1",[owner])).rows[0].country,"Iran");
    await db.query("UPDATE profiles SET kyc_status='approved' WHERE id=$1",[owner]);await assert.rejects(()=>submit(),/resubmitted/i);
    await db.exec("SET ROLE authenticated");await assert.rejects(()=>submit(),/permission denied/i);await assert.rejects(()=>db.query("SELECT * FROM customer_kyc_submissions"),/permission denied/i);await db.exec("RESET ROLE");
  }finally{await db.close();}
});
