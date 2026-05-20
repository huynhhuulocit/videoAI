"use client";

import type { ApiSuccess, VideoShotPlan } from "@videoai/contracts";
import { Edit3, Loader2, Plus, Star, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "../i18n/language-provider";
import { Badge } from "../ui/badge";
import { Button, LinkButton } from "../ui/button";
import { Card } from "../ui/card";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? "http://localhost:4000";

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

async function apiPost<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}/api/v1${path}`, {
    method: "POST",
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

export function ScriptsList() {
  const { t } = useI18n();
  const [scripts, setScripts] = useState<VideoShotPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function loadScripts() {
    setIsLoading(true);
    setErrorMessage("");
    try {
      setScripts(await apiGet<VideoShotPlan[]>("/shots"));
    } catch (error) {
      setScripts([]);
      setErrorMessage(error instanceof Error ? error.message : t("shots.loadFailed"));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadScripts();
  }, []);

  async function deleteScript(script: VideoShotPlan) {
    if (!window.confirm(t("shots.deleteConfirm", { name: script.name }))) {
      return;
    }
    setBusyId(script.id);
    setErrorMessage("");
    try {
      const result = await apiDelete<{ deleted: boolean }>(`/shots/${script.id}`);
      if (!result.deleted) {
        throw new Error(t("shots.deleteFailed"));
      }
      await loadScripts();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("shots.deleteFailed"));
    } finally {
      setBusyId("");
    }
  }

  async function setDefaultScript(script: VideoShotPlan) {
    setBusyId(script.id);
    setErrorMessage("");
    try {
      const updated = await apiPost<VideoShotPlan | null>(`/shots/${script.id}/default`);
      if (!updated) {
        throw new Error(t("shots.defaultFailed"));
      }
      setScripts((current) =>
        current.map((item) => ({ ...item, isDefault: item.id === updated.id })),
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("shots.defaultFailed"));
    } finally {
      setBusyId("");
    }
  }

  return (
    <Card
      title={t("shots.listTitle")}
      action={
        <LinkButton href="/shots/new" className="gap-2">
          <Plus size={16} />
          {t("shots.new")}
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
          {t("shots.loading")}
        </div>
      ) : null}
      {!isLoading && scripts.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-muted p-6 text-sm text-muted-foreground">
          {t("shots.emptyList")}
        </div>
      ) : null}
      {scripts.length > 0 ? (
        <div className="grid gap-3">
          {scripts.map((script) => (
            <div key={script.id} className="rounded-md border border-border p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium text-foreground">{script.name}</h3>
                    {script.isDefault ? (
                      <Badge variant="success">{t("common.default")}</Badge>
                    ) : null}
                    <Badge variant="info">
                      {t("shots.shotCount", { count: script.shots.length })}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("shots.updated", {
                      date: new Date(script.updatedAt).toLocaleString(),
                    })}
                  </p>
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                    {script.sourceText}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <LinkButton
                    href={`/shots/${script.id}`}
                    variant="secondary"
                    className="h-9 gap-2 px-3"
                  >
                    <Edit3 size={15} />
                    {t("common.edit")}
                  </LinkButton>
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-9 gap-2 px-3"
                    disabled={busyId === script.id || script.isDefault}
                    onClick={() => void setDefaultScript(script)}
                  >
                    {busyId === script.id ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Star size={15} />
                    )}
                    {t("common.setDefault")}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    className="h-9 gap-2 px-3"
                    disabled={busyId === script.id}
                    onClick={() => void deleteScript(script)}
                    aria-label={t("shots.delete")}
                    title={t("shots.delete")}
                  >
                    {busyId === script.id ? (
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
