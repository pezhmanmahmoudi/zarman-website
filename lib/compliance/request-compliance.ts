// lib/compliance/request-compliance.ts
// Orchestrates per-request (and onboarding-level) compliance: runs the free internal
// DFAT + PEP screens for the customer and beneficiary, reads the customer's PEP
// self-declaration, classifies the transaction A/B/C, and exposes the release gate.
// Vendor lookups (NameScan) are never run here; they are on-demand admin actions.

import { classifyTransaction, hasUnresolvedMatch, releaseBlockers, type FundingMethod, type ScreeningDecision, type ScreeningOutcome } from "@/lib/compliance/risk-category";
import { getActiveImport, getListStatus, screenPep, screenSanctions, type ComplianceDb, type InternalScreeningResult } from "@/lib/compliance/screening";
import type { CustomerComplianceView, DvsSummary, RequestComplianceView, ScreeningKind, ScreeningMatch, ScreeningMethod, ScreeningParty, ScreeningRecord, SelfDeclarationSummary } from "@/lib/compliance/types";

const TERMINAL = new Set(["completed", "cancelled", "rejected", "expired"]);
const EXCLUDED_FROM_TOTALS = new Set(["cancelled", "rejected", "expired"]);
const SCREENING_COLUMNS = "id, request_id, profile_id, party, check_kind, method, subject_name, subject_dob, outcome, top_score, matches, list_import_id, vendor_reference, note, performed_by, performed_at, decision, decision_reason, decided_by, decided_at";
const PROFILE_COLUMNS = "id, first_name, last_name, dob, country, compliance_dvs_status, compliance_dvs_method, compliance_dvs_outcome, compliance_dvs_checked_at, pep_self_declared, pep_declaration_relation, pep_declaration_details, pep_declared_at, pep_declaration_source";

type Profile = {
  id: string; first_name: string | null; last_name: string | null; dob: string | null; country: string | null;
  compliance_dvs_status: string | null; compliance_dvs_method: string | null; compliance_dvs_outcome: string | null; compliance_dvs_checked_at: string | null;
  pep_self_declared: boolean | null; pep_declaration_relation: string | null; pep_declaration_details: string | null;
  pep_declared_at: string | null; pep_declaration_source: string | null;
};

type RequestRow = { id: string; user_id: string; status: string; created_at: string; quote: Record<string, unknown> };

const norm = (value: string | null | undefined) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const money = (value: unknown) => { const n = Number(value); return Number.isFinite(n) ? n : 0; };

function isAustralia(country: string | null | undefined) {
  return ["australia", "au", "aus"].includes(norm(country));
}

export function customerDisplayName(profile: Profile | null, quote?: Record<string, unknown>): string {
  const fromProfile = [profile?.first_name, profile?.last_name].map(part => text(part)).filter(Boolean).join(" ");
  if (fromProfile) return fromProfile;
  const sender = quote?.sender_snapshot as { name?: string } | undefined;
  return text(sender?.name);
}

export function beneficiaryDisplayName(quote: Record<string, unknown>): string {
  const snapshot = (quote.recipient_snapshot ?? {}) as Record<string, unknown>;
  return text(quote.institution_name) || text(snapshot.account_name) || text(snapshot.full_name) || text(snapshot.label);
}

async function loadProfile(db: ComplianceDb, userId: string): Promise<Profile | null> {
  const { data, error } = await db.from("profiles").select(PROFILE_COLUMNS).eq("id", userId).maybeSingle();
  if (error) throw error;
  return (data as Profile | null) ?? null;
}

async function loadRequest(db: ComplianceDb, requestId: string): Promise<RequestRow> {
  const { data, error } = await db.from("exchange_requests").select("id, user_id, status, created_at, quote").eq("id", requestId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Request not found.");
  return data as RequestRow;
}

// ── Screening rows ─────────────────────────────────────────────────────────────

type InsertScreening = {
  requestId: string | null; profileId: string | null; party: ScreeningParty; kind: ScreeningKind; method: ScreeningMethod;
  subjectName: string; subjectDob: string | null; outcome: ScreeningOutcome; topScore?: number | null; matches?: ScreeningMatch[];
  listImportId?: string | null; vendorReference?: string | null; vendorResponse?: unknown; note?: string | null; performedBy?: string | null;
  decision?: ScreeningDecision; decisionReason?: string | null; decidedBy?: string | null; decidedAt?: string | null;
};

export async function insertScreening(db: ComplianceDb, input: InsertScreening): Promise<ScreeningRecord> {
  const { data, error } = await db.from("compliance_screenings").insert([{
    request_id: input.requestId, profile_id: input.profileId, party: input.party, check_kind: input.kind, method: input.method,
    subject_name: input.subjectName, subject_dob: input.subjectDob, outcome: input.outcome, top_score: input.topScore ?? null,
    matches: input.matches ?? [], list_import_id: input.listImportId ?? null, vendor_reference: input.vendorReference ?? null,
    vendor_response: input.vendorResponse ?? null, note: input.note ?? null, performed_by: input.performedBy ?? null,
    decision: input.decision ?? (input.outcome === "potential_match" || input.outcome === "declared_yes" ? "pending" : null),
    decision_reason: input.decisionReason ?? null, decided_by: input.decidedBy ?? null, decided_at: input.decidedAt ?? null,
  }]).select(SCREENING_COLUMNS).single();
  if (error) throw error;
  return data as ScreeningRecord;
}

async function loadScreenings(db: ComplianceDb, requestId: string | null, profileId?: string): Promise<ScreeningRecord[]> {
  let query = db.from("compliance_screenings").select(SCREENING_COLUMNS).order("performed_at", { ascending: false }).limit(600);
  query = requestId ? query.eq("request_id", requestId) : query.is("request_id", null).eq("profile_id", profileId ?? "");
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ScreeningRecord[];
}

function latest(rows: ScreeningRecord[], party: ScreeningParty, kind: ScreeningKind, method: ScreeningMethod): ScreeningRecord | null {
  return rows.find(row => row.party === party && row.check_kind === kind && row.method === method) ?? null;
}

/**
 * A reviewer already cleared this exact person against these exact list entries: don't make
 * the admin re-review the same false positive on every later request or list refresh.
 */
export async function carriedDecision(db: ComplianceDb, profileId: string, party: ScreeningParty, kind: ScreeningKind, method: ScreeningMethod, subjectName: string, matches: ScreeningMatch[]) {
  const { data } = await db.from("compliance_screenings")
    .select("matches, decision_reason, decided_by, decided_at, performed_at")
    .eq("profile_id", profileId).eq("party", party).eq("check_kind", kind).eq("method", method)
    .eq("subject_name", subjectName).eq("decision", "false_positive").order("decided_at", { ascending: false }).limit(10);
  const wanted = new Set(matches.map(match => match.reference));
  for (const row of data ?? []) {
    const cleared = new Set(((row.matches ?? []) as ScreeningMatch[]).map(match => match.reference));
    if (wanted.size && [...wanted].every(reference => cleared.has(reference))) {
      return { decision: "false_positive" as const, reason: `Carried over from earlier review (${String(row.decided_at ?? row.performed_at).slice(0, 10)}): ${row.decision_reason ?? "cleared as false positive"}`, by: row.decided_by as string | null, at: row.decided_at as string | null };
    }
  }
  return null;
}

async function runInternal(
  db: ComplianceDb, ctx: { requestId: string | null; profileId: string; party: ScreeningParty; kind: "sanctions" | "pep"; subjectName: string; dob: string | null; actor: string | null },
): Promise<ScreeningRecord> {
  const method: ScreeningMethod = ctx.kind === "sanctions" ? "internal_dfat" : "internal_pep";
  let result: InternalScreeningResult;
  try {
    result = ctx.kind === "sanctions" ? await screenSanctions(db, ctx.subjectName, ctx.dob) : await screenPep(db, ctx.subjectName, ctx.dob);
  } catch (error) {
    result = { outcome: "failed", error: error instanceof Error ? error.message : "Screening failed." };
  }
  if (result.outcome === "failed") {
    return insertScreening(db, { requestId: ctx.requestId, profileId: ctx.profileId, party: ctx.party, kind: ctx.kind, method, subjectName: ctx.subjectName, subjectDob: ctx.dob, outcome: "failed", note: result.error, performedBy: ctx.actor });
  }
  const carried = result.outcome === "potential_match"
    ? await carriedDecision(db, ctx.profileId, ctx.party, ctx.kind, method, ctx.subjectName, result.matches) : null;
  return insertScreening(db, {
    requestId: ctx.requestId, profileId: ctx.profileId, party: ctx.party, kind: ctx.kind, method, subjectName: ctx.subjectName, subjectDob: ctx.dob,
    outcome: result.outcome, topScore: result.topScore, matches: result.matches, listImportId: result.importId, performedBy: ctx.actor,
    ...(carried ? { decision: carried.decision, decisionReason: carried.reason, decidedBy: carried.by, decidedAt: carried.at } : {}),
  });
}

function selfDeclarationSummary(profile: Profile | null): SelfDeclarationSummary {
  return {
    answered: profile?.pep_self_declared === true || profile?.pep_self_declared === false,
    isPep: profile?.pep_self_declared ?? null,
    relation: profile?.pep_declaration_relation ?? null,
    details: profile?.pep_declaration_details ?? null,
    declaredAt: profile?.pep_declared_at ?? null,
    source: profile?.pep_declaration_source ?? null,
  };
}

function dvsSummary(profile: Profile | null): DvsSummary {
  return {
    applicable: isAustralia(profile?.country),
    status: profile?.compliance_dvs_status ?? "not_started",
    method: profile?.compliance_dvs_method ?? null,
    outcome: profile?.compliance_dvs_outcome ?? null,
    checkedAt: profile?.compliance_dvs_checked_at ?? null,
  };
}

/** Writes the self-declaration answer as a screening record, once per declaration. */
async function syncSelfDeclaration(db: ComplianceDb, requestId: string | null, profile: Profile, existing: ScreeningRecord | null, actor: string | null): Promise<ScreeningRecord | null> {
  const summary = selfDeclarationSummary(profile);
  if (!summary.answered) return existing;
  const stale = !existing || (summary.declaredAt && existing.performed_at < summary.declaredAt) || existing.outcome !== (summary.isPep ? "declared_yes" : "declared_no");
  if (!stale) return existing;
  const name = customerDisplayName(profile);
  const detail: ScreeningMatch[] = summary.isPep ? [{
    source: "pep", reference: "self-declaration", listedName: name, matchedName: name, entryType: "Customer self-declaration", percent: 100, strength: "strong", dob: "unknown", listedDob: null,
    details: { Relationship: summary.relation ?? "unspecified", Details: summary.details ?? null, "Declared via": summary.source === "admin_recorded" ? "Recorded by admin" : "KYC form" },
  }] : [];
  let carried: { decision: "false_positive" | "confirmed_match"; reason: string; by: string | null; at: string | null } | null = null;
  if (summary.isPep) {
    const { data } = await db.from("compliance_screenings").select("decision, decision_reason, decided_by, decided_at")
      .eq("profile_id", profile.id).eq("method", "self_declaration").eq("outcome", "declared_yes").in("decision", ["false_positive", "confirmed_match"])
      .gte("decided_at", summary.declaredAt ?? "1970-01-01").order("decided_at", { ascending: false }).limit(1);
    const row = data?.[0];
    if (row) carried = { decision: row.decision as "false_positive" | "confirmed_match", reason: `Carried over from earlier review: ${row.decision_reason ?? ""}`.trim(), by: row.decided_by as string | null, at: row.decided_at as string | null };
  }
  return insertScreening(db, {
    requestId, profileId: profile.id, party: "customer", kind: "pep", method: "self_declaration", subjectName: name, subjectDob: profile.dob,
    outcome: summary.isPep ? "declared_yes" : "declared_no", matches: detail, performedBy: actor,
    ...(carried ? { decision: carried.decision, decisionReason: carried.reason, decidedBy: carried.by, decidedAt: carried.at } : {}),
  });
}

// ── Rolling total ──────────────────────────────────────────────────────────────

export async function rolling12mTotalAud(db: ComplianceDb, userId: string, current: { id: string; amountAud: number }): Promise<number> {
  const since = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString();
  const { data, error } = await db.from("exchange_requests").select("id, status, quote").eq("user_id", userId).gte("created_at", since).limit(2000);
  if (error) throw error;
  let total = current.amountAud;
  for (const row of data ?? []) {
    if (row.id === current.id || EXCLUDED_FROM_TOTALS.has(String(row.status))) continue;
    total += money((row.quote as Record<string, unknown> | null)?.raw_amount_aud);
  }
  return Math.round(total * 100) / 100;
}

// ── Request-level ──────────────────────────────────────────────────────────────

type StoredCompliance = {
  category: string; triggers: unknown; amount_aud: number | string | null; rolling_12m_aud: number | string | null;
  funding_method: FundingMethod; manual_escalation: "B" | "C" | null; manual_escalation_reason: string | null;
  ecdd_status: "not_required" | "pending" | "approved" | "refused"; ecdd_reason: string | null; ecdd_decided_at: string | null;
};

async function loadStored(db: ComplianceDb, requestId: string): Promise<StoredCompliance | null> {
  const { data, error } = await db.from("request_compliance")
    .select("category, triggers, amount_aud, rolling_12m_aud, funding_method, manual_escalation, manual_escalation_reason, ecdd_status, ecdd_reason, ecdd_decided_at").eq("request_id", requestId).maybeSingle();
  if (error) throw error;
  return (data as StoredCompliance | null) ?? null;
}

const state = (row: ScreeningRecord | null) => (row ? { outcome: row.outcome, decision: row.decision } : null);

/**
 * Brings a request's compliance record up to date. Runs only the free internal screens that
 * are missing or stale (name changed, or DFAT/PEP list replaced while the request is open),
 * then recomputes the category. Idempotent: safe to call on every page load and before gating.
 */
export async function ensureRequestCompliance(db: ComplianceDb, requestId: string, actor: string | null): Promise<RequestComplianceView> {
  const request = await loadRequest(db, requestId);
  const quote = request.quote ?? {};
  const amountAud = money(quote.raw_amount_aud);
  // Everything else only needs the request row, so it is read in one parallel wave.
  const [profile, dfat, pep, stored, screenings, rolling12mAud] = await Promise.all([
    loadProfile(db, request.user_id), getActiveImport(db, "dfat"), getActiveImport(db, "pep_wikidata"), loadStored(db, requestId),
    loadScreenings(db, requestId), rolling12mTotalAud(db, request.user_id, { id: request.id, amountAud }),
  ]);
  let rows = screenings;
  const customerName = customerDisplayName(profile, quote);
  const beneficiaryName = beneficiaryDisplayName(quote);
  const open = !TERMINAL.has(request.status);

  const fresh = (row: ScreeningRecord | null, name: string, dob: string | null, importId: string | undefined) => {
    if (!row || row.outcome === "failed") return false;
    if (norm(row.subject_name) !== norm(name) || (row.subject_dob ?? null) !== (dob ?? null)) return false;
    return !open || !importId || row.list_import_id === importId;
  };

  const jobs: Array<Promise<ScreeningRecord>> = [];
  const plan: Array<{ party: ScreeningParty; kind: "sanctions" | "pep"; name: string; dob: string | null }> = [
    { party: "customer", kind: "sanctions", name: customerName, dob: profile?.dob ?? null },
    { party: "beneficiary", kind: "sanctions", name: beneficiaryName, dob: null },
    { party: "customer", kind: "pep", name: customerName, dob: profile?.dob ?? null },
    { party: "beneficiary", kind: "pep", name: beneficiaryName, dob: null },
  ];
  for (const item of plan) {
    const method: ScreeningMethod = item.kind === "sanctions" ? "internal_dfat" : "internal_pep";
    const importId = item.kind === "sanctions" ? dfat?.id : pep?.id;
    if (item.name && !fresh(latest(rows, item.party, item.kind, method), item.name, item.dob, importId)) {
      jobs.push(runInternal(db, { requestId, profileId: request.user_id, party: item.party, kind: item.kind, subjectName: item.name, dob: item.dob, actor }));
    }
  }
  const [created, declared] = await Promise.all([
    Promise.all(jobs),
    profile ? syncSelfDeclaration(db, requestId, profile, latest(rows, "customer", "pep", "self_declaration"), actor) : null,
  ]);
  if (declared && !rows.some(row => row.id === declared.id)) created.push(declared);
  if (created.length) rows = [...created, ...rows].sort((a, b) => (a.performed_at < b.performed_at ? 1 : -1));

  const customerSanctions = latest(rows, "customer", "sanctions", "internal_dfat");
  const beneficiarySanctions = latest(rows, "beneficiary", "sanctions", "internal_dfat");
  const customerPep = latest(rows, "customer", "pep", "internal_pep");
  const beneficiaryPep = latest(rows, "beneficiary", "pep", "internal_pep");
  const declaration = latest(rows, "customer", "pep", "self_declaration");
  const customerVendor = latest(rows, "customer", "combined", "vendor_namescan");
  const beneficiaryVendor = latest(rows, "beneficiary", "combined", "vendor_namescan");

  const vendorUnresolved = [customerVendor, beneficiaryVendor].some(row => hasUnresolvedMatch(state(row)));
  const sanctionsMatch = [customerSanctions, beneficiarySanctions].some(row => hasUnresolvedMatch(state(row))) || vendorUnresolved
    || [customerSanctions, beneficiarySanctions].some(row => row?.outcome === "potential_match" && row.decision === "confirmed_match");
  const declaredYesActive = declaration?.outcome === "declared_yes" && declaration.decision !== "false_positive";
  const pepMatch = [customerPep, beneficiaryPep].some(row => row?.outcome === "potential_match" && row.decision !== "false_positive") || declaredYesActive || vendorUnresolved;

  const fundingMethod: FundingMethod = stored?.funding_method ?? "bank";
  const classification = classifyTransaction({ amountAud, fundingMethod, rolling12mAud, sanctionsMatch, pepMatch, manualEscalation: stored?.manual_escalation ?? null });
  const category = classification.category;
  const internalPepHit = customerPep?.outcome === "potential_match" || beneficiaryPep?.outcome === "potential_match";
  const pepVendorRequired = classification.pepVendorRequired(internalPepHit, declaration?.outcome === "declared_yes");

  let ecddStatus = stored?.ecdd_status ?? "not_required";
  if (category === "C" && (ecddStatus === "not_required")) ecddStatus = "pending";
  if (category !== "C" && ecddStatus === "pending") ecddStatus = "not_required";

  // Opening the page is a read: only write when the stored summary actually changed.
  const unchanged = !!stored && stored.category === category && stored.ecdd_status === ecddStatus
    && JSON.stringify(stored.triggers) === JSON.stringify(classification.triggers)
    && money(stored.amount_aud) === amountAud && money(stored.rolling_12m_aud) === rolling12mAud;
  if (!unchanged) {
    const { error: upsertError } = await db.from("request_compliance").upsert({
      request_id: requestId, funding_method: fundingMethod, category, triggers: classification.triggers,
      manual_escalation: stored?.manual_escalation ?? null, manual_escalation_reason: stored?.manual_escalation_reason ?? null,
      amount_aud: amountAud, rolling_12m_aud: rolling12mAud, ecdd_status: ecddStatus, updated_at: new Date().toISOString(),
    }, { onConflict: "request_id" });
    if (upsertError) throw upsertError;
  }

  const blockers = releaseBlockers({
    category,
    customerSanctions: state(customerSanctions), beneficiarySanctions: state(beneficiarySanctions),
    customerPepInternal: state(customerPep), beneficiaryPepInternal: state(beneficiaryPep),
    selfDeclaration: state(declaration), pepVendorRequired, pepVendor: state(customerVendor), ecddStatus,
  });
  // Any other unresolved vendor hit (e.g. on the beneficiary) also blocks.
  if (beneficiaryVendor?.outcome === "potential_match" && hasUnresolvedMatch(state(beneficiaryVendor))) blockers.push("Beneficiary vendor check returned a potential match awaiting admin review.");

  const [dfatStatus, pepStatus] = [dfat, pep];
  return {
    requestId, userId: request.user_id, customerName, beneficiaryName, amountAud, fundingMethod, rolling12mAud, category, triggers: classification.triggers,
    manualEscalation: stored?.manual_escalation ?? null, manualEscalationReason: stored?.manual_escalation_reason ?? null,
    ecdd: { status: ecddStatus, reason: stored?.ecdd_reason ?? null, decidedAt: stored?.ecdd_decided_at ?? null },
    dvs: dvsSummary(profile), selfDeclaration: selfDeclarationSummary(profile), pepVendorRequired,
    customerSanctionsInternal: customerSanctions, beneficiarySanctionsInternal: beneficiarySanctions,
    customerPepInternal: customerPep, beneficiaryPepInternal: beneficiaryPep, selfDeclarationRecord: declaration,
    customerVendor, beneficiaryVendor, blockers, available: true,
    listsReady: { dfat: !!dfatStatus, pep: !!pepStatus },
  };
}

// ── Customer-level (onboarding) ────────────────────────────────────────────────

export async function ensureCustomerCompliance(db: ComplianceDb, userId: string, actor: string | null, options: { run: boolean; /** Re-run even if the latest result is current (an explicit admin click). */ force?: boolean }): Promise<CustomerComplianceView> {
  const [profile, screenings, dfatStatus, pepStatus] = await Promise.all([
    loadProfile(db, userId), loadScreenings(db, null, userId), getListStatus(db, "dfat"), getListStatus(db, "pep_wikidata"),
  ]);
  if (!profile) throw new Error("Customer profile not found.");
  const name = customerDisplayName(profile);
  let rows = screenings;

  if (options.run && name) {
    const due = (["sanctions", "pep"] as const).filter(kind => {
      const method: ScreeningMethod = kind === "sanctions" ? "internal_dfat" : "internal_pep";
      const importId = kind === "sanctions" ? dfatStatus.importId : pepStatus.importId;
      return options.force || !isCurrent(latest(rows, "customer", kind, method), name, profile.dob, importId);
    });
    const [created, declaration] = await Promise.all([
      Promise.all(due.map(kind => runInternal(db, { requestId: null, profileId: userId, party: "customer", kind, subjectName: name, dob: profile.dob, actor }))),
      syncSelfDeclaration(db, null, profile, latest(rows, "customer", "pep", "self_declaration"), actor),
    ]);
    if (declaration && !rows.some(row => row.id === declaration.id)) created.push(declaration);
    if (created.length) rows = [...created, ...rows].sort((a, b) => (a.performed_at < b.performed_at ? 1 : -1));

    const sanctions = created.find(row => row.check_kind === "sanctions");
    if (sanctions) {
      // Keep the legacy onboarding fields (used by AUSTRAC reporting) in sync.
      await db.from("profiles").update({
        compliance_aml_status: sanctions.outcome === "failed" ? "failed" : "completed", compliance_aml_method: "internal_dfat",
        compliance_aml_checked_at: sanctions.performed_at, compliance_aml_outcome: sanctions.outcome === "clear" ? "CLEAR" : sanctions.outcome === "failed" ? "FAILED" : "REVIEW REQUIRED",
        compliance_aml_flag: sanctions.outcome === "clear" ? "clear" : sanctions.outcome === "failed" ? "failed" : "review_required",
      }).eq("id", userId);
    }
  }

  return {
    userId, customerName: name, dvs: dvsSummary(profile), selfDeclaration: selfDeclarationSummary(profile),
    sanctionsInternal: latest(rows, "customer", "sanctions", "internal_dfat"),
    pepInternal: latest(rows, "customer", "pep", "internal_pep"),
    selfDeclarationRecord: latest(rows, "customer", "pep", "self_declaration"),
    vendor: latest(rows, "customer", "combined", "vendor_namescan"),
    listsReady: { dfat: !!dfatStatus.importId, pep: !!pepStatus.importId }, available: true,
  };
}

/** True when a stored screening still reflects the same person and the currently active list. */
function isCurrent(row: ScreeningRecord | null, name: string, dob: string | null, importId: string | null | undefined): boolean {
  if (!row || row.outcome === "failed") return false;
  if (norm(row.subject_name) !== norm(name) || (row.subject_dob ?? null) !== (dob ?? null)) return false;
  return !importId || row.list_import_id === importId;
}

// ── Recipients (beneficiaries saved on a customer) ─────────────────────────────

export type RecipientCompliance = { recipientId: string; name: string; sanctions: ScreeningRecord | null; pep: ScreeningRecord | null };

/** Screens every active recipient of a customer; with run=false it only reads the latest results. */
export async function ensureRecipientsCompliance(db: ComplianceDb, userId: string, actor: string | null, options: { run: boolean; force?: boolean }): Promise<RecipientCompliance[]> {
  const { data, error } = await db.from("recipients").select("id, full_name, account_name").eq("user_id", userId).is("archived_at", null);
  if (error) throw error;
  const [dfat, pep] = options.run ? await Promise.all([getActiveImport(db, "dfat"), getActiveImport(db, "pep_wikidata")]) : [null, null];
  let rows = await loadScreenings(db, null, userId);
  const pick = (name: string, kind: ScreeningKind, method: ScreeningMethod) =>
    rows.find(row => row.party === "beneficiary" && row.check_kind === kind && row.method === method && norm(row.subject_name) === norm(name)) ?? null;

  const out: RecipientCompliance[] = [];
  for (const recipient of data ?? []) {
    const name = text(recipient.full_name) || text(recipient.account_name);
    if (!name) continue;
    if (options.run) {
      const created: ScreeningRecord[] = [];
      for (const kind of ["sanctions", "pep"] as const) {
        const method: ScreeningMethod = kind === "sanctions" ? "internal_dfat" : "internal_pep";
        if (!options.force && isCurrent(pick(name, kind, method), name, null, kind === "sanctions" ? dfat?.id : pep?.id)) continue;
        created.push(await runInternal(db, { requestId: null, profileId: userId, party: "beneficiary", kind, subjectName: name, dob: null, actor }));
      }
      if (created.length) rows = [...created, ...rows];
    }
    out.push({ recipientId: recipient.id as string, name, sanctions: pick(name, "sanctions", "internal_dfat"), pep: pick(name, "pep", "internal_pep") });
  }
  return out;
}

// ── Gate used by request approval / settlement commands ────────────────────────

/** Commands that approve the request or move money; compliance must be clear first. */
export const COMPLIANCE_GATED_COMMANDS = ["await_funds", "resume_funded_request", "finalize_funds", "start_processing", "reconcile_complete", "complete"] as const;

export async function complianceGateError(db: ComplianceDb, requestId: string, actor: string | null): Promise<string | null> {
  const view = await ensureRequestCompliance(db, requestId, actor);
  if (!view.blockers.length) return null;
  const [first, ...rest] = view.blockers;
  return `Compliance check required before this step: ${first}${rest.length ? ` (+${rest.length} more; open the Compliance panel)` : ""}`;
}
