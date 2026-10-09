/**
 * Display convention: Persian digits and thousands separator (۱٬۲۱۲.۲۵),
 * with a dot for decimals so the font's slash-shaped ٫ cannot be confused
 * with grouping. English keeps its native separators (1,212.25).
 * Only display strings are localised; financial values stay numeric.
 */
export function formatLocalizedNumber(value: number, locale: string, options: Intl.NumberFormatOptions = {}) {
  const persian = locale === "fa" || locale.startsWith("fa-");
  const formatted = new Intl.NumberFormat(persian ? "fa-IR" : "en-AU", options).format(value);
  return persian ? formatted.replace(/٫/g, ".") : formatted;
}

/** Accept existing Persian/Arabic amounts and pasted English amounts. */
export function normaliseAmountDigits(value: string) {
  return value.replace(/[۰-۹]/g, digit => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/٫/g, ".").replace(/[٬،,\s\u200e\u200f]/g, "");
}

/** Retains a partially entered decimal and leading fractional zeros while typing. */
export function localiseAmountDraft(value: string, locale: string) {
  const raw = normaliseAmountDigits(value);
  if (!raw) return "";
  if ((raw.match(/\./g) || []).length > 1) return value;
  const [integer, fraction] = raw.split(".");
  if (!/^\d*$/.test(integer) || (fraction !== undefined && !/^\d*$/.test(fraction))) return value;
  const grouped = formatLocalizedNumber(Number(integer || "0"), locale, { maximumFractionDigits: 0 });
  if (fraction === undefined) return grouped;
  const persian = locale === "fa" || locale.startsWith("fa-");
  const digits = persian ? fraction.replace(/\d/g, digit => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]) : fraction;
  return `${grouped}.${digits}`;
}
