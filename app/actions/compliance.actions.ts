"use server";

// Admin server actions for the three-stage compliance check (DVS / sanctions / PEP) and the
// per-transaction compliance table. Every action re-verifies the admin session, validates
// its input, and writes an audit-log entry for anything that changes a decision.

import { requireAdmin } from "@/app/actions/admin.actions";
import { ensureCustomerCompliance, ensureRecipientsCompliance, ensureRequestCompliance, insertScreening, beneficiaryDisplayName, customerDisplayName, type RecipientCompliance } from "@/lib/compliance/request-compliance";
import { complianceDb, getListStatus, isComplianceUnavailable, type ComplianceDb } from "@/lib/compliance/screening";
import { runManualAmlCheck, runRecipientAmlCheck, type ManualAmlResult } from "@/lib/compliance/manual";
import { getCustomerVerificationConsent } from "@/lib/compliance/customer-consent";
import type { CustomerComplianceView, ListStatus, RequestComplianceView, ScreeningParty, ScreeningRecord } from "@/lib/compliance/types";
import type { FundingMethod } from "@/lib/compliance/risk-category";

type Result<T> = { data: T; error?: never } | { error: string; data?: never };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REASON_MIN = 5;
const REASON_MAX = 1000;
const UNAVAILABLE = "Compliance screening is not set up yet: apply the 20261031_69 database migration.";

async function run<T>(operation: (admin: { id: string; email: string }, db: ComplianceDb) => Promise<T>): Promise<Result<T>> {
  try {
    const admin = await requireAdmin();
    return { data: await operation({ id: admin.id, email: admin.email ?? "" }, complianceDb()) };
  } catch (error) {
    if (isComplianceUnavailable(error)) return { error: UNAVAILABLE };
    return { error: error instanceof Error ? error.message : "The compliance action failed." };
  }
}

async function audit(db: ComplianceDb, admin: { id: string; email: string }, action: string, targetType: string, targetId: string, value: Record<string, unknown>) {
  try {
    await db.from("audit_logs").insert([{ actor_id: admin.id, actor_email: admin.email, action, target_type: targetType, target_id: targetId, new_value: value }]);
  } catch { /* An audit failure must not undo a recorded decision. */ }
}

function reasonOf(value: unknown): string {
  const reason = typeof value === "string" ? value.trim() : "";
  if (reason.length < REASON_MIN || reason.length > REASON_MAX) throw new Error(`Enter a reason of ${REASON_MIN}–${REASON_MAX} characters; it is kept in the audit log.`);
  return reason;
}

function uuidOf(value: unknown, label: string): string {
  if (typeof value !== "string" || !UUID.test(value)) throw new Error(`Invalid ${label}.`);
  return value;
}

// ── Reads ──────────────────────────────────────────────────────────────────────

/** Loads the request's compliance table, running any missing free internal screens first. */
export async function loadRequestCompliance(requestId: string): Promise<Result<RequestComplianceView>> {
  return run(async (admin, db) => ensureRequestCompliance(db, uuidOf(requestId, "request"), admin.id));
}

export async function loadCustomerCompliance(userId: string): Promise<Result<CustomerComplianceView>> {
  return run(async (admin, db) => ensureCustomerCompliance(db, uuidOf(userId, "customer"), admin.id, { run: false }));
}

// ── Customer onboarding stage ──────────────────────────────────────────────────

/** Stage 2 + 3 at onboarding: internal DFAT check and internal PEP search, plus self-declaration. */
export async function runCustomerInternalScreening(userId: string): Promise<Result<CustomerComplianceView>> {
  return run(async (admin, db) => {
    const id = uuidOf(userId, "customer");
    const view = await ensureCustomerCompliance(db, id, admin.id, { run: true, force: true });
    await audit(db, admin, "ADMIN_INTERNAL_SCREENING", "profile", id, {
      sanctions: view.sanctionsInternal?.outcome, pep: view.pepInternal?.outcome, selfDeclaration: view.selfDeclarationRecord?.outcome ?? "not_answered",
    });
    return view;
  });
}

/** Latest internal results for a customer's saved recipients; `run` screens any that are missing or stale. */
export async function loadRecipientsCompliance(input: { userId: string; run?: boolean }): Promise<Result<RecipientCompliance[]>> {
  return run(async (admin, db) => ensureRecipientsCompliance(db, uuidOf(input?.userId, "customer"), admin.id, { run: input.run === true }));
}

// ── Vendor (NameScan) — on demand only ─────────────────────────────────────────

function vendorOutcome(result: ManualAmlResult): "clear" | "potential_match" | "failed" {
  return result.outcome === "FAILED" ? "failed" : result.outcome === "CLEAR" ? "clear" : "potential_match";
}

/** Runs the paid NameScan lookup for one party of a request. Counts for both the sanctions and PEP vendor ticks. */
export async function runRequestVendorScreening(input: { requestId: string; party: ScreeningParty }): Promise<Result<RequestComplianceView>> {
  return run(async (admin, db) => {
    const requestId = uuidOf(input?.requestId, "request");
    if (input.party !== "customer" && input.party !== "beneficiary") throw new Error("Invalid party.");
    const { data: request, error } = await db.from("exchange_requests").select("id, user_id, quote").eq("id", requestId).single();
    if (error || !request) throw new Error("Request not found.");
    const quote = (request.quote ?? {}) as Record<string, unknown>;

    let result: ManualAmlResult;
    let subjectName: string;
    let subjectDob: string | null = null;
    if (input.party === "customer") {
      const { data: profile } = await db.from("profiles")
        .select("id, first_name, last_name, dob, country, address, city, state, postcode, document_type, license_number, card_number, state_of_issue, passport_number, expiry_date")
        .eq("id", request.user_id).single();
      if (!profile) throw new Error("Customer profile not found.");
      const consent = await getCustomerVerificationConsent(db, request.user_id, profile);
      if (!consent.ok) throw new Error(consent.message);
      subjectName = customerDisplayName(profile as never, quote);
      subjectDob = (profile.dob as string | null) ?? null;
      result = await runManualAmlCheck(profile);
    } else {
      const snapshot = (quote.recipient_snapshot ?? {}) as Record<string, unknown>;
      subjectName = beneficiaryDisplayName(quote);
      if (!subjectName) throw new Error("This request has no beneficiary name to screen.");
      result = await runRecipientAmlCheck({
        id: String(quote.recipient_id ?? "request"), full_name: typeof snapshot.full_name === "string" ? snapshot.full_name : subjectName,
        account_name: typeof snapshot.account_name === "string" ? snapshot.account_name : null, direction: typeof snapshot.direction === "string" ? snapshot.direction : "irt",
      });
    }

    const outcome = vendorOutcome(result);
    await insertScreening(db, {
      requestId, profileId: request.user_id, party: input.party, kind: "combined", method: "vendor_namescan", subjectName, subjectDob, outcome,
      topScore: null, matches: outcome === "potential_match" ? [{
        source: "pep", reference: result.referenceId ?? "namescan", listedName: subjectName, matchedName: subjectName, entryType: "NameScan result", percent: 0, strength: "possible", dob: "unknown", listedDob: null,
        details: { Matches: String(result.matchCount), "Possible matches": String(result.possibleMatchCount), Lists: result.listsScreened.join(", "), Note: "Open the NameScan portal with the reference to review the profile." },
      }] : [], vendorReference: result.referenceId, vendorResponse: result.rawResponse, note: result.errorMessage ?? null, performedBy: admin.id,
    });
    await audit(db, admin, "ADMIN_VENDOR_SCREENING", "exchange_request", requestId, { party: input.party, outcome, referenceId: result.referenceId, matchCount: result.matchCount, possibleMatchCount: result.possibleMatchCount });
    return ensureRequestCompliance(db, requestId, admin.id);
  });
}

// ── Decisions ──────────────────────────────────────────────────────────────────

/** Admin review of a potential match or PEP self-declaration. */
export async function decideScreening(input: { screeningId: string; decision: "false_positive" | "confirmed_match"; reason: string }): Promise<Result<{ requestId: string | null }>> {
  return run(async (admin, db) => {
    const id = uuidOf(input?.screeningId, "screening");
    if (input.decision !== "false_positive" && input.decision !== "confirmed_match") throw new Error("Choose a decision.");
    const reason = reasonOf(input.reason);
    const { data: row, error } = await db.from("compliance_screenings").select("id, request_id, profile_id, party, check_kind, method, outcome, subject_name").eq("id", id).single();
    if (error || !row) throw new Error("Screening record not found.");
    if (row.outcome !== "potential_match" && row.outcome !== "declared_yes") throw new Error("Only potential matches and PEP declarations need a decision.");
    const at = new Date().toISOString();
    const { error: updateError } = await db.from("compliance_screenings").update({ decision: input.decision, decision_reason: reason, decided_by: admin.id, decided_at: at }).eq("id", id);
    if (updateError) throw updateError;
    await audit(db, admin, input.decision === "false_positive" ? "ADMIN_SCREENING_FALSE_POSITIVE" : "ADMIN_SCREENING_CONFIRMED_MATCH", row.request_id ? "exchange_request" : "profile", String(row.request_id ?? row.profile_id), {
      screeningId: id, party: row.party, checkKind: row.check_kind, method: row.method, subject: row.subject_name, reason,
    });
    if (row.request_id) await ensureRequestCompliance(db, row.request_id as string, admin.id);
    return { requestId: (row.request_id as string | null) ?? null };
  });
}

export async function setRequestFundingMethod(input: { requestId: string; method: FundingMethod }): Promise<Result<RequestComplianceView>> {
  return run(async (admin, db) => {
    const requestId = uuidOf(input?.requestId, "request");
    if (input.method !== "bank" && input.method !== "cash") throw new Error("Choose bank or cash.");
    await ensureRequestCompliance(db, requestId, admin.id);
    const { error } = await db.from("request_compliance").update({ funding_method: input.method, updated_at: new Date().toISOString() }).eq("request_id", requestId);
    if (error) throw error;
    await audit(db, admin, "ADMIN_COMPLIANCE_FUNDING_METHOD", "exchange_request", requestId, { fundingMethod: input.method });
    return ensureRequestCompliance(db, requestId, admin.id);
  });
}

/** Red flags the engine cannot see (third-party funding, structuring...) raise the category manually. */
export async function setRequestEscalation(input: { requestId: string; level: "B" | "C" | null; reason?: string }): Promise<Result<RequestComplianceView>> {
  return run(async (admin, db) => {
    const requestId = uuidOf(input?.requestId, "request");
    if (input.level !== null && input.level !== "B" && input.level !== "C") throw new Error("Choose B, C or none.");
    const reason = input.level ? reasonOf(input.reason) : null;
    await ensureRequestCompliance(db, requestId, admin.id);
    const { error } = await db.from("request_compliance").update({ manual_escalation: input.level, manual_escalation_reason: reason, updated_at: new Date().toISOString() }).eq("request_id", requestId);
    if (error) throw error;
    await audit(db, admin, "ADMIN_COMPLIANCE_ESCALATION", "exchange_request", requestId, { level: input.level, reason });
    return ensureRequestCompliance(db, requestId, admin.id);
  });
}

/** Category C: the Compliance Officer approves or refuses to proceed (ECDD record). */
export async function decideEcdd(input: { requestId: string; decision: "approved" | "refused"; reason: string }): Promise<Result<RequestComplianceView>> {
  return run(async (admin, db) => {
    const requestId = uuidOf(input?.requestId, "request");
    if (input.decision !== "approved" && input.decision !== "refused") throw new Error("Choose approve or refuse.");
    const reason = reasonOf(input.reason);
    const view = await ensureRequestCompliance(db, requestId, admin.id);
    if (view.category !== "C") throw new Error("ECDD approval only applies to category C transactions.");
    const { error } = await db.from("request_compliance").update({
      ecdd_status: input.decision, ecdd_reason: reason, ecdd_decided_by: admin.id, ecdd_decided_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq("request_id", requestId);
    if (error) throw error;
    await audit(db, admin, input.decision === "approved" ? "ADMIN_ECDD_APPROVED" : "ADMIN_ECDD_REFUSED", "exchange_request", requestId, { category: view.category, triggers: view.triggers.map(item => item.code), reason });
    return ensureRequestCompliance(db, requestId, admin.id);
  });
}

/** Records a documented decision not to run the vendor PEP lookup for this request. */
export async function waiveVendorCheck(input: { requestId: string; reason: string }): Promise<Result<RequestComplianceView>> {
  return run(async (admin, db) => {
    const requestId = uuidOf(input?.requestId, "request");
    const reason = reasonOf(input.reason);
    const view = await ensureRequestCompliance(db, requestId, admin.id);
    const { data: request } = await db.from("exchange_requests").select("user_id").eq("id", requestId).single();
    await insertScreening(db, {
      requestId, profileId: (request?.user_id as string) ?? null, party: "customer", kind: "combined", method: "vendor_namescan", subjectName: view.customerName,
      subjectDob: null, outcome: "waived", note: reason, performedBy: admin.id, decision: null,
    });
    await audit(db, admin, "ADMIN_VENDOR_CHECK_WAIVED", "exchange_request", requestId, { reason });
    return ensureRequestCompliance(db, requestId, admin.id);
  });
}

/** Records the customer's PEP answer taken verbally or in person (when the KYC form had none). */
export async function recordPepDeclaration(input: { userId: string; isPep: boolean; relation?: "self" | "family" | "close_associate" | null; details?: string }): Promise<Result<{ ok: true }>> {
  return run(async (admin, db) => {
    const userId = uuidOf(input?.userId, "customer");
    if (typeof input.isPep !== "boolean") throw new Error("Answer yes or no.");
    const relation = input.isPep ? input.relation : null;
    if (input.isPep && !["self", "family", "close_associate"].includes(String(relation))) throw new Error("Choose whether this is the customer, a family member or a close associate.");
    const details = input.isPep ? (input.details ?? "").trim().slice(0, 1000) : null;
    if (input.isPep && !details) throw new Error("Describe the position held and the country.");
    const { error } = await db.from("profiles").update({
      pep_self_declared: input.isPep, pep_declaration_relation: relation ?? null, pep_declaration_details: details,
      pep_declared_at: new Date().toISOString(), pep_declaration_source: "admin_recorded",
    }).eq("id", userId);
    if (error) throw error;
    await audit(db, admin, "ADMIN_PEP_DECLARATION_RECORDED", "profile", userId, { isPep: input.isPep, relation, details });
    return { ok: true as const };
  });
}

// ── Compliance lists overview ──────────────────────────────────────────────────

export type PendingReview = ScreeningRecord & { customer_label: string | null; request_reference: string | null };
export type ComplianceOverview = { dfat: ListStatus; pep: ListStatus; pending: PendingReview[] };

export async function getComplianceOverview(): Promise<Result<ComplianceOverview>> {
  return run(async (_admin, db) => {
    const [dfat, pep] = await Promise.all([getListStatus(db, "dfat"), getListStatus(db, "pep_wikidata")]);
    const { data, error } = await db.from("compliance_screenings")
      .select("id, request_id, profile_id, party, check_kind, method, subject_name, subject_dob, outcome, top_score, matches, list_import_id, vendor_reference, note, performed_by, performed_at, decision, decision_reason, decided_by, decided_at")
      .in("outcome", ["potential_match", "declared_yes"]).or("decision.is.null,decision.eq.pending").order("performed_at", { ascending: false }).limit(100);
    if (error) throw error;
    const rows = (data ?? []) as ScreeningRecord[];
    const requestIds = [...new Set(rows.map(row => row.request_id).filter((value): value is string => !!value))];
    const references = new Map<string, string>();
    if (requestIds.length) {
      const { data: requests } = await db.from("exchange_requests").select("id, reference_code").in("id", requestIds);
      for (const request of requests ?? []) references.set(request.id as string, request.reference_code as string);
    }
    return {
      dfat, pep,
      pending: rows.map(row => ({ ...row, customer_label: row.subject_name, request_reference: row.request_id ? references.get(row.request_id) ?? null : null })),
    };
  });
}
