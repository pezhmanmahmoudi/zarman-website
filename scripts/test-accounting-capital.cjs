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
  const module = { exports: {} };
  vm.runInThisContext(`(function(require,module,exports){${js}\n})`, { filename: file })(
    id => id.startsWith("@/") ? compile(`${id.slice(2)}.ts`) : require(id), module, module.exports,
  );
  modules.set(file, module.exports);
  return module.exports;
}
const { calcAccountingSnapshot } = compile("lib/accounting-engine.ts");
const accounts = [
  { id: "aud", name: "AUD cash", currency: "AUD", type: "bank" },
  { id: "irt", name: "IRT cash", currency: "IRT", type: "bank" },
  { id: "credit", name: "Customer liability", currency: "AUD", type: "virtual" },
  { id: "transit", name: "Funds in transit", currency: "AUD", type: "transit" },
];
const funding = (overrides = {}) => ({ id: "fund", currency: "AUD", amount: 100,
  exchange_rate: 100, loan_type: "injection", account_id: "aud", date: "2026-01-01", ...overrides });
const trade = (overrides = {}) => ({ id: "trade", type: "sell_aud", entry_type: "trade",
  amount_aud: 100, amount_toman: 11000, exchange_rate: 110, fee_aud: 0,
  date_gregorian: "2026-01-02", payer_account_id: "aud", receiver_account_id: "irt", ...overrides });
const expense = (overrides = {}) => ({ id: "expense", currency: "AUD", amount: 100,
  exchange_rate: 100, status: "paid", date: "2026-01-01", category: "software", payer_account_id: "aud", ...overrides });
const snapshot = (ledger = [], expenses = [], loans = [], rate = 120, earned = 0, pending = 0) =>
  calcAccountingSnapshot(ledger, expenses, loans, accounts, rate, earned, pending);
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.000001, `${actual} != ${expected}`);

test("permanent capital remains capital when exchange rates change", () => {
  const a = snapshot([], [], [funding({ funding_type: "equity" })]);
  near(a.netAssetsAUD, 100);
  near(a.ownerCapitalNetAUD, 100);
  near(a.ownerCapitalHistoricalIRT, 10000);
  near(a.ownerLoanBalanceIRT, 0);
  near(a.fxTranslationGainLossIRT, 0);
  near(a.netProfitAUD, 0);
  near(a.audInventory, 100);
  near(a.wac, 100);
});

test("legacy funding defaults to a genuine loan, remeasured on remaining principal", () => {
  const a = snapshot([], [], [funding()]);
  near(a.ownerLoanBalanceIRT, 12000);
  near(a.ownerLoanBalanceAUD, 100);
  near(a.fxTranslationGainLossIRT, -2000);
  near(a.unrealizedInventoryGainIRT, 2000);
  near(a.totalProfit, 0);
  near(a.netAssetsAUD, 0);
  near(a.netProfitAUD, 0);
});

test("funded customer payout has a cost basis and does not create negative inventory", () => {
  const a = snapshot([trade()], [], [funding({ funding_type: "equity" })], 110);
  near(a.audInventory, 0);
  near(a.realizedTradingProfit, 1000);
  near(a.totalAssetValueIRT, 11000);
  assert.equal(a.accountingWarnings.length, 0);
});

test("startup expenses consume funded cash exactly once despite mirrored ledger entries", () => {
  const mirrors = [trade({ id: "mirror-expense", entry_type: "expense" }), trade({ id: "mirror-capital", entry_type: "owner_loan" })];
  const a = snapshot(mirrors, [expense()], [funding({ funding_type: "equity" })]);
  near(a.drawerBalances.aud.balance, 0);
  near(a.audInventory, 0);
  near(a.paidExpensesIRT, 10000);
  near(a.netProfitAUD, -100);
  near(a.fxTranslationGainLossIRT, 0);
});

test("withdrawals reduce retained earnings but are added back to cumulative profit", () => {
  const receipt = trade({ id: "income", entry_type: "adjustment", type: "transfer", amount_aud: 500,
    amount_toman: 0, payer_account_id: null, receiver_account_id: "aud" });
  const a = snapshot([receipt], [], [funding({ amount: 1000, funding_type: "equity" }),
    funding({ id: "withdraw", amount: 50, funding_type: "equity", loan_type: "repayment", date: "2026-01-03" })]);
  near(a.totalAssetsAUD, 1450);
  near(a.ownerCapitalContributedAUD, 1000);
  near(a.ownerCapitalWithdrawnAUD, 50);
  near(a.ownerCapitalNetAUD, 950);
  near(a.netProfitAUD, 500);
  near(a.retainedProfitAUD, 450);
});

test("fully repaid loans have zero principal at a different repayment rate", () => {
  const a = snapshot([], [], [funding(), funding({ id: "repay", loan_type: "repayment", exchange_rate: 110, date: "2026-01-03" })]);
  near(a.ownerLoanBalanceIRT, 0);
  near(a.ownerLoanBalanceAUD, 0);
  near(a.fxTranslationGainLossIRT, 0);
  near(a.netAssetsAUD, 0);
  near(a.realizedFXGainLossIRT, 0); // AUD asset and matching debt gains/losses offset.
});

test("cross-currency repayments settle the specified bank without creating AUD cash", () => {
  const a = snapshot([], [], [funding(), funding({ id: "repay", loan_type: "repayment", exchange_rate: 110,
    date: "2026-01-03", account_id: "irt", settlement_currency: "IRT", settlement_amount: 11000 })]);
  near(a.ownerLoanBalanceAUD, 0);
  near(a.drawerBalances.aud.balance, 100);
  near(a.drawerBalances.irt.balance, -11000);
  assert.equal(a.accountingWarnings.length, 0);
});

test("cross-currency cash needs an explicit settlement amount", () => {
  const a = snapshot([], [], [funding({ account_id: "irt", settlement_currency: "IRT" })]);
  near(a.drawerBalances.irt.balance, 0);
  assert.ok(a.accountingWarnings.some(message => message.includes("settlement amount")));
});

test("capital classification without cash effect does not duplicate an existing receipt", () => {
  const receipt = trade({ type: "buy_aud", entry_type: "adjustment", amount_toman: 0, exchange_rate: 100,
    payer_account_id: null, receiver_account_id: "aud" });
  const a = snapshot([receipt], [], [funding({ funding_type: "equity", cash_effect: false })]);
  near(a.drawerBalances.aud.balance, 100);
  near(a.audInventory, 100);
  near(a.netProfitAUD, 0);
});

test("uncovered sales defer profit and realise it when the short is covered", () => {
  const sale = trade({ date_gregorian: "2026-01-01" });
  const beforeCover = snapshot([sale]);
  near(beforeCover.audInventory, -100);
  near(beforeCover.realizedTradingProfit, 0);
  near(beforeCover.wac, 110);
  assert.ok(beforeCover.accountingWarnings.some(message => message.includes("short by 100.00")));
  const buy = trade({ id: "cover", type: "buy_aud", amount_aud: 150, amount_toman: 15000,
    exchange_rate: 100, date_gregorian: "2026-01-02", payer_account_id: "irt", receiver_account_id: "aud" });
  const a = snapshot([sale, buy]);
  near(a.audInventory, 50);
  near(a.wac, 100);
  near(a.realizedTradingProfit, 1000);
});

test("customer liabilities, transit funds and unpaid expenses enter net asset reconciliation", () => {
  const liability = trade({ id: "credit", entry_type: "adjustment", amount_aud: 10, amount_toman: 0,
    payer_account_id: "credit", receiver_account_id: null });
  const a = snapshot([liability], [expense({ amount: 5, status: "pending" })], [
    funding({ funding_type: "equity" }), funding({ id: "transit-funding", amount: 20, funding_type: "equity", account_id: "transit" }),
  ]);
  near(a.totalAssetsAUD, 120);
  near(a.customerAccountPositionAUD, -10);
  near(a.netAssetsAUD, 105);
  near(a.netProfitAUD, -15);
});

test("unearned request fee cash is excluded from profit and trading inventory", () => {
  const feeReceipt = trade({ entry_type: "adjustment", type: "transfer", amount_aud: 20, amount_toman: 0,
    payer_account_id: null, receiver_account_id: "aud", request_fee_entry_id: "fee" });
  const a = snapshot([feeReceipt], [], [], 100, 0, 2000);
  near(a.drawerBalances.aud.balance, 20);
  near(a.audInventory, 0);
  near(a.wac, 0);
  near(a.feeIncomeIRT, 0);
  near(a.netProfitAUD, 0);
});

test("invalid current rates leave AUD metrics unavailable", () => {
  for (const rate of [0, -10, Number.NaN, Number.POSITIVE_INFINITY]) {
    const a = snapshot([], [], [funding({ funding_type: "equity" })], rate);
    for (const key of ["netAssetsAUD", "totalAssetsAUD", "ownerLoanBalanceAUD", "netProfitAUD", "retainedProfitAUD", "ownerCapitalNetAUD"]) {
      assert.equal(a[key], null, key);
    }
    assert.ok(a.accountingWarnings.length > 0);
  }
});

test("IRT permanent capital needs its transaction rate for historical AUD contribution", () => {
  const a = snapshot([], [], [funding({ currency: "IRT", amount: 10000, account_id: "irt", funding_type: "equity", exchange_rate: null })]);
  assert.equal(a.netProfitAUD, null);
  assert.equal(a.ownerCapitalNetAUD, null);
  near(a.ownerCapitalHistoricalIRT, 10000);
  assert.ok(a.accountingWarnings.some(message => message.includes("IRT owner capital")));
  const complete = snapshot([], [], [funding({ currency: "IRT", amount: 10000, account_id: "irt", funding_type: "equity", exchange_rate: 100 })]);
  near(complete.ownerCapitalNetAUD, 100);
});

test("transfer fees consume cash and reduce profit without treating principal as an expense", () => {
  const transfer = trade({ entry_type: "transfer", type: "transfer", amount_aud: 50, amount_toman: 0,
    exchange_rate: 100, fee_aud: 2, receiver_account_id: "transit" });
  const a = snapshot([transfer], [], [funding({ funding_type: "equity" })], 100);
  near(a.audInventory, 98);
  near(a.totalAssetsAUD, 98);
  near(a.transferFeesIRT, 200);
  near(a.operatingProfit, -200);
  near(a.netProfitAUD, -2);
});

test("an unsettled IRT payable reduces net assets without changing a reconciled bank", () => {
  const withPayable = [...accounts, { id: "irt-credit", name: "Unsettled IRT", currency: "IRT", type: "virtual" }];
  const payable = trade({ entry_type: "adjustment", amount_aud: 0, amount_toman: 3000000,
    payer_account_id: "irt-credit", receiver_account_id: null, exchange_rate: 0 });
  const a = calcAccountingSnapshot([payable], [], [funding({ funding_type: "equity", amount: 1000 })], withPayable, 172000);
  near(a.drawerBalances.irt.balance, 0);
  near(a.drawerBalances["irt-credit"].balance, -3000000);
  near(a.totalAssetsAUD, 1000);
  near(a.netAssetsAUD, 1000 - 3000000 / 172000);
  near(a.netProfitAUD, -3000000 / 172000);
});

test("same-day owner withdrawals follow the cash settlement instead of creating a false short", () => {
  const buy = trade({ type: "buy_aud", exchange_rate: 100, amount_toman: 10000,
    payer_account_id: "irt", receiver_account_id: "aud" });
  const a = snapshot([buy], [expense()], [funding({ funding_type: "equity" }),
    funding({ id: "withdraw", loan_type: "repayment", funding_type: "equity", date: "2026-01-02" })]);
  near(a.audInventory, 0);
  assert.ok(!a.accountingWarnings.some(message => message.includes("inventory is short")));
});

test("a trade direction inconsistent with its cash accounts is reported without rewriting balances", () => {
  const a = snapshot([trade({ type: "buy_aud" })]);
  near(a.drawerBalances.aud.balance, -100);
  assert.ok(a.accountingWarnings.some(message => message.includes("review trade versus settlement classification")));
});

test("fully mapped cash direction corrects opposite trade labels and uses the matching fee sign", () => {
  const a = snapshot([trade({ type: "buy_aud", amount_toman: 12100, fee_aud: 10 })], [], [funding({ funding_type: "equity" })], 110);
  near(a.drawerBalances.aud.balance, 0);
  near(a.drawerBalances.irt.balance, 12100);
  near(a.audInventory, 0);
  near(a.realizedTradingProfit, 1000); // Sell principal = 12100 - 10*110.
  near(a.feeIncomeIRT, 1100);
  assert.ok(a.accountingWarnings.some(message => message.includes("recorded type implies")));
});

test("AUD customer-credit settlement consumes no second trading stock or profit, while preserving its recorded fee", () => {
  const settlement = trade({ amount_aud: 60, amount_toman: 7700, fee_aud: 10, receiver_account_id: "credit" });
  const a = snapshot([settlement], [], [funding({ funding_type: "equity" })], 110);
  near(a.drawerBalances.aud.balance, 40);
  near(a.drawerBalances.credit.balance, 60);
  near(a.audInventory, 100);
  near(a.wac, 100);
  near(a.realizedTradingProfit, 0);
  near(a.feeIncomeIRT, 1100);
  near(a.netAssetsAUD, 100);
});

test("normal mapped cross-currency buy and sell retain principal cost and fee accounting", () => {
  const buy = trade({ id: "buy", type: "buy_aud", date_gregorian: "2026-01-01", exchange_rate: 100,
    amount_toman: 9000, fee_aud: 10, payer_account_id: "irt", receiver_account_id: "aud" });
  const sell = trade({ id: "sell", amount_toman: 12100, fee_aud: 10 });
  const a = snapshot([buy, sell], [], [], 110);
  near(a.audInventory, 0);
  near(a.realizedTradingProfit, 1000);
  near(a.feeIncomeIRT, 2100);
  near(a.drawerBalances.irt.balance, 3100);
  near(a.drawerBalances.aud.balance, 0);
  near(a.netProfitAUD, 3100 / 110);
});
