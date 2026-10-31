// Runs the free internal DFAT + PEP screens for every customer and every active recipient and
// records the results (so nobody has to be screened one by one). Skips anyone already current.
//
//   node --env-file=.env.local scripts/screen-everyone.mjs
//
// Reuses the application's own TypeScript (Node strips the types); only the "@/" alias is mapped.
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = new URL("../", import.meta.url);
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("@/")) {
      const base = fileURLToPath(new URL(specifier.slice(2), root));
      for (const suffix of [".ts", ".tsx", "/index.ts"]) if (existsSync(base + suffix)) return next(pathToFileURL(base + suffix).href, context);
    }
    return next(specifier, context);
  },
});

const { complianceDb } = await import("../lib/compliance/screening.ts");
const { screenEveryoneInternal } = await import("../lib/compliance/rescreen.ts");

const started = Date.now();
let last = 0;
const summary = await screenEveryoneInternal(complianceDb(), null, (done, total) => {
  if (done - last >= 20 || done === total) { last = done; console.log(`${done}/${total} customers processed (${Math.round((Date.now() - started) / 1000)}s)`); }
}, 10);
console.log(`Done in ${Math.round((Date.now() - started) / 1000)}s: ${summary.customers} customers, ${summary.recipients} recipients screened.`);
console.log(`Open potential matches: ${summary.sanctionsMatches} sanctions, ${summary.pepMatches} PEP. Failed: ${summary.failed}.`);
