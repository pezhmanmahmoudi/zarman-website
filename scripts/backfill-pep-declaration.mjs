// One-off: records a "No" PEP self-declaration for every existing customer who has none,
// because the director asked them verbally before the KYC form had the question.
//
//   node --env-file=.env.local scripts/backfill-pep-declaration.mjs           # dry run: counts only
//   node --env-file=.env.local scripts/backfill-pep-declaration.mjs --apply   # write
//
// Only profiles whose answer is still NULL are touched; existing answers (including "yes")
// are never overwritten. Requires the 20261031_69 migration.
import { createClient } from "@supabase/supabase-js";

const apply = process.argv.includes("--apply");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (use --env-file=.env.local).");
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const { count, error } = await db.from("profiles").select("id", { count: "exact", head: true }).is("pep_self_declared", null);
if (error) {
  console.error(error.code === "42703" ? "The pep_* columns do not exist yet: apply migration 20261031_69 first." : error.message);
  process.exit(1);
}
const { count: total } = await db.from("profiles").select("id", { count: "exact", head: true });
const { count: yes } = await db.from("profiles").select("id", { count: "exact", head: true }).eq("pep_self_declared", true);
console.log(`Profiles: ${total} total, ${count} without a PEP answer, ${yes} already declared PEP (left untouched).`);
if (!apply) { console.log("Dry run only. Re-run with --apply to record 'No' for the profiles without an answer."); process.exit(0); }

const now = new Date().toISOString();
const { data, error: updateError } = await db.from("profiles").update({
  pep_self_declared: false, pep_declaration_relation: null, pep_declaration_details: null,
  pep_declared_at: now, pep_declaration_source: "admin_recorded",
}).is("pep_self_declared", null).select("id");
if (updateError) { console.error(updateError.message); process.exit(1); }
await db.from("audit_logs").insert([{
  actor_id: null, actor_email: "script:backfill-pep-declaration", action: "ADMIN_PEP_DECLARATION_BACKFILL", target_type: "profile", target_id: "bulk",
  new_value: { recorded: "no", count: data?.length ?? 0, reason: "Existing customers were asked verbally by the director before the KYC form included the PEP question.", at: now },
}]).then(() => {}, () => console.log("(audit log entry could not be written)"));
console.log(`Recorded "No" for ${data?.length ?? 0} customers.`);
