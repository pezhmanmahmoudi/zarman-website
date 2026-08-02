"use client";

import React, { createContext, useContext } from "react";

type Locale = "fa" | "en";

const LocaleContext = createContext<Locale>("fa");

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return (
    <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
  );
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}
