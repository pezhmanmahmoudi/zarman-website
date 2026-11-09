/* eslint-disable @typescript-eslint/no-require-imports -- Offline accounting regression tests. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
const modules = new Map();
function compile(file) {
  if (modules.has(file)) return modules.get(file);
  const js = ts.transpileModule(fs.readFileSync(path.join(root, file), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const compiled = { exports: {} };
  vm.runInThisContext(`(function(require,module,exports){${js}\n})`, { filename: file })(
    id => id.startsWith("@/") ? compile(`${id.slice(2)}.ts`) : require(id), compiled, compiled.exports,
  );
  modules.set(file, compiled.exports);
  return compiled.exports;
}
const { buildProfitStatement, profitPeriodRange } = compile("lib/profit-statement.ts");
const { calcAccountingSnapshot } = compile("lib/accounting-engine.ts");
const accounts = [
  { id: "aud", name: "AUD cash", currency: "AUD", type: "bank" },
  { id: "irt", name: "IRT cash", currency: "IRT", type: "bank" },
];
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.000001, `${actual} != ${expected}`);
const capital = { id: "capital", currency: "AUD", amount: 1000, exchange_rate: 100, loan_type: "injection", funding_type: "equity", account_id: "aud", date: "2026-01-02" };
const withdrawal = { ...capital, id: "out", amount: 50, exchange_rate: 150, loan_type: "repayment", date: "2026-02-20" };
const sell = (id, date, aud, rate) => ({ id, type: "sell_aud", entry_type: "trade", amount_aud: aud, amount_toman: aud * rate, exchange_rate: rate, fee_aud: 0,
  date_gregorian: date, payer_account_id: "aud", receiver_account_id: "irt" });
const expense = { id: "exp", currency: "IRT", amount: 3000, exchange_rate: null, status: "paid", date: "2026-02-10", category: "rent", payer_account_id: "irt" };
const adjustment = { id: "adj", type: "buy_aud", entry_type: "adjustment", amount_aud: 10, amount_toman: 0, exchange_rate: 150, fee_aud: 0,
  date_gregorian: "2026-02-15", payer_account_id: null, receiver_account_id: "aud", date_jalali: "1404/11/26", notes: "تطبیق حساب" };
const ledgerRows = [sell("jan", "2026-01-20", 100, 120), sell("feb", "2026-02-12", 200, 150), adjustment];
const base = { firstDate: "2026-01-02", today: "2026-03-15", ledgerRows, expenses: [expense], ownerLoans: [capital, withdrawal], accounts, serviceFeeIncomeIRT: 0, pendingServiceFeeLiabilityIRT: 0 };
const build = (period, closingRate, openingRate = 0) => buildProfitStatement({ ...base, range: profitPeriodRange(period, base.firstDate, base.today), closingRate, openingRate });
const engine = (date, rate) => calcAccountingSnapshot(
  ledgerRows.filter(row => row.date_gregorian <= date), [expense].filter(row => row.date <= date),
  [capital, withdrawal].filter(row => row.date <= date), accounts, rate);

function assertStatementAdds(st) {
  const l = st.lines;
  for (const unit of ["aud", "irt"]) {
    near(l.trading[unit] + l.fees[unit] + l.expenses[unit], l.operating[unit]);
    near(l.operating[unit] + l.realizedFx[unit] + l.unpaidExpenses[unit] + l.adjustments[unit] + l.rateEffect[unit], st.realized[unit]);
    near(st.realized[unit] + l.inventory[unit] + l.translation[unit], st.net[unit]);
  }
  near(st.net.aud - st.owner.withdrawn.aud + st.owner.contributed.aud + st.owner.openingNetAssets.aud, st.owner.closingNetAssets.aud);
}

test("the whole-history statement matches the accounting snapshot and adds up in both currencies", () => {
  const st = build("all", 160);
  const snapshot = engine("9999-12-31", 160);
  assertStatementAdds(st);
  near(st.net.aud, snapshot.netProfitAUD);
  near(st.net.irt, snapshot.netProfitAUD * 160);
  near(st.owner.closingNetAssets.aud, snapshot.netAssetsAUD);
  near(st.owner.retained.aud, snapshot.retainedProfitAUD);
  near(st.tomanCostBasisProfitIRT, snapshot.totalProfit);
  near(-st.lines.expenses.aud, snapshot.totalExpensesAUD);
  near(st.lines.operating.irt, snapshot.operatingProfit);
  near(st.lines.adjustments.irt, 10 * 150);
  near(st.checks.balancesDifferenceAUD, 0);
  near(st.checks.stockDifferenceAUD, 0);
});

test("a month is the movement between two period-end snapshots at their own rates", () => {
  const st = build("2026-02", 160, 130);
  const opening = engine("2026-01-31", 130);
  const closing = engine("2026-02-28", 160);
  assertStatementAdds(st);
  near(st.net.aud, closing.netProfitAUD - opening.netProfitAUD);
  near(st.lines.trading.irt, closing.realizedTradingProfit - opening.realizedTradingProfit);
  near(st.owner.openingNetAssets.aud, opening.netAssetsAUD);
  near(st.owner.withdrawn.aud, 50);
  near(st.owner.contributed.aud, 0);
  assert.equal(st.expenses.categories.length, 1);
  near(st.expenses.categories[0].irt, 3000);
  near(st.expenses.categories[0].aud, 3000 / 160);
  assert.deepEqual(st.adjustmentRows, [{ id: "adj", date: "1404/11/26", account: "AUD cash", aud: 10, irt: 0, notes: "تطبیق حساب" }]);
  near(build("2026-01", 130, 130).adjustmentRows.length, 0);
});

test("the expense trend stops at the first recorded month and the requested period", () => {
  assert.deepEqual(build("2026-02", 160, 130).expenses.months.map(row => row.month), ["2026-02", "2026-01"]);
  assert.deepEqual(build("all", 160).expenses.months.map(row => row.month), ["2026-03", "2026-02", "2026-01"]);
  near(build("all", 160).expenses.months[1].irt, 3000);
});

test("months outside the recorded history fall back to the whole history", () => {
  for (const period of ["all", "2025-12", "2026-04", "1999-01"]) {
    assert.deepEqual(profitPeriodRange(period, base.firstDate, base.today), { period: "all", from: null, to: "9999-12-31", openingDate: null });
  }
  assert.deepEqual(profitPeriodRange("2026-02", base.firstDate, base.today), { period: "2026-02", from: "2026-02-01", to: "2026-02-28", openingDate: "2026-01-31" });
  assert.deepEqual(profitPeriodRange("2026-01", base.firstDate, base.today), { period: "2026-01", from: "2026-01-01", to: "2026-01-31", openingDate: "2025-12-31" });
});

test("toman holdings make the AUD profit fall when the buy rate rises", () => {
  const st = build("all", 160);
  const higher = engine("9999-12-31", 1160);
  near(st.rateSensitivityAUD, higher.netProfitAUD - st.net.aud);
  assert.ok(st.rateSensitivityAUD < 0);
});

test("the stock check flags dollars that moved without entering trading stock", () => {
  const broken = { ...sell("broken", "2026-02-13", 25, 0), amount_toman: 0, exchange_rate: 0 };
  const st = buildProfitStatement({ ...base, ledgerRows: [...ledgerRows, broken], range: profitPeriodRange("all", base.firstDate, base.today), closingRate: 160, openingRate: 0 });
  near(st.checks.stockDifferenceAUD, 25);
});

test("a statement is unavailable without a valid closing rate", () => {
  assert.equal(build("all", 0), null);
  assert.equal(build("all", Number.NaN), null);
});
