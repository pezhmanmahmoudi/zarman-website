// lib/compliance/risk-category.ts
// Transaction risk categories (A / B / C) and the release gate that follows from
// them. Thresholds are the operator's current AML/CTF settings; change them here only.

export type ComplianceCategory = "A" | "B" | "C";
export type FundingMethod = "bank" | "cash";

export const CATEGORY_THRESHOLDS = {
  /** Bank-funded: B from 10,000, C from 20,000. */
  bankB: 10_000,
  bankC: 20_000,
  /** Cash-funded: B from 7,000, C from 10,000. */
  cashB: 7_000,
  cashC: 10_000,
  /** Rolling 12-month customer total (including this transaction) at which C applies. */
  cumulativeC: 100_000,
} as const;

export type CategoryTrigger = { code: string; label: string; category: "B" | "C" };

export type ClassificationInput = {
  amountAud: number;
  fundingMethod: FundingMethod;
  /** Customer's total over the rolling 12 months INCLUDING this transaction. */
  rolling12mAud: number;
  /** Unresolved (not cleared as false positive) potential or confirmed DFAT match. */
  sanctionsMatch: boolean;
  /** Unresolved internal/vendor PEP match, or a customer self-declaration of "yes". */
  pepMatch: boolean;
  /** Admin-set escalation for red flags (third-party funding, structuring...). */
  manualEscalation?: "B" | "C" | null;
};

export type Classification = {
  category: ComplianceCategory;
  triggers: CategoryTrigger[];
  /** The vendor PEP lookup is only needed above category A or when a PEP signal exists. */
  pepVendorRequired: (internalPepHit: boolean, selfDeclaredYes: boolean) => boolean;
};

const aud = (value: number) => `AUD ${value.toLocaleString("en-AU")}`;

export function classifyTransaction(input: ClassificationInput): Classification {
  const t = CATEGORY_THRESHOLDS;
  const triggers: CategoryTrigger[] = [];
  const { amountAud, fundingMethod } = input;

  if (fundingMethod === "bank") {
    if (amountAud >= t.bankC) triggers.push({ code: "bank_amount_c", label: `Bank-funded amount ${aud(t.bankC)} or more`, category: "C" });
    else if (amountAud >= t.bankB) triggers.push({ code: "bank_amount_b", label: `Bank-funded amount ${aud(t.bankB)} to under ${aud(t.bankC)}`, category: "B" });
  } else {
    if (amountAud >= t.cashC) triggers.push({ code: "cash_amount_c", label: `Cash-funded amount ${aud(t.cashC)} or more`, category: "C" });
    else if (amountAud >= t.cashB) triggers.push({ code: "cash_amount_b", label: `Cash-funded amount ${aud(t.cashB)} to under ${aud(t.cashC)}`, category: "B" });
  }
  if (input.rolling12mAud >= t.cumulativeC) triggers.push({ code: "cumulative_12m", label: `Rolling 12-month total ${aud(t.cumulativeC)} or more`, category: "C" });
  if (input.sanctionsMatch) triggers.push({ code: "sanctions_match", label: "Unresolved DFAT sanctions match", category: "C" });
  if (input.pepMatch) triggers.push({ code: "pep_match", label: "Unresolved PEP match or PEP self-declaration", category: "C" });
  if (input.manualEscalation) triggers.push({ code: "manual_escalation", label: `Manually escalated to category ${input.manualEscalation}`, category: input.manualEscalation });

  const category: ComplianceCategory = triggers.some(item => item.category === "C") ? "C" : triggers.length ? "B" : "A";
  return {
    category,
    triggers,
    pepVendorRequired: (internalPepHit, selfDeclaredYes) => category !== "A" || internalPepHit || selfDeclaredYes,
  };
}

// ── Release gate ───────────────────────────────────────────────────────────────

export type ScreeningOutcome = "clear" | "potential_match" | "failed" | "declared_yes" | "declared_no" | "waived";
export type ScreeningDecision = "pending" | "false_positive" | "confirmed_match" | null;

export type ScreeningState = {
  outcome: ScreeningOutcome;
  decision: ScreeningDecision;
};

export type GateInput = {
  category: ComplianceCategory;
  customerSanctions: ScreeningState | null;
  beneficiarySanctions: ScreeningState | null;
  customerPepInternal: ScreeningState | null;
  beneficiaryPepInternal: ScreeningState | null;
  selfDeclaration: ScreeningState | null;
  pepVendorRequired: boolean;
  pepVendor: ScreeningState | null;
  /** "approved" is required for category C. */
  ecddStatus: "not_required" | "pending" | "approved" | "refused";
};

export function isResolved(state: ScreeningState | null): boolean {
  if (!state) return false;
  if (state.outcome === "potential_match") return state.decision === "false_positive";
  if (state.outcome === "declared_yes") return state.decision === "false_positive" || state.decision === "confirmed_match";
  return state.outcome !== "failed";
}

export function hasUnresolvedMatch(state: ScreeningState | null): boolean {
  if (!state) return false;
  if (state.outcome === "potential_match") return state.decision !== "false_positive";
  if (state.outcome === "declared_yes") return state.decision === null || state.decision === "pending";
  return false;
}

/** Reasons the transaction may not be approved or settled yet. Empty means clear. */
export function releaseBlockers(input: GateInput): string[] {
  const reasons: string[] = [];
  // A confirmed sanctions match is a hard stop. A confirmed PEP is permitted, but only
  // through ECDD approval (category C), so it is not a blocker on its own.
  const need = (state: ScreeningState | null, label: string, confirmedStops: boolean) => {
    if (!state) reasons.push(`${label} has not been screened.`);
    else if (state.outcome === "failed") reasons.push(`${label} screening failed; run it again.`);
    else if (state.outcome === "potential_match" && state.decision === "confirmed_match") {
      if (confirmedStops) reasons.push(`${label}: CONFIRMED match. This transaction must not proceed.`);
    } else if (hasUnresolvedMatch(state)) reasons.push(`${label} has a potential match awaiting admin review.`);
  };
  need(input.customerSanctions, "Customer sanctions check (DFAT)", true);
  need(input.beneficiarySanctions, "Beneficiary sanctions check (DFAT)", true);
  need(input.customerPepInternal, "Customer PEP check", false);
  need(input.beneficiaryPepInternal, "Beneficiary PEP check", false);

  if (!input.selfDeclaration) reasons.push("Customer PEP self-declaration is not on record.");
  else if (hasUnresolvedMatch(input.selfDeclaration)) reasons.push("Customer declared PEP status; admin review is required.");

  // The vendor lookup is only mandatory above category A (or on a PEP signal), but if one was
  // run, its result always counts.
  const vendor = input.pepVendor;
  if (input.pepVendorRequired && (!vendor || vendor.outcome === "failed")) {
    reasons.push("Vendor PEP check is required for this transaction.");
  } else if (vendor && vendor.outcome === "potential_match") {
    if (vendor.decision === "confirmed_match") reasons.push("Vendor check: CONFIRMED match. This transaction must not proceed.");
    else if (hasUnresolvedMatch(vendor)) reasons.push("Vendor check returned a potential match awaiting admin review.");
  }

  if (input.category === "C" && input.ecddStatus !== "approved") {
    reasons.push(input.ecddStatus === "refused"
      ? "Category C: ECDD approval was refused."
      : "Category C: Compliance Officer ECDD approval is required.");
  }
  return reasons;
}
