"use client";

import type { ApiSuccess, VideoTemplate } from "@videoai/contracts";
import { Edit3, Loader2, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "../i18n/language-provider";
import { Badge } from "../ui/badge";
import { Button, LinkButton } from "../ui/button";
import { Card } from "../ui/card";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? "";

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}/api/v1${path}`, {
    headers: { "x-request-id": `web-${Date.now()}` },
  });
  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`);
  }
  const payload = (await response.json()) as ApiSuccess<T>;
  return payload.data;
}

async function apiDelete<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}/api/v1${path}`, {
    method: "DELETE",
    headers: { "x-request-id": `web-${Date.now()}` },
  });
  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`);
  }
  const payload = (await response.json()) as ApiSuccess<T>;
  return payload.data;
}

export function ScenarioList() {
  const { t } = useI18n();
  const [scenarios, setScenarios] = useState<VideoTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function loadScenarios() {
    setIsLoading(true);
    setErrorMessage("");
    try {
      setScenarios(await apiGet<VideoTemplate[]>("/templates"));
    } catch (error) {
      setScenarios([]);
      setErrorMessage(error instanceof Error ? error.message : t("template.empty"));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadScenarios();
  }, []);

  async function deleteScenario(scenario: VideoTemplate) {
    if (!window.confirm(t("template.deleteConfirm", { name: scenario.name }))) {
      return;
    }
    setBusyId(scenario.id);
    setErrorMessage("");
    try {
      const result = await apiDelete<{ deleted: boolean }>(`/templates/${scenario.id}`);
      if (!result.deleted) {
        throw new Error(t("template.deleteFailed"));
      }
      await loadScenarios();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("template.deleteFailed"));
    } finally {
      setBusyId("");
    }
  }

  return (
    <Card
      title={t("template.list")}
      action={
        <LinkButton href="/templates/new" className="gap-2">
          <Plus size={16} />
          {t("template.new")}
        </LinkButton>
      }
    >
      {errorMessage ? (
        <div className="mb-3 rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin" />
          {t("template.loading")}
        </div>
      ) : null}
      {!isLoading && scenarios.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-muted p-6 text-sm text-muted-foreground">
          {t("template.empty")}
        </div>
      ) : null}
      {scenarios.length > 0 ? (
        <div className="grid gap-3">
          {scenarios.map((scenario) => (
            <div key={scenario.id} className="rounded-md border border-border p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium text-foreground">{scenario.name}</h3>
                    <Badge variant="success">
                      {t("template.attributeCount", {
                        count: scenario.attributes.length,
                      })}
                    </Badge>
                  </div>
                  {scenario.description ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {scenario.description}
                    </p>
                  ) : null}
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t("shots.updated", {
                      date: new Date(scenario.updatedAt).toLocaleString(),
                    })}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <LinkButton
                    href={`/templates/${scenario.id}`}
                    variant="secondary"
                    className="h-9 gap-2 px-3"
                  >
                    <Edit3 size={15} />
                    {t("common.edit")}
                  </LinkButton>
                  <Button
                    type="button"
                    variant="destructive"
                    className="h-9 gap-2 px-3"
                    disabled={busyId === scenario.id}
                    onClick={() => void deleteScenario(scenario)}
                    aria-label={t("template.delete")}
                    title={t("template.delete")}
                  >
                    {busyId === scenario.id ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Trash2 size={15} />
                    )}
                    {t("common.delete")}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
