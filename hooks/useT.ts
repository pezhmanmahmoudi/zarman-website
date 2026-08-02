"use client";

import { useLocale } from "@/context/LocaleContext";
import { getDictionary, type Dictionary } from "@/lib/i18n";

export function useT(): Dictionary {
  const locale = useLocale();
  return getDictionary(locale);
}
