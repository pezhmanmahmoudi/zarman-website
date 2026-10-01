export const DASHBOARD_PAGE_SIZE = 5;

/** Keeps only letters, digits, spaces, "@" and "-" so the term is safe inside a PostgREST `or` filter. */
export function cleanSearchTerm(value: unknown) {
  if (typeof value !== "string") return "";
  return value.normalize("NFKC").replace(/ي/g, "ی").replace(/ك/g, "ک").replace(/[\u200c\u200d]/g, " ")
    .replace(/[^\p{L}\p{N}\s@-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 64);
}

export function ilikeAny(columns: readonly string[], term: string) {
  return columns.map(column => `${column}.ilike."*${term}*"`).join(",");
}

export function requestedPage(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : 1;
}
