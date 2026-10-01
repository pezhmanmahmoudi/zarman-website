// Isolated in-memory PostgreSQL. Never connects to a Supabase project.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

test("KYC migration: atomic pending submission, consent audit, ownership, RLS and rollback", async () => {
  const db = new PGlite();
  const owner="11111111-1111-4111-8111-111111111111", other="55555555-5555-4555-8555-555555555555", upload="22222222-2222-4222-8222-222222222222";
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth; CREATE SCHEMA storage;
      CREATE TABLE auth.users(id uuid PRIMARY KEY,email text);
      CREATE TABLE public.profiles(id uuid PRIMARY KEY,kyc_status text,first_name text,last_name text,mobile_number text,dob date,country text,address text,city text,state text,postcode text,document_type text,license_number text,card_number text,state_of_issue text,passport_number text,expiry_date date,compliance_dvs_status text DEFAULT 'not_started',compliance_aml_status text DEFAULT 'not_started',compliance_customer_flagged boolean DEFAULT false);
      CREATE TABLE public.audit_logs(actor_id uuid,actor_email text NOT NULL,action text,target_type text,target_id uuid,new_value jsonb);
      CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(),bucket_id text,name text);
      ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
      GRANT USAGE ON SCHEMA storage TO anon,authenticated;
      GRANT ALL ON storage.objects TO anon,authenticated;
      CREATE POLICY broad_legacy_policy ON storage.objects FOR ALL TO anon,authenticated USING(true) WITH CHECK(true);
    `);
    const migration=readFileSync(new URL("../supabase/migrations/20260929_37_customer_kyc_evidence.APPLY_MANUALLY.sql",import.meta.url),"utf8");
    await db.exec(migration);await db.exec(migration); // Idempotent rollout.
    await db.query("INSERT INTO auth.users VALUES($1,'synthetic@example.test'),($2,'other@example.test')",[owner,other]);
    await db.query("INSERT INTO profiles(id,kyc_status,compliance_dvs_status,compliance_aml_status,compliance_customer_flagged) VALUES($1,'rejected','completed','failed',true),($2,'pending','not_started','not_started',false)",[owner,other]);
    await db.query("INSERT INTO customer_kyc_uploads(id,user_id,document_type,role,storage_path,original_name,mime_type,byte_size,sha256) VALUES($1,$2,'passport','front','synthetic/passport.pdf','passport.pdf','application/pdf',100,'digest')",[upload,owner]);
    const details={first_name:"Alex",last_name:"Morgan",mobile_number:"0412345678",dob:"1990-01-01",country:"Australia",address:"1 Test Street",city:"Sydney",state:"NSW",postcode:"2000",document_type:"passport",profile_document_type:"passport",passport_number:"N100",expiry_date:"2030-01-01",consent_notice:true,consent_dvs:true,consent_version:"customer-evidence-2026-09-29"};
    const submit=(user,body=details,ids=[upload])=>db.query("SELECT submit_customer_kyc_evidence($1,$2::jsonb,$3::uuid[]) AS id",[user,JSON.stringify(body),ids]);
    await assert.rejects(()=>submit(owner,{...details,consent_dvs:false}),/consent/i);
    await assert.rejects(()=>submit(other),/ownership/i);
    await assert.rejects(()=>submit(owner,details,[]),/evidence/i);
    assert.equal((await db.query("SELECT count(*)::int AS n FROM customer_kyc_submissions")).rows[0].n,0);
    // An audit failure must roll back files, profile status and submission together.
    await db.exec("ALTER TABLE audit_logs ADD CONSTRAINT simulated_audit_outage CHECK(false)");
    await assert.rejects(()=>submit(owner),/simulated_audit_outage/i);
    assert.equal((await db.query("SELECT kyc_status FROM profiles WHERE id=$1",[owner])).rows[0].kyc_status,"rejected");
    assert.equal((await db.query("SELECT submission_id FROM customer_kyc_uploads")).rows[0].submission_id,null);
    await db.exec("ALTER TABLE audit_logs DROP CONSTRAINT simulated_audit_outage");
    const first=await submit(owner);const retry=await submit(owner);assert.equal(first.rows[0].id,retry.rows[0].id);
    await assert.rejects(()=>submit(owner,{...details,address:"2 Changed Street"}),/changed application/i);
    assert.equal((await db.query("SELECT count(*)::int AS n FROM customer_kyc_submissions")).rows[0].n,1);
    const profile=(await db.query("SELECT * FROM profiles WHERE id=$1",[owner])).rows[0];
    assert.equal(profile.kyc_status,"pending");assert.equal(profile.compliance_dvs_status,"not_started");assert.equal(profile.compliance_aml_status,"failed");assert.equal(profile.compliance_customer_flagged,true);
    const audit=(await db.query("SELECT * FROM audit_logs")).rows[0];assert.equal(audit.new_value.consent_dvs,true);assert.equal(audit.new_value.consent_version,details.consent_version);
    await db.query("UPDATE profiles SET kyc_status='approved' WHERE id=$1",[owner]);await assert.rejects(()=>submit(owner),/resubmitted/i);
    await db.exec("INSERT INTO storage.objects(bucket_id,name) VALUES('customer-kyc-evidence','private.pdf'),('other-bucket','public.txt')");
    await db.exec("SET ROLE authenticated");
    assert.deepEqual((await db.query("SELECT name FROM storage.objects")).rows,[{name:"public.txt"}]);
    await assert.rejects(()=>db.query("SELECT * FROM customer_kyc_uploads"),/permission denied/i);
    await assert.rejects(()=>submit(owner),/permission denied/i);
    await db.exec("RESET ROLE");
  } finally { await db.close(); }
});
