/** Only return to this locale's authenticated dashboard after sign-in. */
export function dashboardReturnPath(value: string | null | undefined, locale: string): string {
  const prefix = `/${locale === "en" ? "en" : "fa"}/dashboard`;
  if (!value || value.length > 1000 || /[\\\u0000-\u001f]/.test(value)) return prefix;
  try {
    const parsed = new URL(value, "https://zarman.invalid");
    if (parsed.origin !== "https://zarman.invalid" || (parsed.pathname !== prefix && !parsed.pathname.startsWith(`${prefix}/`))) return prefix;
    return parsed.pathname + parsed.search;
  } catch { return prefix; }
}
