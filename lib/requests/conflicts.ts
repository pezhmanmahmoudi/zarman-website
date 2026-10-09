export const REQUEST_CONFLICT_MESSAGE = "This request has changed. Refresh the page before continuing.";

/** A stale business version is terminal for this attempt, never a retry signal. */
export function isRequestConflict(error: unknown): boolean {
  if (typeof error === "string") return error.includes("REQUEST_CONFLICT") || error === REQUEST_CONFLICT_MESSAGE;
  if (!error || typeof error !== "object") return false;
  const value = error as { code?: unknown; message?: unknown; error?: unknown };
  return value.code === "40001" || value.code === "PT409" || value.code === "REQUEST_CONFLICT"
    || (typeof value.message === "string" && isRequestConflict(value.message))
    || (typeof value.error === "string" && isRequestConflict(value.error));
}
