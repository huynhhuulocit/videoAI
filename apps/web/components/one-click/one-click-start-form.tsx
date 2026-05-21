"use client";

import type { CreateProjectRequest, Project } from "@videoai/contracts";
import { Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "../i18n/language-provider";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { TextareaWithCounter } from "../ui/textarea-with-counter";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? "http://localhost:4000";

type ApiSuccess<T> = {
  data: T;
};

export function OneClickStartForm() {
  const router = useRouter();
  const { t } = useI18n();
  const [name, setName] = useState(() => t("oneClick.namePlaceholder"));
  const [description, setDescription] = useState(() =>
    t("oneClick.wizardDescription"),
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function createProject() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage(t("oneClick.errorName"));
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    const body: CreateProjectRequest = {
      name: trimmedName,
      description: description.trim() || t("oneClick.wizardDescription"),
      flowType: "script",
    };

    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/projects`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-request-id": `web-${Date.now()}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`Create project failed with status ${response.status}`);
      }

      const payload = (await response.json()) as ApiSuccess<Project>;
      router.push(`/one-click/${payload.data.id}`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t("oneClick.createFailed"),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card title={t("oneClick.startTitle")}>
      <div className="grid gap-4">
        <p className="text-sm leading-6 text-muted-foreground">
          {t("oneClick.startHelp")}
        </p>
        <label className="block text-sm">
          <span className="font-medium">{t("oneClick.name")}</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-2 h-10 w-full rounded-md border border-border px-3 text-sm outline-none focus:ring-2 focus:ring-sky-200"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">{t("oneClick.setupDescription")}</span>
          <TextareaWithCounter
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
            maxLength={500}
            className="mt-2 w-full resize-y rounded-md border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-200"
          />
        </label>
        {errorMessage ? (
          <div className="rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}
        <div className="flex justify-end">
          <Button
            type="button"
            className="gap-2"
            disabled={isSubmitting}
            onClick={() => void createProject()}
          >
            {isSubmitting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Sparkles size={16} />
            )}
            {t("oneClick.create")}
          </Button>
        </div>
      </div>
    </Card>
  );
}
