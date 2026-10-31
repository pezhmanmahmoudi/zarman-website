// Offline tests for the internal screening engine and the A/B/C release rules.
// Run: node --test scripts/test-compliance-engine.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { test } from "node:test";
import ts from "typescript";

const root = new URL("../", import.meta.url);
function compile(file) {
  const js = ts.transpileModule(readFileSync(new URL(file, root), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const mod = { exports: {} };
  vm.runInThisContext(`(function(require,module,exports){${js}\n})`, { filename: fileURLToPath(new URL(file, root)) })(
    id => { throw new Error(`Unexpected dependency: ${id}`); }, mod, mod.exports);
  return mod.exports;
}

const matching = compile("lib/compliance/name-matching.ts");
const risk = compile("lib/compliance/risk-category.ts");
const { NameIndex, SANCTIONS_SEARCH, PEP_SEARCH, phoneticKey, compareDob } = matching;

const index = new NameIndex([
  { id: "1", name: "MOHAMMAD HASSAN AKHUND", dobText: "1945, 1946, 1947, 1948, 1949, 1950, 1955" },
  { id: "2", name: "Hossein SALAMI", dobText: "1960" },
  { id: "3", name: "Hoseyn SALAMI", dobText: "1960" },
  { id: "4", name: "QASEM SOLEIMANI", dobText: "1957-03-11" },
  { id: "5", name: "Qasem Sulaymani", dobText: "1957-03-11" },
  { id: "6", name: "محمد حسن آخوند", dobText: null },
  { id: "7", name: "ALI AKBAR VELAYATI", dobText: null },
]);
const ids = hits => hits.map(hit => hit.id);

test("spelling variants of Iranian names share a phonetic key", () => {
  assert.equal(phoneticKey("Mohammad"), phoneticKey("Muhammad"));
  assert.equal(phoneticKey("Mohammad"), phoneticKey("Mohamad"));
  assert.equal(phoneticKey("Mohammad"), phoneticKey("Mohammed"));
  assert.equal(phoneticKey("Hossein"), phoneticKey("Hussein"));
  assert.equal(phoneticKey("Hossein"), phoneticKey("Hosein"));
  assert.notEqual(phoneticKey("Hassan"), phoneticKey("Hossein"));
});

test("fuzzy match finds transliteration variants and ignores word order", () => {
  assert.ok(ids(index.search("Muhammad Hasan Akhund", null, SANCTIONS_SEARCH)).includes("1"));
  assert.ok(ids(index.search("Akhund Mohamad Hassan", null, SANCTIONS_SEARCH)).includes("1"));
  assert.ok(ids(index.search("Hussein Salami", null, SANCTIONS_SEARCH)).includes("2"));
  assert.ok(ids(index.search("Ghasem Soleimani", null, SANCTIONS_SEARCH)).includes("4"));
});

test("identical names score 100 and are strong", () => {
  const [hit] = index.search("Qasem Soleimani", null, SANCTIONS_SEARCH);
  assert.equal(hit.percent, 100);
  assert.equal(hit.strength, "strong");
});

test("unrelated names and common first names alone do not match", () => {
  assert.deepEqual(index.search("Sara Johnson", "1990-01-01", SANCTIONS_SEARCH), []);
  assert.deepEqual(index.search("Mohammad Rezaei", null, SANCTIONS_SEARCH), []);
  assert.deepEqual(index.search("Ali", null, SANCTIONS_SEARCH), []);
});

test("date of birth corroborates or downgrades but never silently hides an exact name", () => {
  assert.equal(compareDob("1950-06-01", "1945, 1946, 1950"), "match");
  assert.equal(compareDob("1990-06-01", "1945, 1946, 1950"), "mismatch");
  assert.equal(compareDob("1990-06-01", null), "unknown");
  const exact = index.search("Mohammad Hassan Akhund", "1990-05-05", SANCTIONS_SEARCH);
  assert.equal(exact[0].dob, "mismatch");
  assert.equal(exact[0].strength, "possible");
  // A merely similar name with a clearly different DOB is dropped.
  assert.deepEqual(index.search("Mohammad Hassan Akhundi", "1990-05-05", SANCTIONS_SEARCH).filter(h => h.id === "1" && h.percent < 92), []);
});

test("Persian-script names match without transliteration", () => {
  assert.ok(ids(index.search("محمد حسن آخوند", null, SANCTIONS_SEARCH)).includes("6"));
  assert.deepEqual(ids(index.search("علی رضایی", null, SANCTIONS_SEARCH)), []);
});

test("PEP thresholds are stricter than sanctions thresholds", () => {
  assert.ok(PEP_SEARCH.threshold > SANCTIONS_SEARCH.threshold);
  assert.ok(ids(index.search("Ali Akbar Velayati", null, PEP_SEARCH)).includes("7"));
});

const classify = (amountAud, fundingMethod, extra = {}) =>
  risk.classifyTransaction({ amountAud, fundingMethod, rolling12mAud: amountAud, sanctionsMatch: false, pepMatch: false, ...extra }).category;

test("bank-funded categories: A under 10,000; B 10,000-19,999.99; C from 20,000", () => {
  assert.equal(classify(9_999.99, "bank"), "A");
  assert.equal(classify(10_000, "bank"), "B");
  assert.equal(classify(19_999.99, "bank"), "B");
  assert.equal(classify(20_000, "bank"), "C");
});

test("cash-funded categories: A under 7,000; B 7,000-9,999.99; C from 10,000", () => {
  assert.equal(classify(6_999.99, "cash"), "A");
  assert.equal(classify(7_000, "cash"), "B");
  assert.equal(classify(9_999.99, "cash"), "B");
  assert.equal(classify(10_000, "cash"), "C");
});

test("C applies for a 100,000 rolling 12-month total, an unresolved match, or manual escalation", () => {
  assert.equal(classify(500, "bank", { rolling12mAud: 100_000 }), "C");
  assert.equal(classify(500, "bank", { rolling12mAud: 99_999 }), "A");
  assert.equal(classify(500, "bank", { sanctionsMatch: true }), "C");
  assert.equal(classify(500, "bank", { pepMatch: true }), "C");
  assert.equal(classify(500, "bank", { manualEscalation: "B" }), "B");
  assert.equal(classify(500, "bank", { manualEscalation: "C" }), "C");
});

test("vendor PEP check is only required above category A or on a PEP signal", () => {
  const a = risk.classifyTransaction({ amountAud: 500, fundingMethod: "bank", rolling12mAud: 500, sanctionsMatch: false, pepMatch: false });
  assert.equal(a.pepVendorRequired(false, false), false);
  assert.equal(a.pepVendorRequired(true, false), true);
  assert.equal(a.pepVendorRequired(false, true), true);
  const b = risk.classifyTransaction({ amountAud: 12_000, fundingMethod: "bank", rolling12mAud: 12_000, sanctionsMatch: false, pepMatch: false });
  assert.equal(b.pepVendorRequired(false, false), true);
});

const clear = { outcome: "clear", decision: null };
const base = {
  category: "A", customerSanctions: clear, beneficiarySanctions: clear, customerPepInternal: clear, beneficiaryPepInternal: clear,
  selfDeclaration: { outcome: "declared_no", decision: null }, pepVendorRequired: false, pepVendor: null, ecddStatus: "not_required",
};

test("a clean category A transaction has no release blockers", () => {
  assert.deepEqual(risk.releaseBlockers(base), []);
});

test("unscreened parties, unresolved matches and a missing declaration block release", () => {
  assert.equal(risk.releaseBlockers({ ...base, beneficiarySanctions: null }).length, 1);
  assert.match(risk.releaseBlockers({ ...base, customerSanctions: { outcome: "potential_match", decision: "pending" } })[0], /awaiting admin review/);
  assert.equal(risk.releaseBlockers({ ...base, customerSanctions: { outcome: "potential_match", decision: "false_positive" } }).length, 0);
  assert.match(risk.releaseBlockers({ ...base, customerSanctions: { outcome: "potential_match", decision: "confirmed_match" } })[0], /CONFIRMED/);
  assert.match(risk.releaseBlockers({ ...base, selfDeclaration: null })[0], /self-declaration/);
  assert.match(risk.releaseBlockers({ ...base, selfDeclaration: { outcome: "declared_yes", decision: "pending" } })[0], /declared PEP/);
});

test("a confirmed PEP is not a hard stop but category C still needs ECDD approval", () => {
  const confirmedPep = { ...base, category: "C", customerPepInternal: { outcome: "potential_match", decision: "confirmed_match" }, ecddStatus: "pending" };
  assert.deepEqual(risk.releaseBlockers(confirmedPep), ["Category C: Compliance Officer ECDD approval is required."]);
  assert.deepEqual(risk.releaseBlockers({ ...confirmedPep, ecddStatus: "approved" }), []);
  assert.match(risk.releaseBlockers({ ...confirmedPep, ecddStatus: "refused" })[0], /refused/);
});

test("vendor PEP is required above A but a waiver or completed run satisfies it", () => {
  const needsVendor = { ...base, category: "B", pepVendorRequired: true };
  assert.match(risk.releaseBlockers(needsVendor)[0], /Vendor PEP check is required/);
  assert.deepEqual(risk.releaseBlockers({ ...needsVendor, pepVendor: { outcome: "clear", decision: null } }), []);
  assert.deepEqual(risk.releaseBlockers({ ...needsVendor, pepVendor: { outcome: "waived", decision: null } }), []);
  assert.match(risk.releaseBlockers({ ...needsVendor, pepVendor: { outcome: "potential_match", decision: "pending" } })[0], /awaiting admin review/);
  // An optional vendor run that found a match still blocks even when not required.
  assert.equal(risk.releaseBlockers({ ...base, pepVendor: { outcome: "potential_match", decision: "pending" } }).length, 1);
});

test("common given names alone never match: an unmatched distinctive family name sinks the score", () => {
  // Mimics the real list: many listings share Mohammad / Hussein, only one is "Jamil MUKULU".
  const filler = [];
  for (let i = 0; i < 40; i++) filler.push({ id: `m${i}`, name: `Mohammad Fillername${i}${"x".repeat(i % 4)}`, dobText: null });
  for (let i = 0; i < 25; i++) filler.push({ id: `h${i}`, name: `Hussein Otherperson${i}${"z".repeat(i % 3)}`, dobText: null });
  for (let i = 0; i < 25; i++) filler.push({ id: `a${i}`, name: `Ali Reza Lastname${i}${"q".repeat(i % 3)}`, dobText: null });
  const real = new NameIndex([...filler, { id: "mukulu", name: "Hussein Muhammad", dobText: "1965" }, { id: "target", name: "Mohammad Hossein Chinaee Real", dobText: null }]);
  // The reported false positive: two common given names match, the family name does not.
  assert.deepEqual(ids(real.search("Mohammad hossein Chinaei", null, SANCTIONS_SEARCH)).filter(id => id === "mukulu"), []);
  // The same two names as a whole query are still a legitimate match for that listing.
  assert.ok(ids(real.search("Muhammad Hussein", null, SANCTIONS_SEARCH)).includes("mukulu"));
  // A genuine spelling variant of a full listed name is still found.
  assert.ok(ids(real.search("Mohammad Hossein Chinaei Real", null, SANCTIONS_SEARCH)).includes("target"));
});

test("low-relevance listings only report strong, corroborated matches", () => {
  const idx = new NameIndex([
    { id: "normal", name: "Hossein Salami", dobText: "1960" },
    { id: "low", name: "Ivan Petrovich Sidorov", dobText: "1970", strict: true },
    { id: "low-nodob", name: "Sergei Ivanovich Volkov", dobText: null, strict: true },
  ]);
  const found = (name, dob) => ids(idx.search(name, dob, SANCTIONS_SEARCH));
  // Identical name with a matching year: reported.
  assert.ok(found("Ivan Petrovich Sidorov", "1970-05-05").includes("low"));
  // Identical name, DOB unknown (e.g. a beneficiary): still reported, it is an exact name.
  assert.ok(found("Ivan Petrovich Sidorov", null).includes("low"));
  // A close but not identical name is not reported without a DOB match...
  assert.ok(!found("Ivan Petrovic Sidorof Junior", null).includes("low"));
  assert.ok(!found("Ivan Sidorov", null).includes("low"));
  // ...and a different DOB never reports a low-relevance row, even for the identical name.
  assert.ok(!found("Ivan Petrovich Sidorov", "1985-01-01").includes("low"));
  // Normal rows keep the regular sensitivity.
  assert.ok(found("Hussein Salami", null).includes("normal"));
  assert.ok(found("Sergei Ivanovich Volkov", null).includes("low-nodob"));
});
