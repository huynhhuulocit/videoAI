"use client";

import type { TextareaHTMLAttributes } from "react";
import { useI18n } from "../i18n/language-provider";

type TextareaWithCounterProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export function TextareaWithCounter({
  className = "",
  value,
  defaultValue,
  ...props
}: TextareaWithCounterProps) {
  const { t } = useI18n();
  const currentValue =
    typeof value === "string"
      ? value
      : typeof defaultValue === "string"
        ? defaultValue
        : "";

  return (
    <div className="relative">
      <textarea
        value={value}
        defaultValue={defaultValue}
        className={`${className} pb-8`}
        {...props}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-2 left-3 text-[11px] leading-none text-muted-foreground"
      >
        {t("common.characterCount", { count: currentValue.length })}
      </span>
    </div>
  );
}
