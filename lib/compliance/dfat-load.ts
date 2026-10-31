// lib/compliance/dfat-load.ts
// Loads a parsed DFAT workbook into sanctions_entries as the new active list, then re-screens
// every customer and recipient. Shared by the admin upload route and the CLI loader.

import { DFAT_LOW_RELEVANCE_COUNTRIES, markLowRelevance, type DfatParseResult } from "@/lib/compliance/dfat-import";
import { rescreenAgainstActiveDfat, type RescreenSummary } from "@/lib/compliance/rescreen";
import { getActiveImport, resetComplianceCaches, type ComplianceDb } from "@/lib/compliance/screening";

const BATCH = 500;

export type DfatLoadResult =
  | { ok: true; importId: string; rows: number; lowRelevanceRows: number; latestControlDate: string | null; rescreen: RescreenSummary | null; notes: string }
  | { ok: false; code: "UNCHANGED"; message: string };

export async function loadDfatList(db: ComplianceDb, parsed: DfatParseResult, options: { fileName: string; actor: string | null; force?: boolean }): Promise<DfatLoadResult> {
  const scope = markLowRelevance(parsed.rows);
  const current = await getActiveImport(db, "dfat");
  if (!options.force && current && current.latest_control_date === parsed.latestControlDate && current.entry_count === scope.rows.length) {
    return { ok: false, code: "UNCHANGED", message: "This list matches the one already loaded (same control date and row count)." };
  }

  const created = await db.from("compliance_list_imports").insert([{
    kind: "dfat", status: "loading", source_name: options.fileName, entry_count: scope.rows.length,
    latest_control_date: parsed.latestControlDate, imported_by: options.actor,
  }]).select("id").single();
  if (created.error) throw created.error;
  const importId = created.data.id as string;

  let activated = false;
  try {
    for (let from = 0; from < scope.rows.length; from += BATCH) {
      const { error } = await db.from("sanctions_entries").insert(scope.rows.slice(from, from + BATCH).map(row => ({ ...row, import_id: importId })));
      if (error) throw error;
    }
    // Activate the new import, then retire the previous one and free its rows.
    await db.from("compliance_list_imports").update({ status: "superseded" }).eq("kind", "dfat").eq("status", "active");
    const result = await db.from("compliance_list_imports").update({ status: "active", activated_at: new Date().toISOString() }).eq("id", importId);
    if (result.error) throw result.error;
    activated = true;
    const retired = await db.from("compliance_list_imports").select("id").eq("kind", "dfat").eq("status", "superseded");
    for (const old of retired.data ?? []) await db.from("sanctions_entries").delete().eq("import_id", old.id);
  } catch (error) {
    // Only discard a half-loaded import; once activated the new list is live and must stay.
    if (!activated) {
      await db.from("compliance_list_imports").update({ status: "failed", notes: "Import did not complete." }).eq("id", importId);
      await db.from("sanctions_entries").delete().eq("import_id", importId);
    }
    throw error;
  }

  resetComplianceCaches();
  let rescreen: RescreenSummary | null = null;
  try { rescreen = await rescreenAgainstActiveDfat(db, options.actor); } catch { rescreen = null; }
  const scopeNote = scope.lowRelevanceRows ? `${scope.lowRelevanceRows.toLocaleString()} rows (${DFAT_LOW_RELEVANCE_COUNTRIES.join(", ")}, no Iran link) match only on strong hits. ` : "";
  const notes = scopeNote + (rescreen
    ? `Re-screened ${rescreen.customers} customers and ${rescreen.recipients} recipients: ${rescreen.newMatches} new potential matches.`
    : "The automatic re-screen did not finish; run scripts/screen-everyone.mjs.");
  await db.from("compliance_list_imports").update({ notes }).eq("id", importId);

  try {
    await db.from("audit_logs").insert([{
      actor_id: options.actor, actor_email: options.actor ? "" : "script:load-dfat", action: "ADMIN_DFAT_LIST_LOADED", target_type: "compliance_list", target_id: importId,
      new_value: { file: options.fileName, rows: scope.rows.length, lowRelevanceRows: scope.lowRelevanceRows, latestControlDate: parsed.latestControlDate, rescreen },
    }]);
  } catch { /* An audit failure must not undo a loaded list. */ }

  return { ok: true, importId, rows: scope.rows.length, lowRelevanceRows: scope.lowRelevanceRows, latestControlDate: parsed.latestControlDate, rescreen, notes };
}
