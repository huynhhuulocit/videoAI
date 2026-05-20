"use client";

import { useI18n } from "./language-provider";
import type { TranslationKey, TranslationValues } from "../../lib/i18n/dictionary";

type I18nTextProps = {
  id: TranslationKey;
  values?: TranslationValues;
};

export function I18nText({ id, values }: I18nTextProps) {
  const { t } = useI18n();
  return <>{t(id, values)}</>;
}
