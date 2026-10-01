import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const ExcelJS = require("exceljs");
const source = readFileSync(new URL("../lib/reporting/ifti-dra-incoming.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
}).outputText;
const compiled = { exports: {} };
const institutionModule = { exports: {} };
const institutionJs = ts.transpileModule(readFileSync(new URL("../lib/payments/institutions.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
vm.runInThisContext(`(function(exports){${institutionJs}\n})`)(institutionModule.exports);
vm.runInThisContext(`(function(require,module,exports){${js}\n})`)((id) => {
  if (id === "exceljs") return ExcelJS;
  if (id === "../payments/institutions") return institutionModule.exports;
  throw new Error(`Unexpected dependency: ${id}`);
}, compiled, compiled.exports);

test("OET payment links populate the AUSTRAC incoming beneficiary without inventing account details", async () => {
  const buffer = await compiled.exports.generateIftiDraIncomingWorkbook([{
    id: "11111111-1111-4111-8111-111111111111",
    type: "sell_aud",
    amount_aud: 587,
    status: "approved",
    created_at: "2026-09-24T00:00:00.000Z",
    approved_at: "2026-09-24T01:00:00.000Z",
    reference_code: "ZE-OET-001",
    payment_link: "https://registration.myoet.com/login.jsp#book/assessment",
    reason_for_transfer: "",
    profiles: {
      first_name: "Ahmadreza",
      last_name: "Badali",
      country: "Iran",
    },
    recipients: null,
  }]);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const row = workbook.getWorksheet("IFTI-DRA IN").getRow(3);

  assert.equal(row.getCell(28).value, "Cambridge Boxhill Language Assessment Pty Ltd ATF Cambridge Boxhill Language Assessment Unit Trust");
  assert.equal(row.getCell(30).value, "OET");
  assert.equal(row.getCell(31).value, "Level 17, 452 Flinders Street");
  assert.equal(row.getCell(32).value, "Melbourne");
  assert.equal(row.getCell(33).value, "VIC");
  assert.equal(row.getCell(34).value, "3000");
  assert.equal(row.getCell(35).value, "Australia");
  assert.equal(row.getCell(43).value, "English language testing for healthcare professionals");
  assert.equal(row.getCell(44).value, "51 988 559 414");
  assert.equal(row.getCell(45).value, "Unit Trust");
  assert.equal(row.getCell(46).value, "");
  assert.equal(row.getCell(47).value, "");
  assert.equal(row.getCell(111).value, "OET test booking fee");
});
