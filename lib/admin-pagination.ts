export const ADMIN_PAGE_SIZES = [10, 20, 25, 50] as const;
// The admin read actions cap page requests at this value.
export const ADMIN_MAX_PAGE = 10_000;

export function parseAdminPage(value: string | undefined): number {
  const page = Number(value);
  return Number.isSafeInteger(page) ? Math.min(ADMIN_MAX_PAGE, Math.max(1, page)) : 1;
}

export function parseAdminPageSize(value: string | undefined, fallback = 10): number {
  const size = Number(value);
  return ADMIN_PAGE_SIZES.some(option => option === size) ? size : fallback;
}

/** Preserve every active filter, including repeated keys, when moving through results. */
export function adminPaginationHref(pathname: string, query: string, page: number, pageSize?: number): string {
  const params = new URLSearchParams(query);
  params.set("page", String(page));
  if (pageSize !== undefined) params.set("pageSize", String(pageSize));
  return `${pathname}?${params.toString()}`;
}

/** Reject incomplete/fractional input; clamp valid jumps to the available pages. */
export function parseAdminPageJump(value: string, totalPages: number): number | null {
  const text = value.trim();
  if (!/^[+-]?\d+$/.test(text) || totalPages < 1) return null;
  const page = Number(text);
  if (!Number.isFinite(page)) return null;
  return Math.max(1, Math.min(totalPages, page));
}

export function getAdminPaginationState(currentPage: number, totalCount: number, pageSize: number) {
  const count = Number.isFinite(totalCount) ? Math.max(0, Math.floor(totalCount)) : 0;
  const size = Number.isSafeInteger(pageSize) && pageSize > 0 ? pageSize : 10;
  const page = Number.isSafeInteger(currentPage) && currentPage > 0 ? currentPage : 1;
  const requestedTotalPages = Math.ceil(count / size);
  const totalPages = Math.min(ADMIN_MAX_PAGE, requestedTotalPages);
  const outOfRange = count > 0 && page > totalPages;
  return {
    page,
    count,
    totalPages,
    hasPageLimit: requestedTotalPages > totalPages,
    outOfRange,
    start: count === 0 || outOfRange ? 0 : (page - 1) * size + 1,
    end: count === 0 || outOfRange ? 0 : Math.min(page * size, count),
    previousPage: Math.max(1, Math.min(page - 1, totalPages)),
  };
}
