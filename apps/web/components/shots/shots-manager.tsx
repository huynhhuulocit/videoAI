"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  GenerateShotsJobResult,
  Job,
  ShotPromptConfig,
  VideoShot,
  VideoShotAttribute,
  VideoShotPlan,
} from "@videoai/contracts";
import {
  Eye,
  FileText,
  Clapperboard,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useI18n } from "../i18n/language-provider";
import { AiDebugDialog, type AiDebugDialogData } from "../ui/ai-debug-dialog";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { TextareaWithCounter } from "../ui/textarea-with-counter";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? "http://localhost:4000";

type ApiSuccess<T> = {
  data: T;
};

const terminalStatuses = new Set(["succeeded", "failed", "cancelled"]);

function clampShotDuration(value: number) {
  if (Number.isNaN(value)) {
    return 8;
  }
  return Math.min(8, Math.max(1, Math.round(value)));
}

function getJobResult<T>(job: Job): T {
  return job.result as T;
}

function delay(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

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

async function apiPost<T>(
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}/api/v1${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-request-id": `web-${Date.now()}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as ApiSuccess<T>;
  return payload.data;
}

async function apiPatch<T>(
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}/api/v1${path}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      "x-request-id": `web-${Date.now()}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as ApiSuccess<T>;
  return payload.data;
}

async function waitForJob(jobId: string): Promise<Job> {
  let latest = await apiGet<Job>(`/jobs/${jobId}`);

  while (!terminalStatuses.has(latest.status)) {
    await delay(700);
    latest = await apiGet<Job>(`/jobs/${jobId}`);
  }

  return latest;
}

function createLocalShotAttribute(): VideoShotAttribute {
  return {
    id: `attr_local_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    name: "Attribute",
    value: "Value",
  };
}

function isDialogueAttribute(attribute: VideoShotAttribute) {
  return attribute.name.trim().toLowerCase() === "dialogue";
}

function getShotDialogue(shot: VideoShot) {
  return shot.attributes.find(isDialogueAttribute)?.value ?? "";
}

function renderPromptTemplate(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce(
    (rendered, [key, value]) => rendered.replaceAll(`{${key}}`, value),
    template,
  );
}

function formatPlanAttributesForPrompt(attributes: VideoShotAttribute[]) {
  const lines = attributes
    .filter((attribute) => attribute.name.trim() && attribute.value.trim())
    .map((attribute) => `${attribute.name.trim()}=${attribute.value.trim()};`);
  return lines.length > 0
    ? lines.join("\n")
    : "none=No extra plan-level attributes provided;";
}

function createLocalShot(durationSeconds: number): VideoShot {
  const id = `shot_local_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  return {
    id,
    title: "New shot",
    description: "Describe the shot moment.",
    durationSeconds: clampShotDuration(durationSeconds),
    mediaIds: [],
    attributes: [
      {
        id: `${id}_start_state`,
        name: "Start state",
        value: "Continue from the previous shot or establish the first frame.",
      },
      {
        id: `${id}_end_state`,
        name: "End state",
        value: "Describe the final frame of this shot.",
      },
      {
        id: `${id}_dialogue`,
        name: "Dialogue",
        value: "Add short dialogue or voiceover for this shot.",
      },
    ],
  };
}

type ShotsManagerProps = {
  mode?: "manage" | "create" | "edit";
  shotPlanId?: string;
};

export function ShotsManager({ mode = "manage", shotPlanId }: ShotsManagerProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [storyText, setStoryText] = useState("");
  const [planAttributes, setPlanAttributes] = useState<VideoShotAttribute[]>([]);
  const [shotPlans, setShotPlans] = useState<VideoShotPlan[]>([]);
  const [selectedShotPlanId, setSelectedShotPlanId] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [shotMasterPrompt, setShotMasterPrompt] = useState("");
  const [isPromptLoading, setIsPromptLoading] = useState(false);
  const [rawShotRequest, setRawShotRequest] = useState<unknown>(null);
  const [rawShotResponse, setRawShotResponse] = useState<unknown>(null);
  const [debugDialog, setDebugDialog] = useState<AiDebugDialogData | null>(null);

  const selectedShotPlan =
    shotPlans.find((shotPlan) => shotPlan.id === selectedShotPlanId) ??
    shotPlans[0] ??
    null;
  const isCreateMode = mode === "create";
  const isEditMode = mode === "edit";

  async function loadShotPlans() {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const loadedShotPlans =
        isEditMode && shotPlanId
          ? [await apiGet<VideoShotPlan | null>(`/shots/${shotPlanId}`)].filter(
              (item): item is VideoShotPlan => Boolean(item),
            )
          : await apiGet<VideoShotPlan[]>("/shots");
      setShotPlans(loadedShotPlans);
      setSelectedShotPlanId((current) =>
        isEditMode && shotPlanId
          ? loadedShotPlans[0]?.id ?? ""
          : loadedShotPlans.some((shotPlan) => shotPlan.id === current)
          ? current
          : loadedShotPlans[0]?.id ?? "",
      );
    } catch (error) {
      setShotPlans([]);
      setSelectedShotPlanId("");
      setErrorMessage(
        error instanceof Error ? error.message : t("shots.loadFailed"),
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!isCreateMode) {
      void loadShotPlans();
    } else {
      setIsLoading(false);
      setShotPlans([]);
      setSelectedShotPlanId("");
    }
  }, [isCreateMode, isEditMode, shotPlanId]);

  useEffect(() => {
    let cancelled = false;

    async function loadShotMasterPrompt() {
      setIsPromptLoading(true);
      try {
        const config = await apiGet<ShotPromptConfig>("/admin/shot-prompt");
        if (!cancelled) {
          setShotMasterPrompt(
            config.prompt ||
              config.defaultPrompt ||
              t("shots.defaultSource"),
          );
        }
      } catch {
        if (!cancelled) {
          setShotMasterPrompt(t("shots.defaultSource"));
        }
      } finally {
        if (!cancelled) {
          setIsPromptLoading(false);
        }
      }
    }

    void loadShotMasterPrompt();

    return () => {
      cancelled = true;
    };
  }, [t]);

  function buildShotGenerationFullPrompt() {
    const sourceText = storyText.trim();
    const masterPrompt = shotMasterPrompt.trim();
    if (!sourceText || !masterPrompt) {
      return null;
    }

    const durationSeconds = 8;
    const attributeText = formatPlanAttributesForPrompt(planAttributes);
    const renderedPrompt = renderPromptTemplate(masterPrompt, {
      story: sourceText,
      attributes: attributeText,
      durationSeconds: String(durationSeconds),
    });

    return [
      renderedPrompt,
      "",
      "Runtime context:",
      `Story: ${sourceText}`,
      "",
      "Scenario/plan attributes:",
      attributeText,
      "",
      `Target seconds per shot: ${durationSeconds}`,
      "",
      "Provider output contract:",
      "- Return only strict JSON. Do not include markdown, comments, or prose outside JSON.",
      "- Every shot must include attributes named exactly Start state, End state, and Dialogue.",
      "- The Start state of shot 2+ must continue from the previous shot's End state.",
      "- Dialogue should be short, natural spoken dialogue, narration, or voiceover for that exact shot.",
      "- Keep each duration between 1 and the requested duration, never more than 8 seconds.",
      "",
      "Required JSON shape:",
      JSON.stringify(
        {
          name: "Shot plan name",
          durationSeconds,
          shots: [
            {
              title: "Shot 1: Hook",
              description: "Filmable description of the moment.",
              durationSeconds,
              attributes: [
                { name: "Start state", value: "How the shot begins." },
                { name: "End state", value: "How the shot ends." },
                { name: "Dialogue", value: "Short spoken line or voiceover for this shot." },
                { name: "Camera", value: "Camera movement and framing." },
                { name: "Visual", value: "Lighting, composition, production details." },
                { name: "Action", value: "Primary action in the shot." },
                { name: "Transition", value: "How this shot connects to the next one." },
              ],
            },
          ],
        },
        null,
        2,
      ),
    ].join("\n");
  }

  function renderDebugButton(
    label: string,
    title: string,
    help: string,
    value: unknown,
    icon: "prompt" | "raw",
    unavailableTitle = t("workspace.rawDataUnavailable"),
  ) {
    const hasValue = value !== null && value !== undefined && value !== "";

    return (
      <Button
        type="button"
        variant="secondary"
        className="gap-2 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!hasValue}
        title={hasValue ? title : unavailableTitle}
        onClick={() => {
          if (hasValue) {
            setDebugDialog({ title, help, value });
          }
        }}
      >
        {icon === "prompt" ? <FileText size={15} /> : <Eye size={15} />}
        {label}
      </Button>
    );
  }

  async function generateShots() {
    const trimmedStoryText = storyText.trim();
    if (!trimmedStoryText) {
      setErrorMessage(t("shots.missingSource"));
      return;
    }
    const validAttributes = planAttributes.filter(
      (attribute) => attribute.name.trim() && attribute.value.trim(),
    );

    setIsGenerating(true);
    setStatusMessage(t("workspace.shotsGenerating"));
    setErrorMessage("");
    setRawShotRequest(null);
    setRawShotResponse(null);
    setDebugDialog(null);

    try {
      const masterPrompt = shotMasterPrompt.trim();
      const job = await apiPost<Job>("/shots/generate", {
        sourceText: trimmedStoryText,
        durationSeconds: 8,
        attributes: validAttributes,
        ...(masterPrompt ? { masterPrompt } : {}),
      });
      const completedJob = await waitForJob(job.jobId);
      if (completedJob.status !== "succeeded") {
        throw new Error(
          completedJob.error?.message ?? t("workspace.requestIncomplete"),
        );
      }

      const result = getJobResult<GenerateShotsJobResult>(completedJob);
      const shotPlan = result.shotPlan;
      setRawShotRequest(result.rawRequest);
      setRawShotResponse(result.rawResponse);
      setShotPlans((current) => [
        shotPlan,
        ...current.filter((item) => item.id !== shotPlan.id),
      ]);
      setSelectedShotPlanId(shotPlan.id);
      setStatusMessage(t("workspace.shotsGenerated"));
      if (isCreateMode) {
        router.replace(`/shots/${shotPlan.id}`);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t("workspace.shotsGenerateFailed"),
      );
      setStatusMessage("");
    } finally {
      setIsGenerating(false);
    }
  }

  function updateSelectedShotPlan(updater: (shotPlan: VideoShotPlan) => VideoShotPlan) {
    if (!selectedShotPlan) {
      return;
    }

    setShotPlans((current) =>
      current.map((shotPlan) =>
        shotPlan.id === selectedShotPlan.id ? updater(shotPlan) : shotPlan,
      ),
    );
  }

  function updateShot(shotId: string, updater: (shot: VideoShot) => VideoShot) {
    updateSelectedShotPlan((shotPlan) => ({
      ...shotPlan,
      shots: shotPlan.shots.map((shot) =>
        shot.id === shotId ? updater(shot) : shot,
      ),
    }));
  }

  function addShot() {
    updateSelectedShotPlan((shotPlan) => ({
      ...shotPlan,
      shots: [...shotPlan.shots, createLocalShot(shotPlan.durationSeconds)],
    }));
  }

  function removeShot(shotId: string) {
    updateSelectedShotPlan((shotPlan) => ({
      ...shotPlan,
      shots: shotPlan.shots.filter((shot) => shot.id !== shotId),
    }));
  }

  function addShotAttribute(shotId: string) {
    updateShot(shotId, (shot) => ({
      ...shot,
      attributes: [...shot.attributes, createLocalShotAttribute()],
    }));
  }

  function updateShotAttribute(
    shotId: string,
    attributeId: string,
    updater: (attribute: VideoShotAttribute) => VideoShotAttribute,
  ) {
    updateShot(shotId, (shot) => ({
      ...shot,
      attributes: shot.attributes.map((attribute) =>
        attribute.id === attributeId ? updater(attribute) : attribute,
      ),
    }));
  }

  function updateShotDialogue(shotId: string, value: string) {
    updateShot(shotId, (shot) => {
      const existingDialogue = shot.attributes.find(isDialogueAttribute);
      if (existingDialogue) {
        return {
          ...shot,
          attributes: shot.attributes.map((attribute) =>
            attribute.id === existingDialogue.id
              ? { ...attribute, value }
              : attribute,
          ),
        };
      }

      return {
        ...shot,
        attributes: [
          ...shot.attributes,
          {
            id: `${shot.id}_dialogue`,
            name: "Dialogue",
            value,
          },
        ],
      };
    });
  }

  function removeShotAttribute(shotId: string, attributeId: string) {
    updateShot(shotId, (shot) => ({
      ...shot,
      attributes: shot.attributes.filter(
        (attribute) => attribute.id !== attributeId,
      ),
    }));
  }

  function addPlanAttribute() {
    setRawShotRequest(null);
    setRawShotResponse(null);
    setPlanAttributes((current) => [...current, createLocalShotAttribute()]);
  }

  function updatePlanAttribute(
    attributeId: string,
    updater: (attribute: VideoShotAttribute) => VideoShotAttribute,
  ) {
    setRawShotRequest(null);
    setRawShotResponse(null);
    setPlanAttributes((current) =>
      current.map((attribute) =>
        attribute.id === attributeId ? updater(attribute) : attribute,
      ),
    );
  }

  function removePlanAttribute(attributeId: string) {
    setRawShotRequest(null);
    setRawShotResponse(null);
    setPlanAttributes((current) =>
      current.filter((attribute) => attribute.id !== attributeId),
    );
  }

  function addSelectedPlanAttribute() {
    updateSelectedShotPlan((shotPlan) => ({
      ...shotPlan,
      attributes: [...shotPlan.attributes, createLocalShotAttribute()],
    }));
  }

  function updateSelectedPlanAttribute(
    attributeId: string,
    updater: (attribute: VideoShotAttribute) => VideoShotAttribute,
  ) {
    updateSelectedShotPlan((shotPlan) => ({
      ...shotPlan,
      attributes: shotPlan.attributes.map((attribute) =>
        attribute.id === attributeId ? updater(attribute) : attribute,
      ),
    }));
  }

  function removeSelectedPlanAttribute(attributeId: string) {
    updateSelectedShotPlan((shotPlan) => ({
      ...shotPlan,
      attributes: shotPlan.attributes.filter(
        (attribute) => attribute.id !== attributeId,
      ),
    }));
  }

  async function saveShotPlan() {
    if (!selectedShotPlan) {
      setErrorMessage(t("workspace.shotsNone"));
      return;
    }
    if (selectedShotPlan.shots.length === 0) {
      setErrorMessage(t("workspace.shotsNeedOne"));
      return;
    }

    setIsSaving(true);
    setErrorMessage("");
    setStatusMessage(t("workspace.shotsSaving"));

    try {
      const saved = await apiPatch<VideoShotPlan>(
        `/shots/${selectedShotPlan.id}`,
        {
          name: selectedShotPlan.name,
          durationSeconds: clampShotDuration(selectedShotPlan.durationSeconds),
          attributes: selectedShotPlan.attributes.filter(
            (attribute) => attribute.name.trim() && attribute.value.trim(),
          ),
          shots: selectedShotPlan.shots.map((shot) => ({
            ...shot,
            durationSeconds: clampShotDuration(shot.durationSeconds),
            attributes: shot.attributes.filter(
              (attribute) => attribute.name.trim() && attribute.value.trim(),
            ),
          })),
        },
      );
      setShotPlans((current) =>
        current.map((shotPlan) => (shotPlan.id === saved.id ? saved : shotPlan)),
      );
      setStatusMessage(t("workspace.shotsSaved"));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t("workspace.shotsSaveFailed"),
      );
      setStatusMessage("");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
    <div className={isCreateMode || isEditMode ? "grid gap-5" : "grid gap-5 lg:grid-cols-[420px_1fr]"}>
      {!isEditMode ? (
      <Card title={t("shots.createTitle")}>
        <div className="space-y-4">
          <div className="rounded-md border border-border bg-muted p-3">
            <div className="text-sm font-medium text-foreground">
              {t("shots.fixedPrompt")}
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {t("shots.fixedPromptHelp")}
            </p>
          </div>
          <label className="block text-sm font-medium text-foreground">
            {t("shots.storyText")}
            <TextareaWithCounter
              value={storyText}
              onChange={(event) => {
                setStoryText(event.target.value);
                setRawShotRequest(null);
                setRawShotResponse(null);
              }}
              className="mt-2 min-h-36 w-full resize-y rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              placeholder={t("shots.storyPlaceholder")}
            />
          </label>
          <div className="rounded-md border border-border bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm font-medium text-foreground">
                  {t("shots.planAttributes")}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("shots.planAttributesHelp")}
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                className="h-9 gap-2"
                onClick={addPlanAttribute}
              >
                <Plus size={15} />
                {t("shots.addPlanAttribute")}
              </Button>
            </div>
            {planAttributes.length === 0 ? (
              <div className="mt-3 rounded-md bg-muted p-3 text-sm text-muted-foreground">
                {t("shots.noPlanAttributes")}
              </div>
            ) : (
              <div className="mt-3 grid gap-2">
                {planAttributes.map((attribute) => (
                  <div
                    key={attribute.id}
                    className="grid gap-2 sm:grid-cols-[0.8fr_1.2fr_auto]"
                  >
                    <input
                      value={attribute.name}
                      onChange={(event) =>
                        updatePlanAttribute(attribute.id, (current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      aria-label={t("workspace.shotsAttributeName")}
                      className="h-9 rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                    />
                    <input
                      value={attribute.value}
                      onChange={(event) =>
                        updatePlanAttribute(attribute.id, (current) => ({
                          ...current,
                          value: event.target.value,
                        }))
                      }
                      aria-label={t("workspace.shotsAttributeValue")}
                      className="h-9 rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                    />
                    <button
                      type="button"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-sky-200"
                      onClick={() => removePlanAttribute(attribute.id)}
                      aria-label={t("workspace.shotsRemoveAttribute")}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              className="gap-2"
              disabled={isGenerating || isPromptLoading}
              onClick={() => void generateShots()}
            >
              {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {t("workspace.shotsGenerate")}
            </Button>
            {renderDebugButton(
              t("workspace.fullPromptButton"),
              t("workspace.shotsFullPrompt"),
              t("workspace.shotsFullPromptHelp"),
              buildShotGenerationFullPrompt(),
              "prompt",
              t("workspace.fullPromptUnavailable"),
            )}
            {renderDebugButton(
              t("workspace.rawRequestButton"),
              t("shots.rawRequest"),
              t("shots.rawRequestHelp"),
              rawShotRequest,
              "raw",
            )}
            {renderDebugButton(
              t("workspace.rawResponseButton"),
              t("shots.rawResponse"),
              t("shots.rawResponseHelp"),
              rawShotResponse,
              "raw",
            )}
            <Button
              type="button"
              variant="secondary"
              className="gap-2"
              disabled={isLoading}
              onClick={() => void loadShotPlans()}
            >
              <RefreshCw size={16} />
              {t("shots.refresh")}
            </Button>
          </div>
          {statusMessage ? (
            <Badge variant="success">{statusMessage}</Badge>
          ) : null}
          {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
        </div>
      </Card>
      ) : null}

      {!isCreateMode ? (
      <Card
        title={isEditMode ? t("shots.editTitle") : t("shots.savedTitle")}
        action={
          selectedShotPlan ? (
            <Badge variant="info">
              {t("shots.shotCount", { count: selectedShotPlan.shots.length })}
            </Badge>
          ) : null
        }
      >
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={16} className="animate-spin" />
            {t("shots.loading")}
          </div>
        ) : null}
        {!isLoading && shotPlans.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-muted p-6 text-sm text-muted-foreground">
            {t("workspace.shotsNone")}
          </div>
        ) : null}
        {isEditMode && !isLoading && !selectedShotPlan ? (
          <div className="rounded-md border border-dashed border-border bg-muted p-6 text-sm text-muted-foreground">
            {t("shots.notFound")}
          </div>
        ) : null}
        {shotPlans.length > 0 ? (
          <div className="space-y-4">
            {!isEditMode ? (
            <label className="block text-sm font-medium text-foreground">
              {t("workspace.shotsSelect")}
              <select
                value={selectedShotPlan?.id ?? ""}
                onChange={(event) => setSelectedShotPlanId(event.target.value)}
                className="mt-2 h-10 w-full rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              >
                {shotPlans.map((shotPlan) => (
                  <option key={shotPlan.id} value={shotPlan.id}>
                    {shotPlan.name}
                  </option>
                ))}
              </select>
            </label>
            ) : null}
            {selectedShotPlan ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <label className="text-sm font-medium text-foreground">
                      {t("workspace.shotsName")}
                      <input
                        value={selectedShotPlan.name}
                        onChange={(event) =>
                          updateSelectedShotPlan((shotPlan) => ({
                            ...shotPlan,
                            name: event.target.value,
                          }))
                        }
                        className="mt-2 h-10 w-full rounded-md border border-border bg-white px-3 text-sm font-medium outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                      />
                    </label>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {t("shots.updated", {
                        date: new Date(selectedShotPlan.updatedAt).toLocaleString(),
                      })}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    className="gap-2"
                    onClick={addShot}
                  >
                    <Plus size={16} />
                    {t("workspace.shotsAdd")}
                  </Button>
                  <Button
                    type="button"
                    className="gap-2"
                    disabled={isSaving}
                    onClick={() => void saveShotPlan()}
                  >
                    {isSaving ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Save size={16} />
                    )}
                    {t("workspace.shotsSave")}
                  </Button>
                </div>
                <div className="rounded-md border border-border bg-muted/40 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium text-foreground">
                        {t("shots.planAttributes")}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("shots.savedPlanAttributesHelp")}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-9 gap-2"
                      onClick={addSelectedPlanAttribute}
                    >
                      <Plus size={15} />
                      {t("shots.addPlanAttribute")}
                    </Button>
                  </div>
                  {selectedShotPlan.attributes.length === 0 ? (
                    <div className="mt-3 rounded-md bg-white p-3 text-sm text-muted-foreground">
                      {t("shots.noPlanAttributes")}
                    </div>
                  ) : (
                    <div className="mt-3 grid gap-2">
                      {selectedShotPlan.attributes.map((attribute) => (
                        <div
                          key={attribute.id}
                          className="grid gap-2 sm:grid-cols-[0.8fr_1.2fr_auto]"
                        >
                          <input
                            value={attribute.name}
                            onChange={(event) =>
                              updateSelectedPlanAttribute(
                                attribute.id,
                                (current) => ({
                                  ...current,
                                  name: event.target.value,
                                }),
                              )
                            }
                            aria-label={t("workspace.shotsAttributeName")}
                            className="h-9 rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                          />
                          <input
                            value={attribute.value}
                            onChange={(event) =>
                              updateSelectedPlanAttribute(
                                attribute.id,
                                (current) => ({
                                  ...current,
                                  value: event.target.value,
                                }),
                              )
                            }
                            aria-label={t("workspace.shotsAttributeValue")}
                            className="h-9 rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                          />
                          <button
                            type="button"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition hover:bg-white hover:text-foreground focus:outline-none focus:ring-2 focus:ring-sky-200"
                            onClick={() => removeSelectedPlanAttribute(attribute.id)}
                            aria-label={t("workspace.shotsRemoveAttribute")}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="grid gap-3">
                  {selectedShotPlan.shots.map((shot, index) => (
                    <article
                      key={shot.id}
                      className="rounded-md border border-border bg-white p-4"
                    >
                      <div className="flex flex-wrap items-start gap-3">
                        <div className="mt-2 flex items-center gap-2 text-sm font-medium text-sky-700">
                          <Clapperboard size={16} />
                          {index + 1}
                        </div>
                        <input
                          value={shot.title}
                          onChange={(event) =>
                            updateShot(shot.id, (currentShot) => ({
                              ...currentShot,
                              title: event.target.value,
                            }))
                          }
                          aria-label={t("workspace.shotsTitleInput", {
                            index: index + 1,
                          })}
                          className="h-10 min-w-0 flex-1 rounded-md border border-border bg-white px-3 text-sm font-medium outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                        />
                        <input
                          type="number"
                          min={1}
                          max={8}
                          value={shot.durationSeconds}
                          onChange={(event) =>
                            updateShot(shot.id, (currentShot) => ({
                              ...currentShot,
                              durationSeconds: clampShotDuration(
                                Number(event.target.value),
                              ),
                            }))
                          }
                          aria-label={t("workspace.shotsDurationInput", {
                            index: index + 1,
                          })}
                          className="h-10 w-20 rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                        />
                        <button
                          type="button"
                          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-sky-200"
                          onClick={() => removeShot(shot.id)}
                          aria-label={t("workspace.shotsRemove", {
                            title: shot.title,
                          })}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <TextareaWithCounter
                        rows={3}
                        value={shot.description}
                        onChange={(event) =>
                          updateShot(shot.id, (currentShot) => ({
                            ...currentShot,
                            description: event.target.value,
                          }))
                        }
                        className="mt-3 w-full rounded-md border border-border bg-white p-3 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                      />
                      <label className="mt-3 block text-sm font-medium text-foreground">
                        {t("workspace.shotDialogue")}
                        <TextareaWithCounter
                          rows={3}
                          value={getShotDialogue(shot)}
                          onChange={(event) =>
                            updateShotDialogue(shot.id, event.target.value)
                          }
                          placeholder={t("workspace.shotDialoguePlaceholder")}
                          className="mt-2 w-full rounded-md border border-border bg-white p-3 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                        />
                      </label>
                      <div className="mt-3 grid gap-2">
                        {shot.attributes
                          .filter((attribute) => !isDialogueAttribute(attribute))
                          .map((attribute) => (
                          <div
                            key={attribute.id}
                            className="grid gap-2 sm:grid-cols-[0.8fr_1.2fr_auto]"
                          >
                            <input
                              value={attribute.name}
                              onChange={(event) =>
                                updateShotAttribute(
                                  shot.id,
                                  attribute.id,
                                  (currentAttribute) => ({
                                    ...currentAttribute,
                                    name: event.target.value,
                                  }),
                                )
                              }
                              aria-label={t("workspace.shotsAttributeName")}
                              className="h-9 rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                            />
                            <input
                              value={attribute.value}
                              onChange={(event) =>
                                updateShotAttribute(
                                  shot.id,
                                  attribute.id,
                                  (currentAttribute) => ({
                                    ...currentAttribute,
                                    value: event.target.value,
                                  }),
                                )
                              }
                              aria-label={t("workspace.shotsAttributeValue")}
                              className="h-9 rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                            />
                            <button
                              type="button"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-sky-200"
                              onClick={() =>
                                removeShotAttribute(shot.id, attribute.id)
                              }
                              aria-label={t("workspace.shotsRemoveAttribute")}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          className="inline-flex h-9 w-fit items-center gap-2 rounded-md border border-border bg-white px-3 text-sm font-medium transition hover:bg-muted"
                          onClick={() => addShotAttribute(shot.id)}
                        >
                          <Plus size={15} />
                          {t("workspace.shotsAddAttribute")}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </Card>
      ) : null}
    </div>
    <AiDebugDialog
      data={debugDialog}
      closeLabel={t("workspace.rawDataClose")}
      onClose={() => setDebugDialog(null)}
    />
    </>
  );
}
