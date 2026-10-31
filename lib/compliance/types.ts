// lib/compliance/types.ts
// Client-safe types shared by the compliance services, server actions and admin UI.

import type { ComplianceCategory, CategoryTrigger, FundingMethod, ScreeningDecision, ScreeningOutcome } from "@/lib/compliance/risk-category";
import type { DobComparison } from "@/lib/compliance/name-matching";

export type ScreeningParty = "customer" | "beneficiary";
export type ScreeningKind = "sanctions" | "pep" | "combined";
export type ScreeningMethod = "internal_dfat" | "internal_pep" | "vendor_namescan" | "self_declaration";

export type ScreeningMatch = {
  source: "dfat" | "pep";
  /** DFAT reference group, or Wikidata Q-id for PEPs. */
  reference: string;
  listedName: string;
  matchedName: string;
  entryType: string | null;
  percent: number;
  strength: "strong" | "possible";
  dob: DobComparison;
  listedDob: string | null;
  /** Display-ready extra facts (citizenship, listing information, positions, ...). */
  details: Record<string, string | null>;
};

export type ScreeningRecord = {
  id: string;
  request_id: string | null;
  profile_id: string | null;
  party: ScreeningParty;
  check_kind: ScreeningKind;
  method: ScreeningMethod;
  subject_name: string;
  subject_dob: string | null;
  outcome: ScreeningOutcome;
  top_score: number | null;
  matches: ScreeningMatch[];
  list_import_id: string | null;
  vendor_reference: string | null;
  note: string | null;
  performed_by: string | null;
  performed_at: string;
  decision: ScreeningDecision;
  decision_reason: string | null;
  decided_by: string | null;
  decided_at: string | null;
};

export type ListStatus = {
  kind: "dfat" | "pep_wikidata";
  importId: string | null;
  entryCount: number;
  latestControlDate: string | null;
  importedAt: string | null;
  sourceName: string | null;
  notes: string | null;
};

export type DvsSummary = {
  applicable: boolean;
  status: string;
  method: string | null;
  outcome: string | null;
  checkedAt: string | null;
};

export type SelfDeclarationSummary = {
  answered: boolean;
  isPep: boolean | null;
  relation: string | null;
  details: string | null;
  declaredAt: string | null;
  source: string | null;
};

export type RequestComplianceView = {
  requestId: string;
  userId: string;
  customerName: string;
  beneficiaryName: string;
  amountAud: number;
  fundingMethod: FundingMethod;
  rolling12mAud: number;
  category: ComplianceCategory;
  triggers: CategoryTrigger[];
  manualEscalation: "B" | "C" | null;
  manualEscalationReason: string | null;
  ecdd: { status: "not_required" | "pending" | "approved" | "refused"; reason: string | null; decidedAt: string | null };
  dvs: DvsSummary;
  selfDeclaration: SelfDeclarationSummary;
  pepVendorRequired: boolean;
  /** Latest record per cell. */
  customerSanctionsInternal: ScreeningRecord | null;
  beneficiarySanctionsInternal: ScreeningRecord | null;
  customerPepInternal: ScreeningRecord | null;
  beneficiaryPepInternal: ScreeningRecord | null;
  selfDeclarationRecord: ScreeningRecord | null;
  customerVendor: ScreeningRecord | null;
  beneficiaryVendor: ScreeningRecord | null;
  blockers: string[];
  /** False until the compliance migration has been applied. */
  available: boolean;
  listsReady: { dfat: boolean; pep: boolean };
};

export type CustomerComplianceView = {
  userId: string;
  customerName: string;
  dvs: DvsSummary;
  selfDeclaration: SelfDeclarationSummary;
  sanctionsInternal: ScreeningRecord | null;
  pepInternal: ScreeningRecord | null;
  selfDeclarationRecord: ScreeningRecord | null;
  vendor: ScreeningRecord | null;
  listsReady: { dfat: boolean; pep: boolean };
  available: boolean;
};
