// Authorization tests for migration 72 against an isolated PGlite replica of production.
// Identities are exercised exactly as PostgREST does: SET ROLE + request.jwt.claims.
// All records are synthetic; nothing here talks to a real database.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, describe, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const BASELINE = read("scripts/fixtures/security-baseline.sql");
const MIGRATION = read("supabase/migrations/20261113_72_security_rls_hardening.APPLY_MANUALLY.sql");
const ROLLBACK = read("supabase/rollbacks/20261113_72_security_rls_hardening.ROLLBACK.sql");

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const ADMIN = "00000000-0000-4000-8000-0000000000ad";
const TX_A_PENDING = "10000000-0000-4000-8000-00000000000a";
const TX_A_APPROVED = "10000000-0000-4000-8000-0000000000aa";
const TX_B_APPROVED = "10000000-0000-4000-8000-0000000000bb";
const T_A_APPROVED = "20000000-0000-4000-8000-00000000000a";
const T_B_PENDING = "20000000-0000-4000-8000-00000000000b";
const T_B_REJECTED = "20000000-0000-4000-8000-0000000000bb";

const anon = { role: "anon", claims: { role: "anon" } };
const customer = (sub, extra = {}) => ({ role: "authenticated", claims: { sub, role: "authenticated", aal: "aal1", app_metadata: { provider: "email" }, user_metadata: {}, ...extra } });
const customerA = customer(A);
const customerB = customer(B);
// user_metadata is writable by the user through supabase.auth.updateUser(); it must never grant anything.
const forgedAdmin = customer(A, { user_metadata: { role: "admin" } });
const adminJwt = { role: "authenticated", claims: { sub: ADMIN, role: "authenticated", aal: "aal2", app_metadata: { provider: "email", role: "admin" } } };
const service = { role: "service_role", claims: { role: "service_role" } };

const DENIED = /permission denied|row-level security|violates row-level security/;

async function freshDb({ migrate = false, rollback = false } = {}) {
  const db = new PGlite();
  await db.exec(BASELINE);
  await seed(db);
  if (migrate) await db.exec(MIGRATION);
  if (rollback) await db.exec(ROLLBACK);
  return db;
}

async function seed(db) {
  // Auth signups fire handle_new_user, which creates the profiles.
  await db.query(`INSERT INTO auth.users(id,email,raw_app_meta_data,raw_user_meta_data) VALUES
    ($1,'customer-a@example.invalid','{}','{"first_name":"Alice","last_name":"Synthetic"}'),
    ($2,'customer-b@example.invalid','{}','{"first_name":"Bob","last_name":"Testcase"}'),
    ($3,'admin@example.invalid','{"role":"admin"}','{"first_name":"Ada","last_name":"Admin"}')`, [A, B, ADMIN]);
  await db.query(`UPDATE profiles SET kyc_status='approved', dob='1990-01-01', passport_number='SYN-PASSPORT', mobile_number='+61400000000',
    loyalty_discount_toman=0, compliance_customer_flagged=true, compliance_customer_flag_reason='synthetic review', compliance_aml_flag='review_required'
    WHERE id IN ($1,$2)`, [A, B]);
  await db.query(`INSERT INTO transactions(id,user_id,type,amount_aud,equivalent_toman,status,applied_rate) VALUES
    ($1,$4,'buy_aud',100,1000000,'pending',10000),($2,$4,'buy_aud',200,2000000,'approved',10000),($3,$5,'sell_aud',300,3000000,'approved',10000)`,
    [TX_A_PENDING, TX_A_APPROVED, TX_B_APPROVED, A, B]);
  await db.query(`INSERT INTO testimonials(id,user_id,rating,message,status) VALUES
    ($1,$4,5,'Synthetic approved review','approved'),($2,$5,4,'Synthetic pending review','pending'),($3,$5,1,'Synthetic rejected review','rejected')`,
    [T_A_APPROVED, T_B_PENDING, T_B_REJECTED, A, B]);
  await db.query(`INSERT INTO recipients(user_id,full_name) VALUES ($1,'Recipient of A'),($2,'Recipient of B')`, [A, B]);
  await db.query(`INSERT INTO exchange_request_realtime_signals(request_id,user_id) VALUES (gen_random_uuid(),$1),(gen_random_uuid(),$2)`, [A, B]);
  await db.query(`INSERT INTO rates_history(date,buy_aud) VALUES (current_date,10000)`);
  await db.query(`INSERT INTO promo_codes(code) VALUES ('SYNTHETIC10')`);
  await db.query(`INSERT INTO audit_logs(actor_id,action) VALUES ($1,'SYNTHETIC_EVENT')`, [ADMIN]);
  await db.query(`INSERT INTO reports_daily DEFAULT VALUES`);
  await db.query(`INSERT INTO ledger(amount_aud) VALUES (1)`);
}

/** Runs one statement as an API identity, the way PostgREST does, and commits it. */
async function as(db, who, sql, params = []) {
  return db.transaction(async (tx) => {
    await tx.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify(who.claims)]);
    await tx.exec(`SET LOCAL ROLE ${who.role}`);
    return (await tx.query(sql, params)).rows;
  });
}
const one = async (db, sql, params = []) => (await db.query(sql, params)).rows[0];

// ---------------------------------------------------------------------------
describe("pre-72 production policies (replica) are exploitable", { concurrency: false }, () => {
  let db;
  before(async () => { db = await freshDb(); });
  after(async () => db?.close());

  test("anonymous visitors can read every customer's identity documents", async () => {
    const rows = await as(db, anon, "SELECT id, passport_number, dob FROM profiles");
    assert.equal(rows.length, 3);
    assert.ok(rows.some((r) => r.passport_number === "SYN-PASSPORT"));
  });
  test("anonymous visitors can create an approved transaction for any customer", async () => {
    await as(db, anon, "INSERT INTO transactions(user_id,type,amount_aud,status) VALUES ($1,'buy_aud',999999,'approved')", [A]);
    assert.equal((await one(db, "SELECT count(*)::int n FROM transactions WHERE amount_aud=999999")).n, 1);
  });
  test("a customer can create transactions owned by another customer", async () => {
    await as(db, customerA, "INSERT INTO transactions(user_id,type,amount_aud,status) VALUES ($1,'sell_aud',7,'approved')", [B]);
    assert.equal((await one(db, "SELECT count(*)::int n FROM transactions WHERE user_id=$1 AND amount_aud=7", [B])).n, 1);
  });
  test("a customer can delete their own completed (approved) transaction", async () => {
    await as(db, customerA, "DELETE FROM transactions WHERE id=$1", [TX_A_APPROVED]);
    assert.equal((await one(db, "SELECT count(*)::int n FROM transactions WHERE id=$1", [TX_A_APPROVED])).n, 0);
  });
  test("a customer can rewrite their own compliance, loyalty and verified identity fields", async () => {
    await as(db, customerA, `UPDATE profiles SET loyalty_discount_toman=50000000, compliance_customer_flagged=false,
      compliance_customer_flag_reason=NULL, compliance_aml_flag='clear', first_name='Renamed' WHERE id=$1`, [A]);
    const p = await one(db, "SELECT * FROM profiles WHERE id=$1", [A]);
    assert.equal(Number(p.loyalty_discount_toman), 50000000);
    assert.equal(p.compliance_customer_flagged, false);
    assert.equal(p.compliance_aml_flag, "clear");
    assert.equal(p.first_name, "Renamed");
  });
  test("a customer can publish their own testimonial as approved", async () => {
    await as(db, customerA, "INSERT INTO testimonials(user_id,rating,message,status,is_published) VALUES ($1,5,'self-approved','approved',true)", [A]);
    assert.equal((await one(db, "SELECT count(*)::int n FROM testimonials WHERE message='self-approved' AND status='approved'")).n, 1);
  });
  test("anonymous visitors can read pending and rejected feedback", async () => {
    const rows = await as(db, anon, "SELECT status FROM testimonials WHERE status <> 'approved'");
    assert.ok(rows.length >= 2);
  });
  test("anonymous filtered deletes were already blocked by row visibility (no false alarm)", async () => {
    await as(db, anon, "DELETE FROM transactions WHERE id=$1", [TX_B_APPROVED]);
    assert.equal((await one(db, "SELECT count(*)::int n FROM transactions WHERE id=$1", [TX_B_APPROVED])).n, 1);
  });
});

// ---------------------------------------------------------------------------
function hardenedSuite(title, options) {
  describe(title, { concurrency: false }, () => {
    let db;
    before(async () => {
      db = await freshDb(options.base);
      if (options.reapply) await db.exec(MIGRATION);
    });
    after(async () => db?.close());

    // ---- Anonymous visitor
    test("anon: cannot read profiles or transactions", async () => {
      await assert.rejects(as(db, anon, "SELECT id FROM profiles"), DENIED);
      await assert.rejects(as(db, anon, "SELECT id FROM transactions"), DENIED);
    });
    test("anon: cannot create, change or delete transactions", async () => {
      await assert.rejects(as(db, anon, "INSERT INTO transactions(user_id,type,amount_aud,status) VALUES ($1,'buy_aud',1,'approved')", [A]), DENIED);
      await assert.rejects(as(db, anon, "UPDATE transactions SET status='approved' WHERE id=$1", [TX_A_PENDING]), DENIED);
      await assert.rejects(as(db, anon, "DELETE FROM transactions WHERE id=$1", [TX_A_PENDING]), DENIED);
    });
    test("anon: sees only approved testimonials and cannot post", async () => {
      const rows = await as(db, anon, "SELECT id, status FROM testimonials");
      assert.deepEqual(rows.map((r) => r.status), ["approved"]);
      await assert.rejects(as(db, anon, "INSERT INTO testimonials(user_id,rating,message) VALUES ($1,5,'x')", [A]), DENIED);
    });
    test("anon: public testimonial RPC releases only rating, message and a short display name", async () => {
      const rows = await as(db, anon, "SELECT * FROM get_public_testimonials(9)");
      assert.equal(rows.length, 1);
      assert.deepEqual(Object.keys(rows[0]).sort(), ["created_at", "display_name", "message", "rating"]);
      assert.equal(rows[0].display_name, "Alice S.");
      assert.equal(rows[0].message, "Synthetic approved review");
    });
    test("anon: public rates and the registration duplicate check still work", async () => {
      assert.equal((await as(db, anon, "SELECT buy_aud FROM rates_history")).length, 1);
      const [{ r }] = await as(db, anon, "SELECT check_user_exists('customer-a@example.invalid','+61499999999') r");
      assert.deepEqual(r, { email_exists: true, phone_exists: false });
    });
    test("anon: financial and audit tables are closed at the grant level", async () => {
      for (const t of ["audit_logs", "ledger", "bank_accounts", "expenses", "owner_loans", "treasury_settings", "promo_codes", "recipients", "admins"]) {
        await assert.rejects(as(db, anon, `SELECT 1 FROM ${t}`), DENIED, t);
      }
    });
    test("anon: removed / trigger-only SECURITY DEFINER functions are not callable", async () => {
      await assert.rejects(as(db, anon, "SELECT attach_documents_to_profile($1,'x',null,null,null,null,null,null)", [A]), /does not exist/);
      await assert.rejects(as(db, anon, "SELECT handle_new_user()"), DENIED);
      await assert.rejects(as(db, anon, "SELECT exchange_request_promo_guard()"), DENIED);
    });

    // ---- Customer A / Customer B isolation
    test("customer: reads only their own profile", async () => {
      const rows = await as(db, customerA, "SELECT id FROM profiles");
      assert.deepEqual(rows.map((r) => r.id), [A]);
      assert.equal((await as(db, customerA, "SELECT id FROM profiles WHERE id=$1", [B])).length, 0);
    });
    test("customer: forged user_metadata role grants nothing", async () => {
      assert.deepEqual((await as(db, forgedAdmin, "SELECT id FROM profiles")).map((r) => r.id), [A]);
      assert.equal((await as(db, forgedAdmin, "SELECT id FROM audit_logs")).length, 0);
    });
    test("customer: cannot change protected profile fields directly (server actions remain the only path)", async () => {
      await assert.rejects(as(db, customerA, "UPDATE profiles SET loyalty_discount_toman=1e9 WHERE id=$1", [A]), DENIED);
      await assert.rejects(as(db, customerA, "UPDATE profiles SET compliance_customer_flagged=false, compliance_aml_flag='clear' WHERE id=$1", [A]), DENIED);
      await assert.rejects(as(db, customerA, "UPDATE profiles SET first_name='Renamed' WHERE id=$1", [A]), DENIED);
      await assert.rejects(as(db, customerA, "UPDATE profiles SET first_name='Hijack' WHERE id=$1", [B]), DENIED);
      const p = await one(db, "SELECT first_name, loyalty_discount_toman, compliance_customer_flagged, compliance_aml_flag FROM profiles WHERE id=$1", [A]);
      assert.equal(p.first_name, "Alice");
      assert.equal(Number(p.loyalty_discount_toman), 0);
      assert.equal(p.compliance_customer_flagged, true);
      assert.equal(p.compliance_aml_flag, "review_required");
    });
    test("customer: sees only their own transactions", async () => {
      const rows = await as(db, customerA, "SELECT id FROM transactions ORDER BY id");
      assert.deepEqual(rows.map((r) => r.id).sort(), [TX_A_PENDING, TX_A_APPROVED].sort());
      assert.equal((await as(db, customerB, "SELECT id FROM transactions WHERE user_id=$1", [A])).length, 0);
    });
    test("customer: cannot create, alter or delete transactions (own or others')", async () => {
      await assert.rejects(as(db, customerA, "INSERT INTO transactions(user_id,type,amount_aud,status) VALUES ($1,'buy_aud',1,'pending')", [A]), DENIED);
      await assert.rejects(as(db, customerA, "INSERT INTO transactions(user_id,type,amount_aud,status) VALUES ($1,'buy_aud',1,'approved')", [B]), DENIED);
      await assert.rejects(as(db, customerA, "UPDATE transactions SET amount_aud=1, applied_rate=1, status='approved' WHERE id=$1", [TX_A_PENDING]), DENIED);
      await assert.rejects(as(db, customerA, "DELETE FROM transactions WHERE id=$1", [TX_A_APPROVED]), DENIED);
      await assert.rejects(as(db, customerA, "DELETE FROM transactions WHERE id=$1", [TX_B_APPROVED]), DENIED);
      assert.equal((await one(db, "SELECT count(*)::int n FROM transactions")).n, 3);
    });
    test("customer: dashboard summary and identity notice RPCs stay scoped to the caller", async () => {
      const [summary] = await as(db, customerA, "SELECT * FROM my_approved_transaction_summary()");
      assert.equal(Number(summary.volume), 200);
      assert.equal(Number(summary.approved_count), 1);
      const [{ seen }] = await as(db, customerA, "SELECT acknowledge_kyc_approval_notice($1) seen", [A]);
      assert.ok(seen);
      const [{ seen: other }] = await as(db, customerA, "SELECT acknowledge_kyc_approval_notice($1) seen", [B]);
      assert.equal(other, null);
      assert.equal((await one(db, "SELECT kyc_approval_notice_seen_at FROM profiles WHERE id=$1", [B])).kyc_approval_notice_seen_at, null);
    });
    test("customer: can submit feedback, but only as their own unmoderated entry", async () => {
      await as(db, customerA, "INSERT INTO testimonials(user_id,rating,message,status) VALUES ($1,5,'My pending feedback','pending')", [A]);
      await assert.rejects(as(db, customerA, "INSERT INTO testimonials(user_id,rating,message,status) VALUES ($1,5,'x','approved')", [A]), DENIED);
      await assert.rejects(as(db, customerA, "INSERT INTO testimonials(user_id,rating,message,status,is_published) VALUES ($1,5,'x','pending',true)", [A]), DENIED);
      await assert.rejects(as(db, customerA, "INSERT INTO testimonials(user_id,rating,message,status,moderated_by) VALUES ($1,5,'x','pending',$2)", [A, ADMIN]), DENIED);
      await assert.rejects(as(db, customerA, "INSERT INTO testimonials(user_id,rating,message,status) VALUES ($1,5,'x','pending')", [B]), DENIED);
      await assert.rejects(as(db, customerA, "UPDATE testimonials SET status='approved' WHERE user_id=$1", [A]), DENIED);
      const visible = await as(db, customerA, "SELECT message FROM testimonials ORDER BY message");
      assert.deepEqual(visible.map((r) => r.message), ["My pending feedback", "Synthetic approved review"]);
      assert.equal((await as(db, anon, "SELECT * FROM get_public_testimonials(9)")).length, 1, "pending feedback must not reach the homepage");
    });
    test("customer: recipients and realtime signals remain owner-only", async () => {
      assert.deepEqual((await as(db, customerA, "SELECT full_name FROM recipients")).map((r) => r.full_name), ["Recipient of A"]);
      await assert.rejects(as(db, customerA, "INSERT INTO recipients(user_id,full_name) VALUES ($1,'x')", [B]), DENIED);
      assert.equal((await as(db, customerA, "SELECT user_id FROM exchange_request_realtime_signals")).length, 1);
    });
    test("customer: admin-only data stays invisible", async () => {
      assert.equal((await as(db, customerA, "SELECT 1 FROM audit_logs")).length, 0);
      assert.equal((await as(db, customerA, "SELECT 1 FROM promo_codes")).length, 0);
      assert.equal((await as(db, customerA, "SELECT 1 FROM reports_daily")).length, 0);
      await assert.rejects(as(db, customerA, "SELECT 1 FROM ledger"), DENIED);
      await assert.rejects(as(db, customerA, "INSERT INTO audit_logs(action) VALUES ('forged')"), DENIED);
    });

    // ---- Administrator (JWT reads)
    test("admin JWT: reads every profile, transaction, testimonial, promo code, audit row and report", async () => {
      assert.equal((await as(db, adminJwt, "SELECT id FROM profiles")).length, 3);
      assert.equal((await as(db, adminJwt, "SELECT id FROM transactions")).length, 3);
      assert.ok((await as(db, adminJwt, "SELECT id FROM testimonials")).length >= 3);
      assert.equal((await as(db, adminJwt, "SELECT code FROM promo_codes")).length, 1);
      assert.ok((await as(db, adminJwt, "SELECT id FROM audit_logs")).length >= 1);
      assert.equal((await as(db, adminJwt, "SELECT id FROM reports_daily")).length, 1);
      assert.equal((await as(db, adminJwt, "SELECT * FROM get_public_testimonials(9)")).length, 1);
    });
    test("admin JWT: is read-only at the database (writes must use the audited server actions)", async () => {
      await assert.rejects(as(db, adminJwt, "UPDATE profiles SET first_name='Changed' WHERE id=$1", [A]), DENIED);
      await assert.rejects(as(db, adminJwt, "INSERT INTO transactions(user_id,type,amount_aud) VALUES ($1,'buy_aud',1)", [A]), DENIED);
      await assert.rejects(as(db, adminJwt, "DELETE FROM transactions WHERE id=$1", [TX_A_PENDING]), DENIED);
    });

    // ---- Administrator workflows (requireAdmin() + service role, as in app/actions/admin.actions.ts)
    test("admin workflow: correct a customer's name from Persian to English", async () => {
      await as(db, service, "UPDATE profiles SET first_name=$2, last_name=$3 WHERE id=$1", [A, "Alice", "Smith"]);
      assert.deepEqual(await one(db, "SELECT first_name, last_name FROM profiles WHERE id=$1", [A]), { first_name: "Alice", last_name: "Smith" });
      await as(db, service, "UPDATE profiles SET kyc_status='under_review' WHERE id=$1", [B]);
      assert.equal((await one(db, "SELECT kyc_status FROM profiles WHERE id=$1", [B])).kyc_status, "under_review");
    });
    test("admin workflow: create a transaction on behalf of a customer, cancel it, then delete it", async () => {
      const [{ id }] = await as(db, service, "INSERT INTO transactions(user_id,type,amount_aud,equivalent_toman,status,reference_code) VALUES ($1,'buy_aud',50,500000,'pending','ZE-SYN-1') RETURNING id", [A]);
      assert.deepEqual((await as(db, customerA, "SELECT reference_code FROM transactions WHERE id=$1", [id])).map((r) => r.reference_code), ["ZE-SYN-1"]);
      await as(db, service, "UPDATE transactions SET status='rejected' WHERE id=$1 AND status='pending'", [id]);
      assert.equal((await one(db, "SELECT status FROM transactions WHERE id=$1", [id])).status, "rejected");
      await as(db, service, "DELETE FROM transactions WHERE id=$1", [id]);
      assert.equal((await one(db, "SELECT count(*)::int n FROM transactions WHERE id=$1", [id])).n, 0);
      await as(db, service, "INSERT INTO audit_logs(actor_id,action) VALUES ($1,'TRANSACTION_HARD_DELETED')", [ADMIN]);
    });
    test("admin workflow: moderating feedback publishes it to the homepage", async () => {
      await as(db, service, "UPDATE testimonials SET status='approved', moderated_by=$2, moderated_at=now() WHERE id=$1", [T_B_PENDING, ADMIN]);
      const names = (await as(db, anon, "SELECT display_name FROM get_public_testimonials(9)")).map((r) => r.display_name).sort();
      assert.deepEqual(names, ["Alice S.", "Bob T."]);
    });

    // ---- Registration and triggers
    test("signup: the Auth service still creates profiles through the revoked trigger chain", async () => {
      const id = "00000000-0000-4000-8000-00000000c0de";
      await as(db, { role: "supabase_auth_admin", claims: {} }, `INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES ($1,'new@example.invalid','{"first_name":"New"}')`, [id]);
      const p = await one(db, "SELECT kyc_status, customer_code, first_name FROM profiles WHERE id=$1", [id]);
      assert.equal(p.kyc_status, "pending");
      assert.match(p.customer_code, /^CZ\d{6}$/);
      // Prove trigger execution never depended on EXECUTE: drop the explicit grant too (rolled back).
      await assert.rejects(db.transaction(async (tx) => {
        await tx.exec("REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM supabase_auth_admin");
        await tx.exec("SET LOCAL ROLE supabase_auth_admin");
        await tx.query("INSERT INTO auth.users(id,email) VALUES ('00000000-0000-4000-8000-00000000c0df','probe@example.invalid')");
        const { rows } = await tx.query("SELECT count(*)::int n FROM auth.users WHERE id='00000000-0000-4000-8000-00000000c0df'");
        assert.equal(rows[0].n, 1);
        throw new Error("rollback probe");
      }), /rollback probe/);
    });
    test("kyc guard trigger still blocks customer-role KYC status changes", async () => {
      await assert.rejects(db.transaction(async (tx) => {
        await tx.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify(customerA.claims)]);
        await tx.query("UPDATE profiles SET kyc_status='approved' WHERE id=$1", [B]);
      }), /Users cannot change their own KYC status/);
    });

    // ---- Catalog hygiene (security + performance advisor parity)
    test("catalog: no unconditional policy remains except public rates", async () => {
      const { rows } = await db.query("SELECT tablename, policyname FROM pg_policies WHERE schemaname='public' AND (qual='true' OR with_check='true')");
      assert.deepEqual(rows.map((r) => r.tablename), ["rates_history"]);
    });
    test("catalog: every auth.*() call in a policy is wrapped for a single initplan evaluation", async () => {
      const { rows } = await db.query("SELECT tablename, policyname, coalesce(qual,'')||' '||coalesce(with_check,'') expr FROM pg_policies WHERE schemaname='public'");
      for (const r of rows) {
        const calls = (r.expr.match(/auth\.(uid|jwt|role)\(\)/g) || []).length;
        const wrapped = (r.expr.match(/SELECT\s+\(*auth\.(uid|jwt|role)\(\)/g) || []).length;
        assert.equal(wrapped, calls, `${r.tablename}.${r.policyname}`);
      }
    });
    test("catalog: at most one permissive policy per table, command and role", async () => {
      const { rows } = await db.query(`SELECT tablename, cmd, r role, count(*)::int n FROM pg_policies, unnest(roles) r
        WHERE schemaname='public' AND permissive='PERMISSIVE' GROUP BY 1,2,3 HAVING count(*) > 1`);
      assert.deepEqual(rows, []);
    });
    test("catalog: anon holds only SELECT on rates_history and testimonials; no API role can TRUNCATE", async () => {
      const { rows } = await db.query(`SELECT c.relname, p.priv, r.role FROM pg_class c
        CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p(priv)
        CROSS JOIN unnest(ARRAY['anon','authenticated']) r(role)
        WHERE c.relnamespace='public'::regnamespace AND c.relkind='r' AND has_table_privilege(r.role, c.oid, p.priv)
          AND (r.role='anon' OR p.priv IN ('TRUNCATE','REFERENCES','TRIGGER'))
        ORDER BY 1,2`);
      assert.deepEqual(rows.map((r) => `${r.role}:${r.relname}:${r.priv}`), ["anon:rates_history:SELECT", "anon:testimonials:SELECT"]);
    });
    test("catalog: duplicate indexes removed, testimonial owner index present", async () => {
      const { rows } = await db.query("SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename IN ('profiles','promo_codes','testimonials') ORDER BY 1");
      const names = rows.map((r) => r.indexname);
      assert.ok(!names.includes("idx_profiles_kyc_created"));
      assert.ok(!names.includes("promo_codes_id_key"));
      assert.ok(names.includes("idx_profiles_kyc_status_created"));
      assert.ok(names.includes("promo_codes_pkey"));
      assert.ok(names.includes("testimonials_user_id_idx"));
    });
  });
}

hardenedSuite("after migration 72", { base: { migrate: true } });

// ---------------------------------------------------------------------------
describe("rollback restores the exact pre-72 authorization state", { concurrency: false }, () => {
  let baseline, rolledBack;
  // Normalised snapshot: policies, the effective privilege matrix, function ACL/config, indexes.
  const snapshot = async (db) => ({
    policies: (await db.query(`SELECT tablename, policyname, permissive, roles::text, cmd, qual, with_check FROM pg_policies
      WHERE schemaname='public' ORDER BY tablename, policyname`)).rows,
    tablePrivileges: (await db.query(`SELECT c.relname, r.role, string_agg(p.priv, ',' ORDER BY p.priv) privs FROM pg_class c
      CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p(priv)
      CROSS JOIN unnest(ARRAY['anon','authenticated','service_role']) r(role)
      WHERE c.relnamespace='public'::regnamespace AND c.relkind='r' AND has_table_privilege(r.role, c.oid, p.priv)
      GROUP BY 1,2 ORDER BY 1,2`)).rows,
    functions: (await db.query(`SELECT p.proname, p.prosecdef, coalesce(p.proconfig::text,'') cfg,
      has_function_privilege('anon', p.oid, 'EXECUTE') anon_x, has_function_privilege('authenticated', p.oid, 'EXECUTE') auth_x
      FROM pg_proc p WHERE p.pronamespace='public'::regnamespace ORDER BY 1`)).rows,
    indexes: (await db.query("SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY 1")).rows,
  });
  before(async () => {
    baseline = await freshDb();
    rolledBack = await freshDb({ migrate: true, rollback: true });
  });
  after(async () => { await baseline?.close(); await rolledBack?.close(); });

  test("policies, privileges, function settings and indexes match the original", async () => {
    const [b, r] = await Promise.all([snapshot(baseline), snapshot(rolledBack)]);
    assert.deepEqual(r.policies, b.policies);
    assert.deepEqual(r.tablePrivileges, b.tablePrivileges);
    assert.deepEqual(r.functions, b.functions);
    assert.deepEqual(r.indexes, b.indexes);
  });
  test("the rolled-back state is the vulnerable one (the rollback is real)", async () => {
    assert.equal((await as(rolledBack, anon, "SELECT id FROM profiles")).length, 3);
  });
});

hardenedSuite("migration 72 re-applied after a rollback", { base: { migrate: true, rollback: true }, reapply: true });

// The read-only production verification script (scripts/verify-security-72.sql) must reject the
// pre-72 policies and accept the hardened ones, so its PASS after deployment means something.
describe("post-deployment verification script", { concurrency: false }, () => {
  // Drop psql meta-commands (lines starting with a backslash), which PGlite does not understand.
  const VERIFY = read("scripts/verify-security-72.sql").split(/\r?\n/).filter((l) => !l.startsWith("\\")).join("\n");
  async function runVerify(db) {
    const lines = [];
    try { await db.exec(VERIFY, { onNotice: (n) => lines.push(n.message) }); return { lines, error: null }; }
    catch (error) { return { lines, error }; }
  }
  test("reports FAILED on the current (pre-72) production policies", async () => {
    const db = await freshDb();
    const { lines, error } = await runVerify(db);
    await db.close();
    assert.match(String(error?.message), /RESULT: FAILED \(\d+ checks\)/);
    for (const check of ["anon: cannot read profiles", "anon: cannot read transactions", "customer: sees only their own profile", "anon: cannot create transactions"]) {
      assert.ok(lines.some((l) => l.startsWith("FAIL") && l.includes(check)), `expected FAIL for "${check}"\n${lines.join("\n")}`);
    }
  });
  test("reports PASS on every check after migration 72, and changes no rows", async () => {
    const db = await freshDb({ migrate: true });
    const before = await one(db, "SELECT (SELECT count(*) FROM profiles) p, (SELECT count(*) FROM transactions) t, (SELECT count(*) FROM testimonials) s");
    const { lines, error } = await runVerify(db);
    assert.equal(error, null, `${error?.message}\n${lines.join("\n")}`);
    assert.equal(lines.at(-1), "RESULT: PASS");
    assert.ok(lines.filter((l) => l.startsWith("PASS")).length >= 19, lines.join("\n"));
    assert.ok(!lines.some((l) => l.startsWith("FAIL")), lines.join("\n"));
    assert.deepEqual(await one(db, "SELECT (SELECT count(*) FROM profiles) p, (SELECT count(*) FROM transactions) t, (SELECT count(*) FROM testimonials) s"), before);
    await db.close();
  });
  test("reports FAILED again after the rollback", async () => {
    const db = await freshDb({ migrate: true, rollback: true });
    const { error } = await runVerify(db);
    await db.close();
    assert.match(String(error?.message), /RESULT: FAILED/);
  });
});
