// Loads a DFAT Consolidated List .xlsx without the admin page (same code path as the upload).
//
//   node --env-file=.env.local scripts/load-dfat.mjs "C:/path/Australian_Sanctions_Consolidated_List.xlsx" [--force]
import { registerHooks } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { basename } from "node:path";

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

const file = process.argv[2];
if (!file) throw new Error("Pass the path to the DFAT .xlsx file.");
const { parseDfatWorkbook } = await import("../lib/compliance/dfat-import.ts");
const { loadDfatList } = await import("../lib/compliance/dfat-load.ts");
const { complianceDb } = await import("../lib/compliance/screening.ts");

const parsed = await parseDfatWorkbook(readFileSync(file));
const result = await loadDfatList(complianceDb(), parsed, { fileName: basename(file), actor: null, force: process.argv.includes("--force") });
console.log(result.ok ? `Loaded ${result.rows} rows (${result.lowRelevanceRows} low-relevance), control date ${result.latestControlDate}.\n${result.notes}` : result.message);
