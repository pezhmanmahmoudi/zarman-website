/** First and last name initials; do not substitute emails or invent a name. */
export function nameInitials(name?: string | null): string {
  const parts = (name || "").normalize("NFC").trim().split(/\s+/)
    .map(part => part.match(/\p{L}[\p{L}\p{M}]*/u)?.[0]).filter((part): part is string => Boolean(part));
  if (!parts.length) return "—";
  const first = Array.from(parts[0])[0];
  const last = parts.length > 1 ? Array.from(parts[parts.length - 1])[0] : "";
  return [first, last].filter(Boolean).join(/\p{Script=Arabic}/u.test(first + last) ? "\u200c" : "").toUpperCase();
}
