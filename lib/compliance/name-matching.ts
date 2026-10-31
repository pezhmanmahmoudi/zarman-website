// lib/compliance/name-matching.ts
// Pure, dependency-free fuzzy name matching for the internal DFAT sanctions and
// PEP screening engines. Tuned for Iranian/Arabic names written in Latin script
// (Mohammad / Muhammad / Mohamad, Hossein / Hussein / Hosein, Khamenei / Khameneh'i)
// and for Persian-script names. No I/O: callers load the list and pass it in.

export type NameScript = "latin" | "arabic";

export type MatchableName = {
  /** Caller-defined unique id of the list row (sanctions row id, PEP name id...). */
  id: string;
  name: string;
  /** Free-text DOB as listed (DFAT lists years, ranges and "Approximately ..."). */
  dobText?: string | null;
  /** Low-relevance listing: only reported on a strong match (see STRICT_MIN_SCORE). */
  strict?: boolean;
};

export type NameHit = {
  id: string;
  /** 0..1 similarity of the best token alignment. */
  score: number;
  /** 100 for identical token sets, otherwise rounded score*100. */
  percent: number;
  dob: DobComparison;
  matchedTokens: number;
  strength: "strong" | "possible";
};

export type DobComparison = "match" | "mismatch" | "unknown";

export type SearchOptions = {
  /** Minimum score when the DOB matches or either DOB is unknown. */
  threshold: number;
  /** Minimum score when both DOBs are known and clearly different. */
  dobMismatchThreshold: number;
  /** Score at or above which a hit is reported as "strong". */
  strongThreshold: number;
  maxResults: number;
};

export const SANCTIONS_SEARCH: SearchOptions = { threshold: 0.78, dobMismatchThreshold: 0.92, strongThreshold: 0.95, maxResults: 25 };
export const PEP_SEARCH: SearchOptions = { threshold: 0.85, dobMismatchThreshold: 0.95, strongThreshold: 0.96, maxResults: 15 };

const TOKEN_SIMILARITY_FLOOR = 0.8;
/** Low-relevance rows need at least this score, and either a matching DOB or an identical name. */
export const STRICT_MIN_SCORE = 0.95;
const ARABIC_SCRIPT = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;

export function detectScript(value: string): NameScript {
  return ARABIC_SCRIPT.test(value) ? "arabic" : "latin";
}

// ── Normalisation ──────────────────────────────────────────────────────────────

export function normalizeLatin(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeArabic(value: string): string {
  return value
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[‌‍‎‏]/g, " ")
    .replace(/[يىئ]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[ةہۀ]/g, "ه")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ؤ/g, "و")
    .replace(/[^؀-ۿ\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Collapses common transliteration variants of one Latin token to a shared key.
 * Mohammad, Muhammad, Mohamad, Mohammed -> "muhamad"; Hossein, Hussein, Hosein -> "husain".
 */
export function phoneticKey(token: string): string {
  let s = token.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!s) return "";
  s = s
    .replace(/ph/g, "f")
    .replace(/kh/g, "1")
    .replace(/gh/g, "g")
    .replace(/sh/g, "2")
    .replace(/ch/g, "3")
    .replace(/zh/g, "4")
    .replace(/th/g, "s")
    .replace(/dh/g, "z")
    .replace(/ck/g, "k")
    .replace(/q/g, "g")
    .replace(/c/g, "k")
    .replace(/w/g, "v")
    .replace(/x/g, "ks")
    .replace(/ou|oo|ow|o/g, "u")
    .replace(/e/g, "a")
    .replace(/y/g, "i")
    .replace(/(.)\1+/g, "$1")
    .replace(/([aiu])h$/, "$1");
  return s;
}

export type PreparedName = {
  script: NameScript;
  tokens: string[];
  keys: string[];
};

export function prepareName(value: string): PreparedName {
  const script = detectScript(value);
  if (script === "arabic") {
    const tokens = normalizeArabic(value).split(" ").filter(Boolean);
    return { script, tokens, keys: tokens };
  }
  const tokens = normalizeLatin(value).split(" ").filter(Boolean);
  return { script, tokens, keys: tokens.map(phoneticKey).filter(Boolean) };
}

// ── Similarity ─────────────────────────────────────────────────────────────────

export function levenshtein(a: string, b: string, max = Infinity): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let previous = new Array<number>(b.length + 1);
  let current = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) previous[j] = j;
  for (let i = 1; i <= a.length; i++) {
    current[0] = i;
    let rowMin = current[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      if (current[j] < rowMin) rowMin = current[j];
    }
    if (rowMin > max) return max + 1;
    [previous, current] = [current, previous];
  }
  return previous[b.length];
}

/** Similarity of two phonetic keys, 0..1. Very short tokens must match exactly. */
export function keySimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const longest = Math.max(a.length, b.length);
  if (Math.min(a.length, b.length) <= 3) return 0;
  const distance = levenshtein(a, b, Math.ceil(longest * (1 - TOKEN_SIMILARITY_FLOOR)));
  const similarity = 1 - distance / longest;
  return similarity >= TOKEN_SIMILARITY_FLOOR ? similarity : 0;
}

/**
 * Order-insensitive token alignment (weighted Dice): "Ali Mohammadi" == "Mohammadi Ali", and a
 * listed name with extra middle/patronymic tokens still scores sensibly.
 *
 * Tokens are weighted by rarity. Common given names (Mohammad, Hossein, Ali) appear in hundreds
 * of listings, so matching only those must not look like a match; an unmatched distinctive family
 * name must pull the score down. Without weights every token counts the same and a query like
 * "Mohammad Hossein Chinaei" scored 80% against an unrelated alias "Hussein Muhammad".
 */
export function scoreKeys(queryKeys: string[], entryKeys: string[], weights?: { query: number[]; entry: number[] }): { score: number; matched: number } {
  if (!queryKeys.length || !entryKeys.length) return { score: 0, matched: 0 };
  const wq = (index: number) => weights?.query[index] ?? 1;
  const we = (index: number) => weights?.entry[index] ?? 1;
  const pairs: Array<{ q: number; e: number; sim: number }> = [];
  for (let q = 0; q < queryKeys.length; q++) {
    for (let e = 0; e < entryKeys.length; e++) {
      const sim = keySimilarity(queryKeys[q], entryKeys[e]);
      if (sim > 0) pairs.push({ q, e, sim });
    }
  }
  pairs.sort((x, y) => y.sim - x.sim);
  const usedQ = new Set<number>();
  const usedE = new Set<number>();
  let total = 0;
  let matched = 0;
  for (const pair of pairs) {
    if (usedQ.has(pair.q) || usedE.has(pair.e)) continue;
    usedQ.add(pair.q);
    usedE.add(pair.e);
    total += pair.sim * (wq(pair.q) + we(pair.e));
    matched += 1;
  }
  let weightSum = 0;
  for (let q = 0; q < queryKeys.length; q++) weightSum += wq(q);
  for (let e = 0; e < entryKeys.length; e++) weightSum += we(e);
  return { score: total / weightSum, matched };
}

// ── Date of birth ──────────────────────────────────────────────────────────────

export function listedYears(dobText: string | null | undefined): number[] {
  if (!dobText) return [];
  const years = new Set<number>();
  for (const match of String(dobText).matchAll(/\b(1[89]\d{2}|20\d{2})\b/g)) years.add(Number(match[1]));
  return [...years];
}

export function compareDob(queryIso: string | null | undefined, listedText: string | null | undefined): DobComparison {
  const queryYear = Number(String(queryIso ?? "").slice(0, 4));
  if (!Number.isInteger(queryYear) || queryYear < 1800) return "unknown";
  const years = listedYears(listedText);
  if (!years.length) return "unknown";
  return years.includes(queryYear) ? "match" : "mismatch";
}

// ── Index ──────────────────────────────────────────────────────────────────────

type IndexedRow = { row: MatchableName; prepared: PreparedName; years: number[]; strict: boolean };

/**
 * In-memory inverted index over name tokens. Built once per list version; a search
 * only scores rows that share at least one near-identical token with the query, so a
 * lookup over ~11,000 DFAT rows takes a few milliseconds.
 */
export class NameIndex {
  private readonly rows: IndexedRow[] = [];
  private readonly vocabulary = new Map<string, number[]>();

  constructor(names: MatchableName[]) {
    for (const row of names) {
      const prepared = prepareName(row.name);
      if (!prepared.keys.length) continue;
      const position = this.rows.length;
      this.rows.push({ row, prepared, years: listedYears(row.dobText), strict: row.strict === true });
      for (const key of new Set(prepared.keys)) {
        const bucket = this.vocabulary.get(`${prepared.script}:${key}`);
        if (bucket) bucket.push(position);
        else this.vocabulary.set(`${prepared.script}:${key}`, [position]);
      }
    }
  }

  get size() { return this.rows.length; }

  /** Rarity weight of a token: ~1 for names found in most rows, up to ~10 for unseen ones. */
  private weight(script: NameScript, key: string): number {
    const frequency = Math.max(1, this.vocabulary.get(`${script}:${key}`)?.length ?? 1);
    return Math.log(Math.max(this.rows.length, 2) / frequency) + 1;
  }

  search(name: string, dobIso: string | null | undefined, options: SearchOptions): NameHit[] {
    const query = prepareName(name);
    if (!query.keys.length) return [];
    const prefix = `${query.script}:`;

    const candidates = new Set<number>();
    for (const key of new Set(query.keys)) {
      for (const [entryKey, positions] of this.vocabulary) {
        if (!entryKey.startsWith(prefix)) continue;
        if (keySimilarity(key, entryKey.slice(prefix.length)) > 0) for (const position of positions) candidates.add(position);
      }
    }

    const hits: NameHit[] = [];
    for (const position of candidates) {
      const { row, prepared, years, strict } = this.rows[position];
      const { score, matched } = scoreKeys(query.keys, prepared.keys, {
        query: query.keys.map(key => this.weight(query.script, key)),
        entry: prepared.keys.map(key => this.weight(prepared.script, key)),
      });
      // A one-token query is only meaningful against a one-token listing; otherwise
      // require at least two aligned tokens (given/family name) to avoid first-name noise.
      const required = Math.min(2, query.keys.length, prepared.keys.length);
      if (matched < required || score < options.threshold) continue;
      const dob = compareDob(dobIso, row.dobText ?? (years.length ? years.join(", ") : null));
      if (dob === "mismatch" && score < options.dobMismatchThreshold) continue;
      const identical = score >= 0.999 && query.keys.length === prepared.keys.length;
      if (strict && (dob === "mismatch" || score < STRICT_MIN_SCORE || (dob !== "match" && !identical))) continue;
      hits.push({
        id: row.id,
        score,
        percent: identical ? 100 : Math.min(99, Math.round(score * 100)),
        dob,
        matchedTokens: matched,
        strength: score >= options.strongThreshold && dob !== "mismatch" ? "strong" : "possible",
      });
    }
    hits.sort((a, b) => b.score - a.score || (a.dob === "match" ? -1 : 1));
    return hits.slice(0, options.maxResults);
  }
}
