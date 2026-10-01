// Isolated in-memory PostgreSQL only; no project database or credentials.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

test("payment account vault: atomic save, ownership, retries, funding gate and role restrictions", async () => {
  const db = new PGlite();
  const owner="11111111-1111-4111-8111-111111111111", other="22222222-2222-4222-8222-222222222222";
  const quote="33333333-3333-4333-8333-333333333333", quote2="44444444-4444-4444-8444-444444444444";
  const command="55555555-5555-4555-8555-555555555555", command2="66666666-6666-4666-8666-666666666666";
  const encrypted="v1."+"synthetic-ciphertext-not-a-real-password".repeat(2);
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth;
      CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE TABLE exchange_request_quotes(id uuid PRIMARY KEY,user_id uuid,snapshot jsonb);
      CREATE TABLE exchange_requests(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,quote_id uuid UNIQUE REFERENCES exchange_request_quotes(id),idempotency_key uuid,funding_status text DEFAULT 'unpaid',UNIQUE(user_id,idempotency_key));
      CREATE FUNCTION submit_exchange_request(p_actor_id uuid,p_quote_id uuid,p_idempotency_key uuid)
      RETURNS jsonb LANGUAGE plpgsql AS $$
      DECLARE r exchange_requests%ROWTYPE;
      BEGIN
        SELECT * INTO r FROM exchange_requests WHERE user_id=p_actor_id AND idempotency_key=p_idempotency_key;
        IF FOUND THEN
          IF r.quote_id<>p_quote_id THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
          RETURN to_jsonb(r);
        END IF;
        INSERT INTO exchange_requests(user_id,quote_id,idempotency_key) VALUES(p_actor_id,p_quote_id,p_idempotency_key) RETURNING * INTO r;
        RETURN to_jsonb(r);
      END; $$;
    `);
    await db.exec(readFileSync(new URL("../supabase/migrations/20260930_38_payment_account_access.APPLY_MANUALLY.sql",import.meta.url),"utf8"));
    await db.query("INSERT INTO auth.users VALUES($1),($2)",[owner,other]);
    await db.query("INSERT INTO exchange_request_quotes VALUES($1,$3,$4),($2,$3,$4)",[quote,quote2,owner,{ recipient_id:null,institution_name:"Example Company" }]);
    const submit=(user=owner,q=quote,c=command,secret=encrypted)=>db.query("SELECT submit_exchange_request_with_payment_access($1,$2,$3,$4) AS request",[user,q,c,secret]);
    await assert.rejects(()=>submit(other),/Institution quote required/i);
    await assert.rejects(()=>submit(owner,quote,command,"plain"),/Invalid payment account/i);
    // The inner request insert must roll back if the vault insert fails.
    await db.exec("ALTER TABLE exchange_request_payment_access ADD CONSTRAINT simulate_failure CHECK(false)");
    await assert.rejects(()=>submit(),/simulate_failure/i);
    assert.equal((await db.query("SELECT count(*)::int AS n FROM exchange_requests")).rows[0].n,0);
    await db.exec("ALTER TABLE exchange_request_payment_access DROP CONSTRAINT simulate_failure");
    const id=(await submit()).rows[0].request.id;
    assert.equal((await submit(owner,quote,command,encrypted+"changed")).rows[0].request.id,id);
    assert.equal((await db.query("SELECT encrypted_account FROM exchange_request_payment_access")).rows[0].encrypted_account,encrypted);
    await assert.rejects(()=>submit(owner,quote2,command),/IDEMPOTENCY_CONFLICT/i);
    const read=()=>db.query("SELECT * FROM read_funded_request_payment_access($1)",[id]);
    for(const status of ["unpaid","partial","refund_pending","refunded"]) {
      await db.query("UPDATE exchange_requests SET funding_status=$1 WHERE id=$2",[status,id]);
      assert.equal((await read()).rows.length,0);
    }
    await db.query("UPDATE exchange_requests SET funding_status='confirmed' WHERE id=$1",[id]);
    assert.equal((await read()).rows[0].encrypted_account,encrypted);
    for(const role of ["anon","authenticated"]) {
      await db.exec(`SET ROLE ${role}`);
      await assert.rejects(()=>read(),/permission denied/i);
      await assert.rejects(()=>submit(),/permission denied/i);
      await assert.rejects(()=>db.query("SELECT * FROM exchange_request_payment_access"),/permission denied/i);
      await db.exec("RESET ROLE");
    }
    // Existing credential-free requests cannot receive credentials on a retry.
    await db.query("SELECT submit_exchange_request($1,$2,$3)",[owner,quote2,command2]);
    await submit(owner,quote2,command2);
    assert.equal((await db.query("SELECT count(*)::int AS n FROM exchange_request_payment_access")).rows[0].n,1);
    await db.query("DELETE FROM exchange_requests WHERE id=$1",[id]);
    assert.equal((await db.query("SELECT count(*)::int AS n FROM exchange_request_payment_access")).rows[0].n,0);
  } finally { await db.close(); }
});
