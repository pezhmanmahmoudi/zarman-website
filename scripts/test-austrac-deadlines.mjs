// Offline regression coverage for the AUSTRAC 10-business-day deadline math.
// Pure functions only — no database, network, or Supabase client involved.
// Run: node --test scripts/test-austrac-deadlines.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { test } from "node:test";
import ts from "typescript";

const projectRoot = new URL("../", import.meta.url);
const read = (file) => readFileSync(new URL(file, projectRoot), "utf8");
const compiled = { exports: {} };
const js = ts.transpileModule(read("lib/reporting/austrac-deadlines.ts"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
vm.runInThisContext(`(function(module,exports){${js}\n})`, {
  filename: fileURLToPath(new URL("lib/reporting/austrac-deadlines.ts", projectRoot)),
})(compiled, compiled.exports);
const {
  AUSTRAC_REPORTING_BUSINESS_DAYS,
  isAustralianBusinessDay,
  addBusinessDays,
  calcAustracDueDate,
  calcBusinessDaysRemaining,
  classifyAustracUrgency,
} = compiled.exports;

const utc = (y, m, d) => new Date(Date.UTC(y, m, d));
const iso = (date) => date.toISOString().slice(0, 10);

test("10 business days is the AUSTRAC IFTI-DRA reporting window", () => {
  assert.equal(AUSTRAC_REPORTING_BUSINESS_DAYS, 10);
});

test("weekends are never business days, and ordinary weekdays are", () => {
  // 2026-06-06/07 is a Sat/Sun with no surrounding public holiday.
  assert.equal(isAustralianBusinessDay(utc(2026, 5, 6)), false);
  assert.equal(isAustralianBusinessDay(utc(2026, 5, 7)), false);
  assert.equal(isAustralianBusinessDay(utc(2026, 5, 8)), true);
  assert.equal(isAustralianBusinessDay(utc(2026, 5, 9)), true);
});

test("fixed-date national public holidays are excluded regardless of year", () => {
  for (const year of [2026, 2027, 2028]) {
    assert.equal(isAustralianBusinessDay(utc(year, 0, 1)), false, `New Year's Day ${year}`);
    assert.equal(isAustralianBusinessDay(utc(year, 0, 26)), false, `Australia Day ${year}`);
    assert.equal(isAustralianBusinessDay(utc(year, 3, 25)), false, `Anzac Day ${year}`);
    assert.equal(isAustralianBusinessDay(utc(year, 11, 25)), false, `Christmas Day ${year}`);
    assert.equal(isAustralianBusinessDay(utc(year, 11, 26)), false, `Boxing Day ${year}`);
  }
});

test("Easter-based public holidays are computed (Good Friday / Easter Monday 2026)", () => {
  assert.equal(isAustralianBusinessDay(utc(2026, 3, 3)), false); // Good Friday
  assert.equal(isAustralianBusinessDay(utc(2026, 3, 6)), false); // Easter Monday
  // The Thursday/Tuesday immediately either side are ordinary business days.
  assert.equal(isAustralianBusinessDay(utc(2026, 3, 2)), true);
  assert.equal(isAustralianBusinessDay(utc(2026, 3, 7)), true);
});

test("addBusinessDays skips weekends and holidays and always lands on a business day", () => {
  const start = utc(2026, 5, 1); // Monday, no nearby holidays
  const result = addBusinessDays(start, 10);
  assert.equal(iso(result), "2026-06-15");
  assert.equal(isAustralianBusinessDay(result), true);
});

test("calcAustracDueDate is exactly 10 business days after the reference date", () => {
  const referenceIso = "2026-06-01"; // Monday
  const dueIso = calcAustracDueDate(referenceIso);
  assert.equal(dueIso, "2026-06-15");

  // Independently confirm exactly 10 business days fall strictly after the
  // reference date and up to (inclusive of) the computed due date.
  let cursor = utc(2026, 5, 1);
  let count = 0;
  const due = new Date(`${dueIso}T00:00:00.000Z`);
  while (cursor.getTime() !== due.getTime()) {
    cursor = new Date(cursor.getTime() + 86_400_000);
    if (isAustralianBusinessDay(cursor)) count += 1;
  }
  assert.equal(count, 10);
});

test("due date spanning Easter correctly skips both Good Friday and Easter Monday", () => {
  // 2026-03-30 (Monday) + 10 business days must skip Good Friday (Apr 3) and
  // Easter Monday (Apr 6) in addition to the two intervening weekends.
  assert.equal(calcAustracDueDate("2026-03-30"), "2026-04-15");
});

test("business days remaining is 0 on the due date, positive before, negative after", () => {
  const due = "2026-06-15";
  assert.equal(calcBusinessDaysRemaining(due, "2026-06-15"), 0);
  assert.equal(calcBusinessDaysRemaining(due, "2026-06-01"), 10);
  const dayAfter = addBusinessDays(utc(2026, 5, 15), 1);
  assert.equal(calcBusinessDaysRemaining(due, iso(dayAfter)), -1);
});

test("urgency classification matches the documented thresholds", () => {
  assert.equal(classifyAustracUrgency(-1), "overdue");
  assert.equal(classifyAustracUrgency(0), "urgent");
  assert.equal(classifyAustracUrgency(1), "urgent");
  assert.equal(classifyAustracUrgency(2), "soon");
  assert.equal(classifyAustracUrgency(3), "soon");
  assert.equal(classifyAustracUrgency(4), "ok");
  assert.equal(classifyAustracUrgency(10), "ok");
});
