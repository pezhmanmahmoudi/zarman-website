// Read-only deployment check. Never confirms funds or reads customer records.
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd(), false, { info() {}, error() {} });

const migrations = "the request migrations through supabase/migrations/20261009_56_repair_final_amount_confirmation.APPLY_MANUALLY.sql (including 52–54)";
try {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for the target deployment.");
  const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/openapi+json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Database schema check failed (HTTP ${response.status}).`);
  const schema = await response.json();
  if (!schema.paths || !schema.definitions) throw new Error("The database API did not return an OpenAPI schema. Check its settings in Supabase.");
  const checks = {
    atomic_funding_function: Boolean(schema.paths["/rpc/confirm_exchange_request_funds"]?.post),
    accounting_overrides_column: Boolean(schema.definitions.exchange_requests?.properties?.accounting_overrides),
    original_quote_column: Boolean(schema.definitions.exchange_requests?.properties?.original_quote),
    pricing_pending_acceptance_column: Boolean(schema.definitions.exchange_requests?.properties?.pricing_pending_acceptance),
    deposit_correction_function: Boolean(schema.paths["/rpc/correct_exchange_request_funds"]?.post),
    final_amounts_function: Boolean(schema.paths["/rpc/finalize_exchange_request_funds"]?.post),
    corrected_payment_view: Boolean(schema.paths["/exchange_request_current_payments"]?.get),
  };
  console.log(JSON.stringify(checks, null, 2));
  if (Object.values(checks).some(present => !present)) {
    throw new Error(`Required database objects are missing. Apply ${migrations} and reload the API schema before deploying the application.`);
  }
  console.log("Required database API objects are present. This does not verify the deployed application version; deploy the updated server action as well.");
} catch (error) {
  // Never print credentials, response bodies, customer data or full error causes.
  console.error(error instanceof Error ? error.message : "Deployment check failed.");
  if (error?.cause?.code) console.error(`Network error code: ${error.cause.code}`);
  process.exitCode = 1;
}
