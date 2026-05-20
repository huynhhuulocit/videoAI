"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useI18n } from "../i18n/language-provider";

type BackButtonProps = {
  fallbackHref: string;
};

export function BackButton({ fallbackHref }: BackButtonProps) {
  const router = useRouter();
  const { t } = useI18n();

  function goBack() {
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push(fallbackHref);
  }

  return (
    <button
      type="button"
      onClick={goBack}
      className="inline-flex h-8 items-center gap-2 rounded-md border border-border bg-white px-2.5 text-xs font-medium text-muted-foreground shadow-sm transition hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-sky-200"
      aria-label={t("common.back")}
    >
      <ArrowLeft size={14} />
      {t("common.back")}
    </button>
  );
}
