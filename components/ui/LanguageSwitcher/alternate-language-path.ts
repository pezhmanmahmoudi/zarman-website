type Locale = "fa" | "en";

// Deliberately small: do not ship complete article HTML to the navigation client.
export const blogLanguagePaths: ReadonlyArray<Record<Locale, string>> = [
  { en: "aud-to-irt-exchange-rate-guide", fa: "rahnamaye-nerkh-aud-irt" },
  { en: "send-money-australia-to-iran", fa: "havaleh-az-australia-be-iran" },
];

export function getAlternateLanguagePath(pathname: string, targetLocale: Locale): string {
  const path = pathname.replace(/^\/(fa|en)(?=\/|$)/, "").replace(/\/$/, "");
  const article = path.match(/^\/blog\/([^/]+)$/);
  if (article) {
    const translation = blogLanguagePaths.find((pair) =>
      Object.values(pair).includes(article[1]),
    );
    return translation ? `/${targetLocale}/blog/${translation[targetLocale]}` : `/${targetLocale}/blog`;
  }
  return `/${targetLocale}${path === "/" ? "" : path}`;
}

/** Homepage section IDs are shared by both languages; article headings may not be. */
export function getSharedLanguageHash(pathname: string, hash: string): string {
  if (hash === "#main-content") return hash;
  if (!/^\/(fa|en)?\/?$/.test(pathname)) return "";
  return ["#hero", "#rates", "#about", "#services", "#how-it-works", "#faq", "#contact"].includes(hash)
    ? hash
    : "";
}
