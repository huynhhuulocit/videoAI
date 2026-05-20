"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_SCRIPT_GENERATION_PROMPT,
  DEFAULT_SHOT_GENERATION_PROMPT,
  DEFAULT_TEMPLATE_SELECTION_PROMPT,
  type MasterPrompt,
  type MasterPromptConfig,
  type MasterPromptType
} from "@videoai/contracts";
import { CheckCircle2, Loader2, Plus, Save, Star, Trash2 } from "lucide-react";
import { useI18n } from "../i18n/language-provider";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { MasterPromptField } from "../ui/master-prompt-field";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? "http://localhost:4000";

type ApiSuccess<T> = {
  data: T;
};

const promptTypes = ["scenario", "shots", "scripts"] as const satisfies readonly MasterPromptType[];

type ShotPromptFormProps = {
  config: MasterPromptConfig;
};

function typeTitle(type: MasterPromptType) {
  if (type === "scenario") {
    return "Scenario";
  }
  if (type === "shots") {
    return "Shots";
  }
  return "Scripts";
}

function defaultPromptTemplate(type: MasterPromptType) {
  if (type === "scenario") {
    return DEFAULT_TEMPLATE_SELECTION_PROMPT;
  }
  if (type === "shots") {
    return DEFAULT_SHOT_GENERATION_PROMPT;
  }
  return DEFAULT_SCRIPT_GENERATION_PROMPT;
}

function defaultSelection(config: MasterPromptConfig) {
  return Object.fromEntries(
    config.groups.map((group) => [group.type, group.defaultPrompt.id])
  ) as Record<MasterPromptType, string>;
}

export function ShotPromptForm({ config: initialConfig }: ShotPromptFormProps) {
  const { t } = useI18n();
  const [config, setConfig] = useState(initialConfig);
  const [activeType, setActiveType] = useState<MasterPromptType>("scenario");
  const [selectedIds, setSelectedIds] = useState<Record<MasterPromptType, string>>(
    defaultSelection(initialConfig),
  );
  const [isCreating, setIsCreating] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSettingDefault, setIsSettingDefault] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const activeGroup = useMemo(
    () => config.groups.find((group) => group.type === activeType) ?? config.groups[0]!,
    [activeType, config.groups],
  );
  const selectedPrompt = useMemo(
    () =>
      activeGroup.prompts.find((prompt) => prompt.id === selectedIds[activeType]) ??
      activeGroup.defaultPrompt,
    [activeGroup, activeType, selectedIds],
  );
  useEffect(() => {
    if (isCreating) {
      return;
    }
    setDraftName(selectedPrompt.name);
    setDraftContent(selectedPrompt.content);
  }, [isCreating, selectedPrompt]);

  async function refreshConfig(nextSelectedId?: string) {
    const response = await fetch(`${apiBaseUrl}/api/v1/admin/master-prompts`, {
      headers: { "x-request-id": `web-${Date.now()}` },
    });

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as ApiSuccess<MasterPromptConfig>;
    setConfig(payload.data);
    setSelectedIds((current) => ({
      ...defaultSelection(payload.data),
      [activeType]: nextSelectedId ?? current[activeType] ?? payload.data.groups.find((group) => group.type === activeType)?.defaultPrompt.id ?? "",
    }));
    return payload.data;
  }

  function selectPrompt(prompt: MasterPrompt) {
    setSelectedIds((current) => ({ ...current, [activeType]: prompt.id }));
    setIsCreating(false);
    setStatusMessage("");
    setErrorMessage("");
  }

  function startCreate() {
    setIsCreating(true);
    setDraftName(`${typeTitle(activeType)} master prompt`);
    setDraftContent(defaultPromptTemplate(activeType));
    setStatusMessage("");
    setErrorMessage("");
  }

  async function savePrompt() {
    if (!draftName.trim() || !draftContent.trim()) {
      setStatusMessage("");
      setErrorMessage(t("adminMasterPrompt.required"));
      return;
    }

    setIsSaving(true);
    setStatusMessage("");
    setErrorMessage("");

    try {
      const response = await fetch(
        isCreating
          ? `${apiBaseUrl}/api/v1/admin/master-prompts`
          : `${apiBaseUrl}/api/v1/admin/master-prompts/${encodeURIComponent(selectedPrompt.id)}`,
        {
          method: isCreating ? "POST" : "PATCH",
          headers: {
            "content-type": "application/json",
            "x-request-id": `web-${Date.now()}`,
          },
          body: JSON.stringify({
            ...(isCreating ? { type: activeType } : {}),
            name: draftName,
            content: draftContent,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as ApiSuccess<MasterPrompt>;
      await refreshConfig(payload.data.id);
      setIsCreating(false);
      setStatusMessage(t("adminMasterPrompt.saved"));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("adminMasterPrompt.saveFailed"));
    } finally {
      setIsSaving(false);
    }
  }

  async function deletePrompt() {
    if (selectedPrompt.isBuiltIn) {
      return;
    }
    if (selectedPrompt.isDefault) {
      setErrorMessage(t("adminMasterPrompt.deleteDefaultBlocked"));
      return;
    }

    setIsDeleting(true);
    setStatusMessage("");
    setErrorMessage("");

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/v1/admin/master-prompts/${encodeURIComponent(selectedPrompt.id)}`,
        {
          method: "DELETE",
          headers: { "x-request-id": `web-${Date.now()}` },
        },
      );

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      await refreshConfig();
      setStatusMessage(t("adminMasterPrompt.deleted"));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("adminMasterPrompt.deleteFailed"));
    } finally {
      setIsDeleting(false);
    }
  }

  async function setDefaultPrompt() {
    if (selectedPrompt.isBuiltIn || selectedPrompt.isDefault) {
      return;
    }

    setIsSettingDefault(true);
    setStatusMessage("");
    setErrorMessage("");

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/v1/admin/master-prompts/${encodeURIComponent(selectedPrompt.id)}/default`,
        {
          method: "POST",
          headers: { "x-request-id": `web-${Date.now()}` },
        },
      );

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as ApiSuccess<MasterPrompt>;
      await refreshConfig(payload.data.id);
      setStatusMessage(t("adminMasterPrompt.defaultSaved"));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("adminMasterPrompt.defaultFailed"));
    } finally {
      setIsSettingDefault(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
      <div className="space-y-5">
        <Card title={t("adminMasterPrompt.sections")}>
          <div className="grid gap-2">
            {promptTypes.map((type) => {
              const group = config.groups.find((candidate) => candidate.type === type);
              const isActive = type === activeType;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setActiveType(type);
                    setIsCreating(false);
                    setStatusMessage("");
                    setErrorMessage("");
                  }}
                  className={`rounded-md border p-3 text-left transition ${
                    isActive
                      ? "border-sky-300 bg-sky-50"
                      : "border-border bg-white hover:bg-muted"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{typeTitle(type)}</span>
                    <Badge variant="info">{group?.prompts.length ?? 0}</Badge>
                  </div>
                  <div className="mt-1 truncate text-xs text-muted-foreground">
                    {group?.defaultPrompt.name}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        <Card title={t("adminMasterPrompt.prompts")}>
          <div className="space-y-2">
            {activeGroup.prompts.map((prompt) => (
              <button
                key={prompt.id}
                type="button"
                onClick={() => selectPrompt(prompt)}
                className={`w-full rounded-md border p-3 text-left transition ${
                  selectedPrompt.id === prompt.id && !isCreating
                    ? "border-sky-300 bg-sky-50"
                    : "border-border bg-white hover:bg-muted"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate font-medium">{prompt.name}</span>
                  {prompt.isDefault ? (
                    <Badge variant="success">{t("adminMasterPrompt.defaultBadge")}</Badge>
                  ) : null}
                </div>
                <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {prompt.isBuiltIn ? t("adminMasterPrompt.builtInReadOnly") : prompt.updatedAt}
                </div>
              </button>
            ))}
            <Button type="button" variant="secondary" className="w-full gap-2" onClick={startCreate}>
              <Plus size={16} />
              {t("adminMasterPrompt.newPrompt")}
            </Button>
          </div>
        </Card>
      </div>

      <div className="space-y-5">
        <Card
          title={isCreating ? t("adminMasterPrompt.newPrompt") : selectedPrompt.name}
          action={
            selectedPrompt.isDefault && !isCreating ? (
              <Badge variant="success">{t("adminMasterPrompt.defaultBadge")}</Badge>
            ) : null
          }
        >
          <div className="space-y-4">
            <label className="block text-sm">
              <span className="font-medium">{t("adminMasterPrompt.name")}</span>
              <input
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                disabled={selectedPrompt.isBuiltIn && !isCreating}
                className="mt-2 h-10 w-full rounded-md border border-border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-sky-200 disabled:bg-muted disabled:text-muted-foreground"
              />
            </label>
            <MasterPromptField
              id="adminMasterPromptContent"
              label={t("adminMasterPrompt.content")}
              rows={18}
              value={draftContent}
              onChange={(event) => setDraftContent(event.target.value)}
              disabled={selectedPrompt.isBuiltIn && !isCreating}
              className="min-h-[420px] resize-y"
            />
            {selectedPrompt.isBuiltIn && !isCreating ? (
              <p className="text-sm text-muted-foreground">{t("adminMasterPrompt.builtInReadOnly")}</p>
            ) : null}
            <p className="text-sm text-muted-foreground">{t("adminMasterPrompt.freeFormHelp")}</p>
          </div>
        </Card>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              className="gap-2"
              disabled={isSaving || (selectedPrompt.isBuiltIn && !isCreating)}
              onClick={() => void savePrompt()}
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {t("adminMasterPrompt.save")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="gap-2"
              disabled={isSettingDefault || selectedPrompt.isBuiltIn || selectedPrompt.isDefault || isCreating}
              onClick={() => void setDefaultPrompt()}
            >
              {isSettingDefault ? <Loader2 size={16} className="animate-spin" /> : <Star size={16} />}
              {t("adminMasterPrompt.setDefault")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="gap-2"
              disabled={isDeleting || selectedPrompt.isBuiltIn || isCreating}
              onClick={() => void deletePrompt()}
            >
              {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              {t("adminMasterPrompt.delete")}
            </Button>
            {statusMessage ? (
              <Badge variant="success">
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 size={13} />
                  {statusMessage}
                </span>
              </Badge>
            ) : null}
          </div>
          {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
        </div>
      </div>
    </div>
  );
}
