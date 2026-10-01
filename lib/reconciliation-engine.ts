/**
 * lib/reconciliation-engine.ts
 *
 * Point-in-time account balances for monthly reconciliation audits.
 * Pure function — reuses the same double-entry logic as the live accounting
 * snapshot, just restricted to rows dated on/before a chosen "as of" date.
 */

import {
  calcAccountingSnapshot,
  type LedgerRowInput,
  type ExpenseRowInput,
  type OwnerLoanRowInput,
  type AccountMeta,
} from "@/lib/accounting-engine";

export function calcAccountBalancesAsOf(
  ledgerRows: LedgerRowInput[],
  expenses: ExpenseRowInput[],
  ownerLoans: OwnerLoanRowInput[],
  accountsMeta: AccountMeta[],
  asOfDate: string,
  currentBuyRate: number,
): Record<string, number> {
  const ledgerCutoff = ledgerRows.filter(r => r.date_gregorian <= asOfDate);
  const expenseCutoff = expenses.filter(e => e.date <= asOfDate);
  const loanCutoff = ownerLoans.filter(l => l.date <= asOfDate);

  const snapshot = calcAccountingSnapshot(ledgerCutoff, expenseCutoff, loanCutoff, accountsMeta, currentBuyRate);

  const balances: Record<string, number> = {};
  Object.values(snapshot.drawerBalances).forEach(drawer => {
    balances[drawer.accountId] = drawer.balance;
  });
  return balances;
}
