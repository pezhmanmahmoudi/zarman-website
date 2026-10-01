import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { after, before, describe, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import ts from "typescript";

const projectRoot = new URL("../", import.meta.url);
const read = (file) => readFileSync(new URL(file, projectRoot), "utf8");

const compiled = { exports: {} };
const helperJs = ts.transpileModule(read("lib/iran-bank-transfer-fees.ts"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
vm.runInThisContext(`(function(module,exports){${helperJs}\n})`)(compiled, compiled.exports);
const { calcIranBankTransferFee } = compiled.exports;

describe("announced 1405 Iranian transfer fees", () => {
  test("calculates the frontend fee floors and caps in toman", () => {
    assert.equal(calcIranBankTransferFee(100, "free"), 0);
    assert.equal(calcIranBankTransferFee(100, "pol"), 800);
    assert.equal(calcIranBankTransferFee(10_000_000, "pol"), 2_000);
    assert.equal(calcIranBankTransferFee(1_000_000, "paya"), 400);
    assert.equal(calcIranBankTransferFee(5_000_000, "paya"), 500);
    assert.equal(calcIranBankTransferFee(200_000_000, "paya"), 12_000);
    assert.equal(calcIranBankTransferFee(1_000_000, "satna"), 200);
    assert.equal(calcIranBankTransferFee(300_000_000, "satna"), 50_000);
  });

  describe("database accrual normalization", { concurrency: false }, () => {
    let db;
    const account = "10000000-0000-4000-8000-000000000001";

    before(async () => {
      db = new PGlite();
      await db.exec(read("scripts/fixtures/bank-fees.sql"));
      await db.exec(read("supabase/migrations/20260803_16_bank_transfer_fee_accruals.sql"));
      await db.exec(read("supabase/migrations/20260924_36_iran_bank_fee_1405.sql"));
      await db.query(
        "INSERT INTO bank_accounts(id, account_name, currency) VALUES($1, 'Synthetic IRT', 'IRT')",
        [account],
      );
    });

    after(async () => db?.close());

    test("overrides stale RPC estimates before inserting accruals", async () => {
      const cases = [
        ["pol", 100, 800],
        ["paya", 1_000_000, 400],
        ["paya", 200_000_000, 12_000],
        ["satna", 300_000_000, 50_000],
      ];

      for (const [method, amount, expected] of cases) {
        const transaction = (await db.query("INSERT INTO transactions DEFAULT VALUES RETURNING id")).rows[0];
        const result = await db.query(`INSERT INTO bank_transfer_fee_accruals
          (transaction_id, fee_month, transfer_method, transaction_amount_toman, fee_amount_toman, payer_account_id)
          VALUES ($1, current_date, $2, $3, 999999, $4)
          RETURNING fee_amount_toman`, [transaction.id, method, amount, account]);
        assert.equal(Number(result.rows[0].fee_amount_toman), expected);
      }
    });
  });
});
