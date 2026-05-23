"use client";

import { useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  PlugZap,
  ShieldCheck,
} from "lucide-react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { useI18n } from "../i18n/language-provider";

type ChromeRuntime = {
  sendMessage?: (
    extensionId: string,
    message: unknown,
    callback?: (response: unknown) => void,
  ) => void;
  lastError?: { message?: string };
};

type ChromeWindow = Window & {
  chrome?: {
    runtime?: ChromeRuntime;
  };
};

const aiHandoffEnabled = process.env.NEXT_PUBLIC_AI_HANDOFF_ENABLED === "true";
const extensionId =
  process.env.NEXT_PUBLIC_AI_HANDOFF_EXTENSION_ID?.trim() ?? "";
const extensionUrl =
  process.env.NEXT_PUBLIC_AI_HANDOFF_EXTENSION_URL?.trim() ?? "";

export function AiHandoffInstallCard() {
  const { t } = useI18n();
  const [isChecking, setIsChecking] = useState(false);
  const [message, setMessage] = useState("");
  const hasExtensionId = extensionId.length > 0;
  const hasExtensionUrl = extensionUrl.length > 0;

  function openInstall() {
    window.location.assign(extensionUrl);
  }

  function checkInstalled() {
    if (!hasExtensionId) {
      setMessage(t("home.aiHandoffExtensionIdMissing"));
      return;
    }

    const runtime = (window as ChromeWindow).chrome?.runtime;
    if (!runtime?.sendMessage) {
      setMessage(t("home.aiHandoffNotDetected"));
      return;
    }

    setIsChecking(true);
    setMessage(t("home.aiHandoffChecking"));
    runtime.sendMessage(
      extensionId,
      { type: "VIDEOAI_AI_HANDOFF_PING" },
      (response) => {
        setIsChecking(false);
        if (runtime.lastError) {
          setMessage(
            runtime.lastError.message || t("home.aiHandoffNotDetected"),
          );
          return;
        }
        if (response && typeof response === "object" && "ok" in response) {
          setMessage(t("home.aiHandoffDetected"));
          return;
        }
        setMessage(t("home.aiHandoffNotDetected"));
      },
    );
  }

  return (
    <Card>
      <div className="flex items-start gap-4">
        <PlugZap className="text-sky-600" />
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">{t("home.aiHandoffTitle")}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {t("home.aiHandoffBody")}
          </p>
          <p className="mt-2 flex gap-2 text-xs leading-5 text-muted-foreground">
            <ShieldCheck
              size={14}
              className="mt-0.5 shrink-0 text-emerald-600"
            />
            <span>{t("home.aiHandoffSafety")}</span>
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {hasExtensionUrl ? (
              <Button type="button" className="gap-2" onClick={openInstall}>
                {t("home.aiHandoffInstall")}
                <ExternalLink size={15} />
              </Button>
            ) : (
              <Button
                type="button"
                variant="secondary"
                className="gap-2"
                disabled
                title={t("home.aiHandoffLocalInstallMode")}
              >
                {t("home.aiHandoffInstallUnavailable")}
              </Button>
            )}
            <Button
              type="button"
              variant="secondary"
              className="gap-2"
              disabled={isChecking}
              onClick={checkInstalled}
            >
              {isChecking ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <CheckCircle2 size={15} />
              )}
              {t("home.aiHandoffCheck")}
            </Button>
          </div>
          {!hasExtensionUrl ? (
            <div className="mt-3 rounded-md border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-900">
              {t("home.aiHandoffLocalInstallMode")}
            </div>
          ) : null}
          {message ? (
            <div className="mt-3 rounded-md border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-900">
              {message}
            </div>
          ) : null}
          {!aiHandoffEnabled ? (
            <div className="mt-3 rounded-md border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {t("home.aiHandoffDisabled")}
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
