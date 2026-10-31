// lib/compliance/screening.ts
// Server-side internal screening: loads the active DFAT sanctions list and PEP list from
// Supabase into an in-memory name index (cached per server instance, keyed by import id)
// and screens names against them. Free, local, and fast; vendors are only used on demand.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NameIndex, PEP_SEARCH, SANCTIONS_SEARCH, type NameHit } from "@/lib/compliance/name-matching";
import type { ListStatus, ScreeningMatch } from "@/lib/compliance/types";

export type ComplianceDb = SupabaseClient;

export function complianceDb(): ComplianceDb {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Compliance service is not configured.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** True when the compliance migration has not been applied yet. */
export function isComplianceUnavailable(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === "42P01" || code === "42703" || code === "PGRST205" || code === "PGRST204";
}

const PAGE = 1000;
const MAX_MATCH_GROUPS = 10;
const DETAIL_LIMIT = 700;

type ImportRow = {
  id: string; entry_count: number; latest_control_date: string | null;
  created_at: string; activated_at: string | null; source_name: string | null; notes: string | null;
};

// The active import id is read on every screening; a short cache avoids one query per name.
const ACTIVE_IMPORT_TTL_MS = 15_000;
const activeImportCache = new Map<string, { at: number; value: ImportRow | null }>();

export async function getActiveImport(db: ComplianceDb, kind: "dfat" | "pep_wikidata"): Promise<ImportRow | null> {
  const cached = activeImportCache.get(kind);
  if (cached && Date.now() - cached.at < ACTIVE_IMPORT_TTL_MS) return cached.value;
  const { data, error } = await db.from("compliance_list_imports")
    .select("id, entry_count, latest_control_date, created_at, activated_at, source_name, notes")
    .eq("kind", kind).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  const value = (data as ImportRow | null) ?? null;
  activeImportCache.set(kind, { at: Date.now(), value });
  return value;
}

export async function getListStatus(db: ComplianceDb, kind: "dfat" | "pep_wikidata"): Promise<ListStatus> {
  const active = await getActiveImport(db, kind);
  return {
    kind,
    importId: active?.id ?? null,
    entryCount: active?.entry_count ?? 0,
    latestControlDate: active?.latest_control_date ?? null,
    importedAt: active?.activated_at ?? active?.created_at ?? null,
    sourceName: active?.source_name ?? null,
    notes: active?.notes ?? null,
  };
}

const PAGE_CONCURRENCY = 6;

async function fetchPage<T>(db: ComplianceDb, table: string, columns: string, importId: string, page: number): Promise<T[]> {
  for (let attempt = 1; ; attempt++) {
    const { data, error } = await db.from(table).select(columns).eq("import_id", importId)
      .order("id", { ascending: true }).range(page * PAGE, page * PAGE + PAGE - 1);
    if (!error) return (data ?? []) as T[];
    if (attempt >= 2) throw error;
  }
}

/** Reads a whole list a few pages at a time (a burst of parallel requests can time out) and retries a page once. */
async function fetchAllRows<T>(db: ComplianceDb, table: string, columns: string, importId: string, expected: number): Promise<T[]> {
  const pages = Math.max(1, Math.ceil(expected / PAGE));
  const rows: T[] = [];
  for (let from = 0; from < pages; from += PAGE_CONCURRENCY) {
    const batch = await Promise.all(Array.from({ length: Math.min(PAGE_CONCURRENCY, pages - from) }, (_, offset) => fetchPage<T>(db, table, columns, importId, from + offset)));
    for (const part of batch) rows.push(...part);
  }
  return rows;
}

// ── DFAT runtime ───────────────────────────────────────────────────────────────

/** Matching payload only; everything shown to the admin is read for the matched entries afterwards. */
type DfatMeta = { id: string; group_ref: string; name: string; name_type: string | null; dob: string | null; low_relevance?: boolean | null };
type SanctionsRuntime = { importId: string; index: NameIndex; byId: Map<string, DfatMeta>; primaryByGroup: Map<string, DfatMeta> };
type PepMeta = { id: string; wikidata_id: string; name: string; is_alias: boolean; dob: string | null };
type PepRuntime = { importId: string; index: NameIndex; byId: Map<string, PepMeta>; primaryByQid: Map<string, PepMeta> };

let sanctionsCache: SanctionsRuntime | null = null;
let sanctionsLoading: Promise<SanctionsRuntime | null> | null = null;
let pepCache: PepRuntime | null = null;
let pepLoading: Promise<PepRuntime | null> | null = null;

export async function loadSanctions(db: ComplianceDb): Promise<SanctionsRuntime | null> {
  const active = await getActiveImport(db, "dfat");
  if (!active) return null;
  if (sanctionsCache?.importId === active.id) return sanctionsCache;
  if (!sanctionsLoading) {
    sanctionsLoading = (async () => {
      // low_relevance needs migration 70; until it is applied every row is matched normally.
      let rows: DfatMeta[];
      try {
        rows = await fetchAllRows<DfatMeta>(db, "sanctions_entries", "id, group_ref, name, name_type, dob, low_relevance", active.id, active.entry_count);
      } catch (error) {
        if (!isComplianceUnavailable(error)) throw error;
        rows = await fetchAllRows<DfatMeta>(db, "sanctions_entries", "id, group_ref, name, name_type, dob", active.id, active.entry_count);
      }
      const byId = new Map(rows.map(row => [row.id, row]));
      const primaryByGroup = new Map<string, DfatMeta>();
      for (const row of rows) if (row.name_type === "Primary Name" && !primaryByGroup.has(row.group_ref)) primaryByGroup.set(row.group_ref, row);
      const index = new NameIndex(rows.map(row => ({ id: row.id, name: row.name, dobText: row.dob, strict: row.low_relevance === true })));
      sanctionsCache = { importId: active.id, index, byId, primaryByGroup };
      return sanctionsCache;
    })().finally(() => { sanctionsLoading = null; });
  }
  return sanctionsLoading;
}

export async function loadPeps(db: ComplianceDb): Promise<PepRuntime | null> {
  const active = await getActiveImport(db, "pep_wikidata");
  if (!active) return null;
  if (pepCache?.importId === active.id) return pepCache;
  if (!pepLoading) {
    pepLoading = (async () => {
      const rows = await fetchAllRows<PepMeta>(db, "pep_entries", "id, wikidata_id, name, is_alias, dob", active.id, active.entry_count);
      const byId = new Map(rows.map(row => [row.id, row]));
      const primaryByQid = new Map<string, PepMeta>();
      for (const row of rows) if (!row.is_alias && !primaryByQid.has(row.wikidata_id)) primaryByQid.set(row.wikidata_id, row);
      const index = new NameIndex(rows.map(row => ({ id: row.id, name: row.name, dobText: row.dob })));
      pepCache = { importId: active.id, index, byId, primaryByQid };
      return pepCache;
    })().finally(() => { pepLoading = null; });
  }
  return pepLoading;
}

/** Drops cached indexes (used after an import so the next screening reloads). */
export function resetComplianceCaches() {
  sanctionsCache = null;
  pepCache = null;
  activeImportCache.clear();
}

// ── Screening ──────────────────────────────────────────────────────────────────

export type InternalScreeningResult =
  | { outcome: "clear" | "potential_match"; topScore: number | null; matches: ScreeningMatch[]; importId: string }
  | { outcome: "failed"; error: string };

const clip = (value: string | null | undefined, limit = DETAIL_LIMIT) => {
  if (!value) return null;
  return value.length > limit ? `${value.slice(0, limit)}…` : value;
};

function bestPerGroup(hits: NameHit[], groupOf: (id: string) => string | undefined): Array<{ group: string; hit: NameHit }> {
  const seen = new Set<string>();
  const out: Array<{ group: string; hit: NameHit }> = [];
  for (const hit of hits) {
    const group = groupOf(hit.id);
    if (!group || seen.has(group)) continue;
    seen.add(group);
    out.push({ group, hit });
    if (out.length >= MAX_MATCH_GROUPS) break;
  }
  return out;
}

export async function screenSanctions(db: ComplianceDb, name: string, dob: string | null): Promise<InternalScreeningResult> {
  const runtime = await loadSanctions(db);
  if (!runtime) return { outcome: "failed", error: "No DFAT Consolidated List has been loaded. Upload it on the Compliance lists page." };
  const trimmed = name.trim();
  if (!trimmed) return { outcome: "failed", error: "No name available to screen." };

  const hits = runtime.index.search(trimmed, dob, SANCTIONS_SEARCH);
  if (!hits.length) return { outcome: "clear", topScore: null, matches: [], importId: runtime.importId };

  const groups = bestPerGroup(hits, id => runtime.byId.get(id)?.group_ref);
  const { data: detailRows, error } = await db.from("sanctions_entries")
    .select("group_ref, name, entry_type, dob, place_of_birth, citizenship, address, listing_information, committees, instrument, additional_information, control_date")
    .eq("import_id", runtime.importId).eq("name_type", "Primary Name").in("group_ref", groups.map(item => item.group));
  if (error) throw error;
  const details = new Map((detailRows ?? []).map(row => [row.group_ref as string, row]));

  const matches: ScreeningMatch[] = groups.map(({ group, hit }) => {
    const matched = runtime.byId.get(hit.id)!;
    const primary = details.get(group);
    return {
      source: "dfat",
      reference: group,
      listedName: primary?.name ?? runtime.primaryByGroup.get(group)?.name ?? matched.name,
      matchedName: matched.name,
      entryType: primary?.entry_type ?? null,
      percent: hit.percent,
      strength: hit.strength,
      dob: hit.dob,
      listedDob: clip(primary?.dob ?? matched.dob, 120),
      details: {
        "Place of birth": clip(primary?.place_of_birth, 200),
        Citizenship: clip(primary?.citizenship, 200),
        Address: clip(primary?.address, 300),
        Committees: clip(primary?.committees, 200),
        "Instrument of designation": clip(primary?.instrument, 300),
        "Listing information": clip(primary?.listing_information),
        "Additional information": clip(primary?.additional_information),
        "Last control date": primary?.control_date ?? null,
      },
    };
  });
  return { outcome: "potential_match", topScore: matches[0]?.percent ?? null, matches, importId: runtime.importId };
}

export async function screenPep(db: ComplianceDb, name: string, dob: string | null): Promise<InternalScreeningResult> {
  const runtime = await loadPeps(db);
  if (!runtime) return { outcome: "failed", error: "No PEP list has been loaded. Run the Wikidata PEP import (see the Compliance lists page)." };
  const trimmed = name.trim();
  if (!trimmed) return { outcome: "failed", error: "No name available to screen." };

  const hits = runtime.index.search(trimmed, dob, PEP_SEARCH);
  if (!hits.length) return { outcome: "clear", topScore: null, matches: [], importId: runtime.importId };

  const groups = bestPerGroup(hits, id => runtime.byId.get(id)?.wikidata_id);
  const { data: detailRows, error } = await db.from("pep_entries")
    .select("wikidata_id, country, positions, is_current")
    .eq("import_id", runtime.importId).eq("is_alias", false).in("wikidata_id", groups.map(item => item.group));
  if (error) throw error;
  const details = new Map((detailRows ?? []).map(row => [row.wikidata_id as string, row]));
  const matches: ScreeningMatch[] = groups.map(({ group, hit }) => {
    const matched = runtime.byId.get(hit.id)!;
    const primary = runtime.primaryByQid.get(group) ?? matched;
    const detail = details.get(group);
    return {
      source: "pep",
      reference: group,
      listedName: primary.name,
      matchedName: matched.name,
      entryType: "Politically exposed person",
      percent: hit.percent,
      strength: hit.strength,
      dob: hit.dob,
      listedDob: primary.dob,
      details: {
        Country: detail?.country ?? null,
        Positions: clip(((detail?.positions ?? []) as string[]).join("; "), 400),
        Status: detail ? (detail.is_current ? "Listed as a current office holder (Wikidata)" : "Former office holder") : null,
        Source: `Wikidata https://www.wikidata.org/wiki/${group}`,
      },
    };
  });
  return { outcome: "potential_match", topScore: matches[0]?.percent ?? null, matches, importId: runtime.importId };
}
