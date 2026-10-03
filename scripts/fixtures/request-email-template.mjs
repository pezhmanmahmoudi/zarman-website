// Synthetic offline preview/test data only. Never reads env files or sends mail.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
function compile(file, dependencies = {}) {
  const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const compiledModule = { exports: {} };
  vm.runInThisContext(`(function(require,module,exports){${output}\n})`, { filename: file })((id) => {
    if (id in dependencies) return dependencies[id];
    if (id.startsWith("node:") || ["pdf-lib", "@pdf-lib/fontkit"].includes(id)) return require(id);
    throw new Error(`Unexpected dependency ${id}`);
  }, compiledModule, compiledModule.exports);
  return compiledModule.exports;
}

const receipts = compile("lib/requests/receipt.ts");
const config = compile("lib/requests/notification-config.ts");
export const templates = compile("lib/requests/notification-template.ts", { "./receipt": receipts, "./notification-config": config });
export const settings = { from: "Zarman <preview@example.test>", siteUrl: "https://example.test" };
export const completion = {
  version: 1,
  request_id: "10000000-0000-4000-8000-000000000001",
  transaction_id: "20000000-0000-4000-8000-000000000001",
  reference_code: "ZE123456",
  completed_at: "2026-10-02T05:12:00Z",
  sender_name: "Sam Example",
  recipient_name: "Alex Example",
  funding_currency: "IRT", funding_total: 115000000,
  recipient_currency: "AUD", recipient_amount: 1150,
  base_fee_aud: 0, priority_fee_aud: 0, priority_fee_amount: 0,
  priority_fee_status: "not_applicable", applied_rate: 100000,
  service_tier: "standard",
};
export function delivery(overrides = {}) {
  return {
    id: "30000000-0000-4000-8000-000000000001", request_id: completion.request_id,
    audience: "customer", recipient_email: "customer@example.test", locale: "en",
    reference: completion.reference_code, workflow_status: "completed", event_type: "complete",
    requested_tier: "standard", priority_fee_aud: 0, created_at: "2026-10-02T05:13:00Z",
    payload_snapshot: { receipt: { ...completion } }, ...overrides,
  };
}

export const previews = {
  "completed-en": delivery(),
  "payment-approved-en": delivery({ workflow_status: "awaiting_funds", event_type: "await_funds", payload_snapshot: {
    sender_name: "Sam Example", recipient_name: "Alex Example", recipient_currency: "IRT", recipient_amount: 115000000,
    funding_currency: "AUD", funding_total: 1150,
    payment_details: { account_name: "ZARMAN — PREVIEW ONLY", bsb: "000-000", account_number: "00000000" },
  } }),
  "message-en": delivery({ workflow_status: "processing", event_type: "admin_message", payload_snapshot: {
    sender_name: "Sam Example", public_message: "Your transfer is being processed. We will update you on this request page once settlement is confirmed.",
  } }),
};
