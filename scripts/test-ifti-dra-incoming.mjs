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

async function incomingRow(record) {
  const buffer = await compiled.exports.generateIftiDraIncomingWorkbook([{
    id: "22222222-2222-4222-8222-222222222222",
    type: "sell_aud",
    status: "approved",
    created_at: "2026-10-12T00:00:00.000Z",
    approved_at: "2026-10-13T00:00:00.000Z",
    reason_for_transfer: "International Payment",
    profiles: { first_name: "Test", last_name: "Customer", country: "Iran" },
    recipients: null,
    ...record,
  }]);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook.getWorksheet("IFTI-DRA IN").getRow(3);
}

test("the institution chosen on the request populates AMC even when the link is a CommBank checkout", async () => {
  const row = await incomingRow({
    amount_aud: 2920,
    payment_link: "https://paymentgateway.commbank.com.au/checkout/pay/SESSION0002409772539L14183382L8?checkoutVersion=1.0.0",
    exchange_requests: { institution_id: "amc", institution_name: "Australian Medical Council Limited" },
  });

  assert.equal(row.getCell(28).value, "Australian Medical Council Limited");
  assert.equal(row.getCell(30).value, "Australian Medical Council");
  assert.equal(row.getCell(44).value, "97 131 796 980");
  assert.equal(row.getCell(47).value, "Australian Medical Council Limited");
});

test("an Other institution typed as Epic resolves to the Intealth EPIC profile", async () => {
  const row = await incomingRow({
    amount_aud: 326,
    payment_link: "https://applicant.myintealth.app/s/epic?tabset-335b1=2",
    exchange_requests: [{ institution_id: "other", institution_name: "Epic" }],
  });

  assert.equal(row.getCell(28).value, "Intealth");
  assert.equal(row.getCell(30).value, "EPIC (Electronic Portfolio of International Credentials)");
  assert.equal(row.getCell(31).value, "3624 Market Street");
  assert.equal(row.getCell(32).value, "Philadelphia");
  assert.equal(row.getCell(35).value, "United States of America");
  assert.equal(row.getCell(47).value, "");
});

test("legacy MyIntealth links without a request still resolve to Intealth, unknown institutions keep their typed name", async () => {
  const legacy = await incomingRow({ amount_aud: 160, payment_link: "https://applicant.myintealth.app/s/chargentorder/a2wQP00000GiENqYAN/ord000503877" });
  assert.equal(legacy.getCell(28).value, "Intealth");

  const unknown = await incomingRow({
    amount_aud: 420,
    payment_link: "https://home.pearsonvue.com/pay",
    exchange_requests: { institution_id: "other", institution_name: "Pearson VUE" },
  });
  assert.equal(unknown.getCell(28).value, "Pearson VUE");
  assert.equal(unknown.getCell(30).value, "");
});

test("RACGP payments resolve from the request or, for legacy rows, from the racgp.org.au link", async () => {
  for (const record of [
    { exchange_requests: { institution_id: "racgp", institution_name: "The Royal Australian College of General Practitioners Limited" } },
    { exchange_requests: null },
  ]) {
    const row = await incomingRow({ amount_aud: 2450, payment_link: "https://www.racgp.org.au/fracgp/exams", ...record });
    assert.equal(row.getCell(28).value, "The Royal Australian College of General Practitioners Limited");
    assert.equal(row.getCell(30).value, "RACGP");
    assert.equal(row.getCell(31).value, "RACGP House, 100 Wellington Parade");
    assert.equal(row.getCell(32).value, "East Melbourne");
    assert.equal(row.getCell(44).value, "34 000 223 807");
  }
});

test("a saved recipient street line is reported whole instead of being split into number and city", async () => {
  const row = await incomingRow({
    amount_aud: 4777.59,
    payment_link: null,
    reason_for_transfer: "Family support",
    recipients: {
      direction: "aud", full_name: "Azadeh Hafezi", residential_address: "7 Lakewood Ct",
      residential_city: "MACLEOD", residential_state: "VIC", residential_postcode: "3085", residential_country: "Australia",
    },
  });
  assert.equal(row.getCell(31).value, "7 Lakewood Ct");
  assert.equal(row.getCell(32).value, "MACLEOD");
  assert.equal(row.getCell(33).value, "VIC");
  assert.equal(row.getCell(34).value, "3085");

  const legacy = await incomingRow({
    amount_aud: 1000,
    payment_link: null,
    recipients: { direction: "aud", full_name: "Legacy", residential_address: "526/32 Civic Way, Rouse Hill NSW 2155" },
  });
  assert.equal(legacy.getCell(31).value, "526/32 Civic Way");
  assert.equal(legacy.getCell(32).value, "Rouse Hill");
  assert.equal(legacy.getCell(33).value, "NSW");
  assert.equal(legacy.getCell(34).value, "2155");
});

test("legacy payment links identify Ahpra, ADC, Home Affairs and IMG4IMGS", async () => {
  const cases = [
    ["https://portal.ahpra.gov.au/portal/s/resumeapps?cafinstance=a1GOb00000D7flJMAR", "Australian Health Practitioner Regulation Agency", "78 685 433 429"],
    ["https://connect.adc.org.au/make-a-payment/?type=mcs_application&id=3680599c", "Australian Dental Council Limited", "70 072 269 900"],
    ["https://online.immi.gov.au/payments/appspayment.htm", "Department of Home Affairs", "33 380 054 835"],
    ["immiaccount", "Department of Home Affairs", "33 380 054 835"],
    ["https://img4imgs.thinkific.com/courses/take/MedicineMC2026chapter3CVS", "IMG4IMGS", ""],
    ["img4img", "IMG4IMGS", ""],
  ];
  for (const [payment_link, name, abn] of cases) {
    const row = await incomingRow({ amount_aud: 100, payment_link });
    assert.equal(row.getCell(28).value, name, payment_link);
    assert.equal(row.getCell(44).value, abn, payment_link);
  }
});
