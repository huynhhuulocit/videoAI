"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import {
  translate,
  type TranslationKey,
  type TranslationValues
} from "../../lib/i18n/dictionary";

type LanguageContextValue = {
  t: (key: TranslationKey, values?: TranslationValues) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const value = useMemo<LanguageContextValue>(
    () => ({
      t: translate
    }),
    []
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useI18n() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useI18n must be used inside LanguageProvider");
  }
  return context;
}
