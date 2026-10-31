// lib/compliance/rescreen.ts
// After a new DFAT list is loaded, every existing customer and active recipient is re-checked
// against it in memory (free, a few seconds). Only NEW potential matches are recorded, so the
// admin sees a short review queue instead of re-reviewing people already cleared as false
// positives against the same listed entries.

import { carriedDecision, ensureCustomerCompliance, ensureRecipientsCompliance, insertScreening } from "@/lib/compliance/request-compliance";
import { loadSanctions, screenSanctions, type ComplianceDb } from "@/lib/compliance/screening";
import type { ScreeningParty } from "@/lib/compliance/types";

const PAGE = 1000;

export type RescreenSummary = { customers: number; recipients: number; newMatches: number; carriedOver: number; alreadyOpen: number; failed: number };

type Subject = { profileId: string; party: ScreeningParty; name: string; dob: string | null };

async function* subjects(db: ComplianceDb): AsyncGenerator<Subject> {
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from("profiles").select("id, first_name, last_name, dob").order("id").range(from, from + PAGE - 1);
    if (error) throw error;
    for (const row of data ?? []) {
      const name = [row.first_name, row.last_name].map(part => String(part ?? "").trim()).filter(Boolean).join(" ");
      if (name) yield { profileId: row.id as string, party: "customer", name, dob: (row.dob as string | null) ?? null };
    }
    if ((data?.length ?? 0) < PAGE) break;
  }
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from("recipients").select("id, user_id, full_name, account_name").is("archived_at", null).order("id").range(from, from + PAGE - 1);
    if (error) throw error;
    for (const row of data ?? []) {
      const name = String(row.full_name ?? row.account_name ?? "").trim();
      if (name && row.user_id) yield { profileId: row.user_id as string, party: "beneficiary", name, dob: null };
    }
    if ((data?.length ?? 0) < PAGE) break;
  }
}

export async function rescreenAgainstActiveDfat(db: ComplianceDb, actor: string | null): Promise<RescreenSummary> {
  const summary: RescreenSummary = { customers: 0, recipients: 0, newMatches: 0, carriedOver: 0, alreadyOpen: 0, failed: 0 };
  const runtime = await loadSanctions(db);
  if (!runtime) return summary;
  const seen = new Set<string>();

  for await (const subject of subjects(db)) {
    const key = `${subject.profileId}|${subject.party}|${subject.name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (subject.party === "customer") summary.customers += 1; else summary.recipients += 1;
    try {
      const result = await screenSanctions(db, subject.name, subject.dob);
      if (result.outcome === "failed") { summary.failed += 1; continue; }
      if (result.outcome !== "potential_match") continue;
      const carried = await carriedDecision(db, subject.profileId, subject.party, "sanctions", "internal_dfat", subject.name, result.matches);
      if (carried) { summary.carriedOver += 1; continue; }
      // The same unreviewed hit is already in the queue from an earlier update.
      const { data: open } = await db.from("compliance_screenings").select("matches")
        .eq("profile_id", subject.profileId).eq("party", subject.party).eq("check_kind", "sanctions").eq("method", "internal_dfat")
        .eq("subject_name", subject.name).is("request_id", null).eq("outcome", "potential_match").eq("decision", "pending").limit(5);
      const wanted = result.matches.map(match => match.reference);
      if ((open ?? []).some(row => { const refs = new Set(((row.matches ?? []) as Array<{ reference: string }>).map(match => match.reference)); return wanted.every(reference => refs.has(reference)); })) {
        summary.alreadyOpen += 1;
        continue;
      }
      await insertScreening(db, {
        requestId: null, profileId: subject.profileId, party: subject.party, kind: "sanctions", method: "internal_dfat",
        subjectName: subject.name, subjectDob: subject.dob, outcome: "potential_match", topScore: result.topScore, matches: result.matches,
        listImportId: result.importId, performedBy: actor, note: "Automatic re-screen after DFAT list update.",
      });
      summary.newMatches += 1;
    } catch {
      summary.failed += 1;
    }
  }
  return summary;
}

export type ScreenAllSummary = { customers: number; recipients: number; sanctionsMatches: number; pepMatches: number; failed: number };

/**
 * Brings every customer and active recipient up to date with the free internal DFAT + PEP
 * screens. Skips anyone whose latest result is already current, so it is safe to re-run.
 */
export async function screenEveryoneInternal(db: ComplianceDb, actor: string | null, onProgress?: (done: number, total: number) => void, concurrency = 4): Promise<ScreenAllSummary> {
  const summary: ScreenAllSummary = { customers: 0, recipients: 0, sanctionsMatches: 0, pepMatches: 0, failed: 0 };
  const ids: string[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from("profiles").select("id").order("id").range(from, from + PAGE - 1);
    if (error) throw error;
    ids.push(...(data ?? []).map(row => row.id as string));
    if ((data?.length ?? 0) < PAGE) break;
  }
  let done = 0;
  const queue = [...ids];
  const worker = async () => {
    for (let id = queue.shift(); id; id = queue.shift()) {
      try {
        const customer = await ensureCustomerCompliance(db, id, actor, { run: true });
        if (customer.customerName) summary.customers += 1;
        if (customer.sanctionsInternal?.outcome === "potential_match" && customer.sanctionsInternal.decision !== "false_positive") summary.sanctionsMatches += 1;
        if (customer.pepInternal?.outcome === "potential_match" && customer.pepInternal.decision !== "false_positive") summary.pepMatches += 1;
        for (const recipient of await ensureRecipientsCompliance(db, id, actor, { run: true })) {
          summary.recipients += 1;
          if (recipient.sanctions?.outcome === "potential_match" && recipient.sanctions.decision !== "false_positive") summary.sanctionsMatches += 1;
          if (recipient.pep?.outcome === "potential_match" && recipient.pep.decision !== "false_positive") summary.pepMatches += 1;
        }
      } catch { summary.failed += 1; }
      onProgress?.(++done, ids.length);
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  return summary;
}
