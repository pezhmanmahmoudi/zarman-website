/** Localised display only. Financial values and bank identifiers stay unchanged. */
export function dashboardNumber(value: number, locale: string, maximumFractionDigits = 0) {
  return new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-AU", { maximumFractionDigits }).format(value);
}

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
  const grouped = dashboardNumber(Number(integer || "0"), locale);
  if (fraction === undefined) return grouped;
  const digits = locale === "fa" ? fraction.replace(/\d/g, digit => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]) : fraction;
  return `${grouped}${locale === "fa" ? "٫" : "."}${digits}`;
}
