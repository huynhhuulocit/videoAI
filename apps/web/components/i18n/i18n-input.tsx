"use client";

import type { InputHTMLAttributes } from "react";
import { useI18n } from "./language-provider";
import type { TranslationKey } from "../../lib/i18n/dictionary";

type I18nInputProps = InputHTMLAttributes<HTMLInputElement> & {
  placeholderId?: TranslationKey;
};

export function I18nInput({ placeholderId, ...props }: I18nInputProps) {
  const { t } = useI18n();
  return <input {...props} placeholder={placeholderId ? t(placeholderId) : props.placeholder} />;
}
