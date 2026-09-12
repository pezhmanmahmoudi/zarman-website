/** Accept plain decimals or correctly grouped thousands; never save a numeric prefix. */
export function parseAdminAmount(input: string): number | null {
  const trimmed = input.trim();
  if (!/^(?:(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d*)?|\.\d+)$/.test(trimmed)) return null;
  const amount = Number(trimmed.replace(/,/g, ""));
  return Number.isFinite(amount) && amount > 0 && amount <= Number.MAX_SAFE_INTEGER ? amount : null;
}
