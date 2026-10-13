type ReadError = { message: string; code?: string };
type Page<Row> = { data: Row[] | null; error: ReadError | null };

/** Read a complete, deterministically ordered financial source. A short page
 * can reflect a server limit lower than our requested size, so only an empty
 * page ends the scan. Failed or overlapping pages never return partial totals. */
export async function readAllFinancialRows<Row>(
  fetchPage: (from: number, to: number) => PromiseLike<Page<Row>>,
  key: "id" | "request_id" = "id",
  pageSize = 200,
): Promise<Page<Row>> {
  if (!Number.isInteger(pageSize) || pageSize < 1) throw new Error("Invalid financial page size.");
  const rows: Row[] = [];
  const seen = new Set<string>();
  for (;;) {
    const result = await fetchPage(rows.length, rows.length + pageSize - 1);
    if (result.error) return { data: null, error: result.error };
    if (!Array.isArray(result.data)) {
      return { data: null, error: { code: "FINANCIAL_READ_INCOMPLETE", message: "Financial source returned no readable page." } };
    }
    if (result.data.length === 0) return { data: rows, error: null };
    for (const row of result.data) {
      const value = (row as Record<string, unknown>)[key];
      if (typeof value !== "string" || !value || seen.has(value)) {
        return { data: null, error: { code: "FINANCIAL_READ_OVERLAP", message: "Financial rows changed or overlapped during pagination; retry the report." } };
      }
      seen.add(value);
    }
    rows.push(...result.data);
  }
}
