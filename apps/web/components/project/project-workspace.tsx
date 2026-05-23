"use client";

import type { ChangeEvent, DragEvent, TextareaHTMLAttributes } from "react";
import { useEffect, useRef, useState } from "react";
import type {
  ApiError,
  AiHandoff,
  AiHandoffStatus,
  AttributeCatalog,
  AttributeSelection,
  GenerateShotsJobResult,
  Job,
  MediaAsset,
  ProjectFlow,
  ShotSelection,
  ShotPromptConfig,
  TemplateSelection,
  TemplateSelectionAnalysisResult,
  VideoShot,
  VideoShotAttribute,
  VideoShotPlan,
  VideoTemplate,
} from "@videoai/contracts";
import {
  DEFAULT_SCRIPT_GENERATION_PROMPT,
  DEFAULT_SCRIPT_GENERATION_OUTPUT_FORMAT,
  DEFAULT_SHOT_GENERATION_PROMPT,
  DEFAULT_SHOT_GENERATION_OUTPUT_FORMAT,
  DEFAULT_TEMPLATE_SELECTION_PROMPT,
  DEFAULT_TEMPLATE_SELECTION_OUTPUT_FORMAT,
  MASTER_PROMPT_OUTPUT_FORMAT_PLACEHOLDER,
  MASTER_PROMPT_PLACEHOLDERS,
  AttributeSelectionSchema,
  TemplateAttributeSchema,
} from "@videoai/contracts";
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Clapperboard,
  Copy,
  Eye,
  FileText,
  Info,
  FileVideo,
  Image as ImageIcon,
  Link2,
  Loader2,
  Plus,
  Save,
  Send,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Badge } from "../ui/badge";
import { Button, LinkButton } from "../ui/button";
import { Card } from "../ui/card";
import { MasterPromptField } from "../ui/master-prompt-field";
import { TextareaWithCounter } from "../ui/textarea-with-counter";
import { useI18n } from "../i18n/language-provider";
import {
  translate,
  type TranslationKey,
  type TranslationValues,
} from "../../lib/i18n/dictionary";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? "";
const aiHandoffEnabled = process.env.NEXT_PUBLIC_AI_HANDOFF_ENABLED === "true";
const aiHandoffExtensionId =
  process.env.NEXT_PUBLIC_AI_HANDOFF_EXTENSION_ID?.trim() ?? "";

const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const videoTypes = new Set(["video/mp4", "video/quicktime", "video/webm"]);

const maxFiles = 10;
const maxImageBytes = 10 * 1024 * 1024;
const maxVideoBytes = 200 * 1024 * 1024;
const maxTotalBytes = 500 * 1024 * 1024;
const maxVideoSeconds = 180;

type MediaKind = "image" | "video" | "unknown";
type MediaStatus = "validated" | "rejected";
type ScenarioAttribute = VideoTemplate["attributes"][number];
type ScenarioOption = ScenarioAttribute["options"][number];

function isValidAbsoluteUrl(value: string) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function catalogToVideoTemplate(catalog: AttributeCatalog): VideoTemplate {
  return {
    id: catalog.id,
    ownerUserId: "admin",
    name: catalog.name,
    description: catalog.description,
    idea: "",
    attributes: catalog.attributes.map((attribute) => ({
      id: attribute.id,
      name: attribute.name,
      description: attribute.description,
      required: attribute.required,
      options: attribute.options.map((option) => ({
        id: option.id,
        label: option.name,
        value: option.name,
        description: option.description,
      })),
    })),
    isDefault: catalog.isDefault,
    status: catalog.status,
    createdAt: catalog.createdAt,
    updatedAt: catalog.updatedAt,
  };
}

type MediaItem = {
  id: string;
  name: string;
  sizeBytes: number;
  mimeType: string;
  kind: MediaKind;
  status: MediaStatus;
  previewUrl: string | null;
  validationError: string | null;
  shotId?: string;
};

type ProjectWorkspaceProps = {
  projectId: string;
  projectName?: string | undefined;
  projectDescription?: string | null | undefined;
  flowType: ProjectFlow;
  workspaceMode?: "project" | "one-click";
  savedTemplateSelection?: TemplateSelection | null;
  savedAttributeSelections?: {
    story?: AttributeSelection | null | undefined;
    scenario?: AttributeSelection | null | undefined;
    shots?: AttributeSelection | null | undefined;
  } | null;
  defaultPrompt: string;
  defaultProductUrl: string;
};

type PromptResult = {
  promptId: string;
  generatedPrompt: string;
  mediaInsights: string[];
  provider: string;
  model: string;
  rawRequest?: unknown;
  rawResponse?: unknown;
};

type ProductAnalysisResult = {
  analysisId: string;
  productFacts: string[];
  mediaInsights: string[];
  generatedPrompt: string;
  provider: string;
  model: string;
  rawRequest?: unknown;
  rawResponse?: unknown;
};

type ScriptResult = {
  scriptId: string;
  projectId: string;
  status: string;
  finalPrompt: string;
};

type VideoGenerationResult = {
  videoGenerationId: string;
  projectId: string;
  status: string;
  provider: string;
  model: string;
  rawRequest?: unknown;
  rawResponse?: unknown;
};

type ApiSuccess<T> = {
  data: T;
};

type ActionStatus = {
  label: string;
  tone: "neutral" | "success" | "warning" | "danger" | "info";
};

type RawDataModalState = {
  title: string;
  help: string;
  value: unknown;
  mediaItems?: MediaItem[];
};

type AiHandoffExtensionResponse =
  | {
      ok: true;
      handoffId: string;
      status: AiHandoffStatus;
      message?: string;
    }
  | {
      ok: false;
      handoffId?: string;
      status?: AiHandoffStatus;
      errorMessage: string;
    };

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

type ProjectStoryContentResponse = {
  storyContent: string;
};

type SaveProjectStoryContentResponse = {
  saved: boolean;
  storyContent: string;
};

class JobFailureError extends Error {
  constructor(
    readonly job: Job,
    message: string,
  ) {
    super(message);
    this.name = "JobFailureError";
  }
}

type PromptPreviewPayload = {
  flowType: ProjectFlow;
  endpoint: string;
  requestBody: {
    inputText?: string;
    productUrl?: string;
    mediaIds: string[];
    templateSelection?: TemplateSelection;
    shotSelection?: ShotSelection;
  };
  mediaReferences: Array<{
    id: string;
    name: string;
    mediaType: MediaKind;
    mimeType: string;
    sizeBytes: number;
  }>;
  composedInstructionPreview: string;
};

const terminalStatuses = new Set(["succeeded", "failed", "cancelled"]);
type Translate = (key: TranslationKey, values?: TranslationValues) => string;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringifyDetailValue(value: unknown) {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `${value.length} item(s)`;
  }
  if (isRecord(value)) {
    try {
      return JSON.stringify(value).slice(0, 300);
    } catch {
      return "object";
    }
  }
  return "";
}

function detailString(details: Record<string, unknown>, key: string) {
  return stringifyDetailValue(details[key]).trim();
}

function formatIssueSummary(value: unknown, t: Translate) {
  if (!Array.isArray(value) || value.length === 0) {
    return "";
  }

  const firstIssue = value.find(isRecord);
  const firstIssueMessage =
    firstIssue && typeof firstIssue.message === "string"
      ? firstIssue.message
      : t("workspace.aiErrorNoIssuePreview");
  return t("workspace.aiErrorIssues", {
    count: value.length,
    firstIssue: firstIssueMessage,
  });
}

async function readResponseErrorMessage(response: Response) {
  try {
    const payload = (await response.json()) as unknown;
    if (isRecord(payload)) {
      if (
        isRecord(payload.error) &&
        typeof payload.error.message === "string"
      ) {
        const code =
          typeof payload.error.code === "string"
            ? `${payload.error.code}: `
            : "";
        return `${code}${payload.error.message}`;
      }
      if (typeof payload.message === "string") {
        return payload.message;
      }
      if (Array.isArray(payload.message)) {
        return payload.message.map(String).join("\n");
      }
    }
  } catch {
    // Fall back to the status line below.
  }

  return `API request failed with status ${response.status}`;
}

function formatAiErrorCause(error: ApiError | null | undefined, t: Translate) {
  const details = isRecord(error?.details) ? error.details : {};
  const provider =
    detailString(details, "provider") || t("workspace.aiErrorActiveProvider");
  const env = detailString(details, "env") || t("workspace.aiErrorProviderEnv");

  if (error?.code === "AI_CONFIG_MISSING") {
    return t("workspace.aiErrorConfigMissing", { provider, env });
  }
  if (error?.code === "AI_RATE_LIMITED") {
    return t("workspace.aiErrorRateLimited");
  }
  if (error?.code === "AI_PROVIDER_FAILED") {
    return t("workspace.aiErrorProviderFailed");
  }
  if (error?.code === "VALIDATION_ERROR") {
    return t("workspace.aiErrorValidation");
  }
  if (error?.code === "JOB_NOT_FOUND") {
    return t("workspace.aiErrorJobNotFound");
  }
  return t("workspace.aiErrorUnknown");
}

function formatJobFailureMessage(
  job: Job,
  fallbackLabel: string,
  t: Translate,
) {
  const error = job.error;
  const details = isRecord(error?.details) ? error.details : {};
  const lines = [fallbackLabel, formatAiErrorCause(error, t)];

  if (error?.message) {
    lines.push(
      t("workspace.aiErrorProviderMessage", { message: error.message }),
    );
  }
  if (error?.code) {
    lines.push(t("workspace.aiErrorCode", { code: error.code }));
  }

  const provider = detailString(details, "provider");
  const model = detailString(details, "model");
  const env = detailString(details, "env");
  const status = detailString(details, "status");
  const issues = formatIssueSummary(details.issues, t);

  if (provider) {
    lines.push(t("workspace.aiErrorProvider", { provider }));
  }
  if (model) {
    lines.push(t("workspace.aiErrorModel", { model }));
  }
  if (env) {
    lines.push(t("workspace.aiErrorEnv", { env }));
  }
  if (status) {
    lines.push(t("workspace.aiErrorStatus", { status }));
  }
  if (issues) {
    lines.push(issues);
  }

  lines.push(t("workspace.aiErrorJobId", { jobId: job.jobId }));
  return Array.from(new Set(lines.filter(Boolean))).join("\n");
}

function formatScenarioAnalysisError(error: unknown, t: Translate) {
  const fallbackLabel = t("workspace.templateAnalyzeFailed");
  if (error instanceof JobFailureError) {
    return formatJobFailureMessage(error.job, fallbackLabel, t);
  }
  if (error instanceof Error) {
    return [fallbackLabel, error.message].join("\n");
  }
  return fallbackLabel;
}

function formatStoryGenerationError(error: unknown, t: Translate) {
  const fallbackLabel = t("workspace.storyGenerateFailed");
  if (error instanceof JobFailureError) {
    return formatJobFailureMessage(error.job, fallbackLabel, t);
  }
  if (error instanceof Error) {
    return [fallbackLabel, error.message].join("\n");
  }
  return fallbackLabel;
}

function formatShotGenerationError(error: unknown, t: Translate) {
  const fallbackLabel = t("workspace.shotsGenerateFailed");
  if (error instanceof JobFailureError) {
    return formatJobFailureMessage(error.job, fallbackLabel, t);
  }
  if (error instanceof Error) {
    return [fallbackLabel, error.message].join("\n");
  }
  return fallbackLabel;
}

function formatVideoGenerationError(error: unknown, t: Translate) {
  const fallbackLabel = t("workspace.shotVideoFailed");
  if (error instanceof JobFailureError) {
    return formatJobFailureMessage(error.job, fallbackLabel, t);
  }
  if (error instanceof Error) {
    return [fallbackLabel, error.message].join("\n");
  }
  return fallbackLabel;
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatJobStatus(job: Job, t: Translate) {
  if (job.status === "queued") {
    return t("common.queued", { progress: job.progress });
  }
  if (job.status === "processing") {
    return t("common.processing", { progress: job.progress });
  }
  if (job.status === "succeeded") {
    return t("common.completed");
  }
  if (job.status === "failed") {
    return t("common.failed");
  }
  return t("common.cancelled");
}

function detectMediaKind(file: File): MediaKind {
  if (imageTypes.has(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name)) {
    return "image";
  }
  if (videoTypes.has(file.type) || /\.(mp4|mov|webm)$/i.test(file.name)) {
    return "video";
  }
  return "unknown";
}

function statusText(item: MediaItem, t: Translate) {
  if (item.status === "rejected") {
    return item.validationError ?? t("workspace.rejectedFiles");
  }
  return `${item.kind === "image" ? t("workspace.validImage") : t("workspace.validVideo")}, ${formatBytes(item.sizeBytes)}`;
}

function statusVariant(item: MediaItem): "success" | "danger" {
  return item.status === "validated" ? "success" : "danger";
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
    throw new Error(await readResponseErrorMessage(response));
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
    throw new Error(await readResponseErrorMessage(response));
  }

  const payload = (await response.json()) as ApiSuccess<T>;
  return payload.data;
}

async function apiUploadMedia(
  projectId: string,
  file: File,
  durationSeconds: number | null,
): Promise<MediaAsset> {
  const formData = new FormData();
  formData.append("file", file);
  if (durationSeconds !== null) {
    formData.append("durationSeconds", String(durationSeconds));
  }

  const response = await fetch(
    `${apiBaseUrl}/api/v1/projects/${projectId}/media`,
    {
      method: "POST",
      headers: {
        "x-request-id": `web-${Date.now()}`,
      },
      body: formData,
    },
  );

  if (!response.ok) {
    throw new Error(await readResponseErrorMessage(response));
  }

  const payload = (await response.json()) as ApiSuccess<MediaAsset>;
  return payload.data;
}

async function apiDelete(path: string): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/api/v1${path}`, {
    method: "DELETE",
    headers: { "x-request-id": `web-${Date.now()}` },
  });

  if (!response.ok) {
    throw new Error(await readResponseErrorMessage(response));
  }
}

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}/api/v1${path}`, {
    headers: { "x-request-id": `web-${Date.now()}` },
  });

  if (!response.ok) {
    throw new Error(await readResponseErrorMessage(response));
  }

  const payload = (await response.json()) as ApiSuccess<T>;
  return payload.data;
}

function isAiHandoffExtensionResponse(
  value: unknown,
): value is AiHandoffExtensionResponse {
  if (!isRecord(value) || typeof value.ok !== "boolean") {
    return false;
  }
  if (value.ok) {
    return (
      typeof value.handoffId === "string" && typeof value.status === "string"
    );
  }
  return typeof value.errorMessage === "string";
}

function sendAiHandoffToExtension(
  payload: {
    handoffId: string;
    provider: string;
    targetUrl: string;
    promptText: string;
    promptSelector: string;
    shotId: string;
  },
  missingMessage: string,
  rejectedMessage: string,
) {
  return new Promise<AiHandoffExtensionResponse>((resolve, reject) => {
    const runtime = (window as ChromeWindow).chrome?.runtime;
    if (!aiHandoffExtensionId || !runtime?.sendMessage) {
      reject(new Error(missingMessage));
      return;
    }

    runtime.sendMessage(
      aiHandoffExtensionId,
      {
        type: "VIDEOAI_AI_HANDOFF_START",
        payload,
      },
      (response) => {
        if (runtime.lastError) {
          reject(new Error(runtime.lastError.message || missingMessage));
          return;
        }
        if (!isAiHandoffExtensionResponse(response)) {
          reject(new Error(rejectedMessage));
          return;
        }
        resolve(response);
      },
    );
  });
}

function delay(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function getVideoDuration(previewUrl: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      resolve(video.duration);
    };
    video.onerror = () => {
      reject(new Error("Cannot read video duration"));
    };
    video.src = previewUrl;
  });
}

function getJobResult<T>(job: Job): T {
  return job.result as T;
}

function formatRawJson(value: unknown) {
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function toAbsolutePreviewUrl(previewUrl: string | undefined) {
  if (!previewUrl) {
    return null;
  }
  if (/^https?:\/\//i.test(previewUrl)) {
    return previewUrl;
  }
  return `${apiBaseUrl}${previewUrl}`;
}

function mapMediaAssetToItem(asset: MediaAsset, shotId?: string): MediaItem {
  return {
    id: asset.id,
    name: asset.originalFilename,
    sizeBytes: asset.sizeBytes,
    mimeType: asset.mimeType,
    kind: asset.mediaType,
    status: asset.status === "rejected" ? "rejected" : "validated",
    previewUrl: toAbsolutePreviewUrl(asset.previewUrl),
    validationError: asset.validationError ?? null,
    ...(shotId ? { shotId } : {}),
  };
}

function buildTemplateSelection(
  template: VideoTemplate | null,
  selectedOptionIds: Record<string, string[]>,
): TemplateSelection | null {
  if (!template) {
    return null;
  }

  const attributes = template.attributes
    .map((attribute) => {
      const selectedIds = selectedOptionIds[attribute.id] ?? [];
      return {
        id: attribute.id,
        name: attribute.name,
        options: attribute.options.filter((option) =>
          selectedIds.includes(option.id),
        ),
      };
    })
    .filter((attribute) => attribute.options.length > 0);

  if (attributes.length === 0) {
    return null;
  }

  return {
    templateId: template.id,
    templateName: template.name,
    attributes,
  };
}

function templateSelectionToOptionIds(
  selection: TemplateSelection | null | undefined,
) {
  if (!selection) {
    return {};
  }

  return selection.attributes.reduce<Record<string, string[]>>(
    (selectedIds, attribute) => ({
      ...selectedIds,
      [attribute.id]: attribute.options.map((option) => option.id),
    }),
    {},
  );
}

function templateSelectionToShotAttributes(
  selection: TemplateSelection | null,
): VideoShotAttribute[] {
  if (!selection) {
    return [];
  }

  return selection.attributes
    .filter((attribute) => attribute.options.length > 0)
    .map((attribute) => ({
      id: `scenario_${attribute.id}`,
      name: attribute.name,
      value: attribute.options.map((option) => option.label).join(", "),
    }));
}

function readScenarioHelperDetails(value?: string | null) {
  const lines = (value ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const translateLine = lines.find((line) =>
    /^(Translate|Vietnamese):/i.test(line),
  );
  const descriptionLine = lines.find((line) => /^Description:/i.test(line));
  const translate = translateLine
    ?.replace(/^(Translate|Vietnamese):\s*/i, "")
    .trim();
  const description = descriptionLine?.replace(/^Description:\s*/i, "").trim();
  const plainDescription =
    !translateLine && !descriptionLine ? lines.join("\n") : "";

  return {
    translate: translate || "",
    description: description || plainDescription,
  };
}

function ScenarioTextHelper({
  description,
  descriptionLabel,
  helperId,
  label,
  onToggle,
  openHelperId,
  translateLabel,
}: {
  description?:
    | ScenarioAttribute["description"]
    | ScenarioOption["description"];
  descriptionLabel: string;
  helperId: string;
  label: string;
  onToggle: (helperId: string) => void;
  openHelperId: string;
  translateLabel: string;
}) {
  const details = readScenarioHelperDetails(description);
  const isOpen = openHelperId === helperId;

  if (!details.translate && !details.description) {
    return null;
  }

  return (
    <span className="group relative inline-flex shrink-0">
      <button
        type="button"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-sky-100 bg-sky-50 text-sky-700 outline-none transition hover:border-sky-200 hover:bg-sky-100 focus:ring-2 focus:ring-sky-200"
        aria-expanded={isOpen}
        aria-label={label}
        title={label}
        onClick={(event) => {
          event.stopPropagation();
          onToggle(isOpen ? "" : helperId);
        }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <Info size={14} />
      </button>
      <span
        role="tooltip"
        className={`absolute right-0 top-full z-40 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-md border border-sky-100 bg-white p-3 text-left text-xs leading-5 text-slate-700 shadow-lg transition ${
          isOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        {details.translate ? (
          <span className="block">
            <span className="block font-semibold text-sky-900">
              {translateLabel}
            </span>
            <span className="mt-1 block whitespace-pre-wrap">
              {details.translate}
            </span>
          </span>
        ) : null}
        {details.description ? (
          <span className={details.translate ? "mt-3 block" : "block"}>
            <span className="block font-semibold text-sky-900">
              {descriptionLabel}
            </span>
            <span className="mt-1 block whitespace-pre-wrap">
              {details.description}
            </span>
          </span>
        ) : null}
      </span>
    </span>
  );
}

function buildShotSelection(
  shotPlan: VideoShotPlan | null,
  selectedShotIds: string[],
): ShotSelection | null {
  if (!shotPlan) {
    return null;
  }

  const shots = shotPlan.shots.filter((shot) =>
    selectedShotIds.includes(shot.id),
  );
  if (shots.length === 0) {
    return null;
  }

  return {
    shotPlanId: shotPlan.id,
    shotPlanName: shotPlan.name,
    attributes: shotPlan.attributes,
    shots,
  };
}

function clampShotDuration(value: number) {
  if (!Number.isFinite(value)) {
    return 8;
  }
  return Math.min(8, Math.max(1, Math.round(value)));
}

const draftShotPlanIdPrefix = "shot_plan_draft_";

function isDraftShotPlan(shotPlan: VideoShotPlan) {
  return shotPlan.id.startsWith(draftShotPlanIdPrefix);
}

function createLocalShot(durationSeconds: number): VideoShot {
  const id = `shot_local_${Date.now()}`;
  return {
    id,
    title: "New shot",
    description: "Describe the visual beat for this shot.",
    durationSeconds,
    mediaIds: [],
    attributes: [
      {
        id: `${id}_start_state`,
        name: "Start state",
        value:
          "Continue from the previous shot or establish the first clear visual state.",
      },
      {
        id: `${id}_end_state`,
        name: "End state",
        value:
          "Describe the final visual state that the next shot should continue from.",
      },
      {
        id: `${id}_camera`,
        name: "Camera",
        value: "Stable camera movement",
      },
      {
        id: `${id}_dialogue`,
        name: "Dialogue",
        value: "Add short dialogue or voiceover for this shot.",
      },
    ],
  };
}

function createLocalShotAttribute(): VideoShotAttribute {
  return {
    id: `attr_local_${Date.now()}`,
    name: "Attribute",
    value: "Value",
  };
}

function resizeTextareaToContent(textarea: HTMLTextAreaElement) {
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
}

function AutoResizeTextarea({
  onInput,
  value,
  rows = 1,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (textareaRef.current) {
      resizeTextareaToContent(textareaRef.current);
    }
  }, [value]);

  return (
    <textarea
      {...props}
      ref={textareaRef}
      rows={rows}
      value={value}
      onInput={(event) => {
        resizeTextareaToContent(event.currentTarget);
        onInput?.(event);
      }}
    />
  );
}

function toPlainRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readPlainString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function formatShotPlanResultText(shotPlan: VideoShotPlan) {
  return JSON.stringify(
    {
      shots: shotPlan.shots.map((shot) => ({
        id: shot.id,
        title: shot.title,
        description: shot.description,
        durationSeconds: shot.durationSeconds,
        attributes: shot.attributes,
        attributeSelection: shot.attributeSelection ?? null,
        mediaIds: shot.mediaIds ?? [],
      })),
    },
    null,
    2,
  );
}

function parseShotResultAttributes(value: unknown): VideoShotAttribute[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => {
      const record = toPlainRecord(item);
      const name = readPlainString(record.name);
      const attributeValue = readPlainString(record.value);
      if (!name || !attributeValue) {
        return null;
      }

      return {
        id:
          readPlainString(record.id) || `attr_json_${Date.now()}_${index + 1}`,
        name,
        value: attributeValue,
      };
    })
    .filter((attribute): attribute is VideoShotAttribute => Boolean(attribute));
}

function parseShotResultAttributeSelection(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = AttributeSelectionSchema.nullable().safeParse(value);
  if (!parsed.success) {
    throw new Error(
      "Shot attributeSelection must match the AttributeSelection JSON shape.",
    );
  }
  return parsed.data;
}

function parseShotResultShots(value: unknown) {
  if (!Array.isArray(value)) {
    throw new Error("Shots result JSON must include a shots array.");
  }

  const shots: VideoShot[] = [];
  value.forEach((item, index) => {
    const record = toPlainRecord(item);
    const title = readPlainString(record.title);
    const description = readPlainString(record.description);
    if (!title || !description) {
      return;
    }

    const rawMediaIds = Array.isArray(record.mediaIds) ? record.mediaIds : [];
    const parsedDurationSeconds = Number(record.durationSeconds);
    if (!Number.isFinite(parsedDurationSeconds)) {
      throw new Error(
        "Each shot in Shots result JSON must include durationSeconds.",
      );
    }

    shots.push({
      id: readPlainString(record.id) || `shot_json_${Date.now()}_${index + 1}`,
      title,
      description,
      durationSeconds: clampShotDuration(parsedDurationSeconds),
      attributes: parseShotResultAttributes(record.attributes),
      attributeSelection:
        parseShotResultAttributeSelection(record.attributeSelection) ?? null,
      mediaIds: rawMediaIds
        .map((mediaId) => readPlainString(mediaId))
        .filter(Boolean),
    });
  });

  if (shots.length === 0) {
    throw new Error(
      "Shots result JSON must include at least one shot with title and description.",
    );
  }

  return shots;
}

function parseShotPlanResultText(
  value: string,
  currentShotPlan: VideoShotPlan | null,
  context: {
    projectId: string;
    name: string;
    description?: string;
    sourceText: string;
  },
): VideoShotPlan {
  const parsed = JSON.parse(value) as unknown;
  const root = Array.isArray(parsed)
    ? { shots: parsed }
    : toPlainRecord(parsed);
  const shotPlanRoot = toPlainRecord(root.shotPlan);
  const resultRoot = Object.keys(shotPlanRoot).length > 0 ? shotPlanRoot : root;
  const shots =
    resultRoot.shots === undefined
      ? currentShotPlan?.shots
      : parseShotResultShots(resultRoot.shots);
  if (!shots || shots.length === 0) {
    throw new Error("Shots result JSON must include a shots array.");
  }

  const durationSeconds =
    resultRoot.shots === undefined && currentShotPlan?.durationSeconds
      ? currentShotPlan.durationSeconds
      : Math.max(...shots.map((shot) => shot.durationSeconds));
  const name =
    readPlainString(resultRoot.name) ||
    currentShotPlan?.name ||
    context.name.trim();
  if (!name) {
    throw new Error(
      "Project name is required before syncing Shots result JSON.",
    );
  }

  const sourceText = currentShotPlan?.sourceText || context.sourceText.trim();
  if (!sourceText) {
    throw new Error("Enter Story Content before syncing Shots result JSON.");
  }

  const now = new Date().toISOString();

  return {
    id: currentShotPlan?.id ?? `${draftShotPlanIdPrefix}${Date.now()}`,
    ownerUserId: currentShotPlan?.ownerUserId ?? "draft",
    projectId: currentShotPlan?.projectId ?? context.projectId,
    name,
    description:
      resultRoot.description === undefined
        ? currentShotPlan?.description ||
          context.description?.trim() ||
          undefined
        : readPlainString(resultRoot.description) || undefined,
    sourceText,
    durationSeconds,
    attributes:
      resultRoot.attributes === undefined
        ? (currentShotPlan?.attributes ?? [])
        : parseShotResultAttributes(resultRoot.attributes),
    shots,
    isDefault: currentShotPlan?.isDefault ?? false,
    status: currentShotPlan?.status ?? "active",
    createdAt: currentShotPlan?.createdAt ?? now,
    updatedAt: now,
  };
}

function isDialogueAttribute(attribute: VideoShotAttribute) {
  return attribute.name.trim().toLowerCase() === "dialogue";
}

function formatPromptAttributeLabel(name: string) {
  const trimmedName = name.trim();
  const normalizedName = trimmedName.toLowerCase();
  const labelOverrides: Record<string, string> = {
    "action & motion": "Action & Motion",
    dialogue: "Voiceover Script",
    "end state": "End State",
    "start state": "Start State",
    "voiceover script": "Voiceover Script",
  };

  return labelOverrides[normalizedName] ?? trimmedName;
}

function formatPromptAttributeLine(name: string, value: string) {
  const label = formatPromptAttributeLabel(name);
  const trimmedValue = value.trim();
  const renderedValue =
    label === "Voiceover Script"
      ? `"${trimmedValue.replaceAll('"', '\\"')}"`
      : trimmedValue;

  return `[${label}]: ${renderedValue}`;
}

function getShotDialogue(shot: VideoShot) {
  return shot.attributes.find(isDialogueAttribute)?.value ?? "";
}

function renderPromptTemplate(
  template: string,
  values: Record<string, string>,
) {
  if (
    template.includes(MASTER_PROMPT_OUTPUT_FORMAT_PLACEHOLDER) &&
    !values.outputFormat?.trim()
  ) {
    return "Cannot render prompt: Output Format is required before using {outputFormat}.";
  }
  return Object.entries(values).reduce(
    (rendered, [key, value]) => rendered.replaceAll(`{${key}}`, value),
    template,
  );
}

function requiredOptionIdsForTemplate(template: VideoTemplate | null) {
  if (!template) {
    return {};
  }
  return template.attributes.reduce<Record<string, string[]>>(
    (selectedIds, attribute) => {
      if (attribute.required && attribute.options[0]) {
        selectedIds[attribute.id] = [attribute.options[0].id];
      }
      return selectedIds;
    },
    {},
  );
}

function mergeWithRequiredOptionIds(
  template: VideoTemplate | null,
  current: Record<string, string[]>,
) {
  if (!template) {
    return current;
  }
  const next = { ...current };
  template.attributes.forEach((attribute) => {
    const firstOption = attribute.options[0];
    const currentIds = next[attribute.id];
    if (
      attribute.required &&
      (!currentIds || currentIds.length === 0) &&
      firstOption
    ) {
      next[attribute.id] = [firstOption.id];
    }
  });
  return next;
}

function requiredOptionIdsForCatalog(catalog: AttributeCatalog | null) {
  if (!catalog) {
    return {};
  }
  return catalog.attributes.reduce<Record<string, string[]>>(
    (selectedIds, attribute) => {
      if (attribute.required && attribute.options[0]) {
        selectedIds[attribute.id] = [attribute.options[0].id];
      }
      return selectedIds;
    },
    {},
  );
}

function mergeWithRequiredCatalogOptionIds(
  catalog: AttributeCatalog | null,
  current: Record<string, string[]>,
) {
  if (!catalog) {
    return current;
  }
  const next = { ...current };
  catalog.attributes.forEach((attribute) => {
    const firstOption = attribute.options[0];
    const currentIds = next[attribute.id];
    if (
      attribute.required &&
      (!currentIds || currentIds.length === 0) &&
      firstOption
    ) {
      next[attribute.id] = [firstOption.id];
    }
  });
  return next;
}

function attributeSelectionToOptionIds(
  selection: AttributeSelection | null | undefined,
) {
  if (!selection) {
    return {};
  }

  return selection.attributes.reduce<Record<string, string[]>>(
    (selectedIds, attribute) => ({
      ...selectedIds,
      [attribute.id]: attribute.options.map((option) => option.id),
    }),
    {},
  );
}

function buildAttributeSelection(
  catalog: AttributeCatalog | null,
  selectedOptionIds: Record<string, string[]>,
): AttributeSelection | null {
  if (!catalog) {
    return null;
  }
  const attributes = catalog.attributes
    .map((attribute) => {
      const selectedIds = selectedOptionIds[attribute.id] ?? [];
      return {
        id: attribute.id,
        name: attribute.name,
        required: attribute.required,
        options: attribute.options
          .filter((option) => selectedIds.includes(option.id))
          .map((option) => ({
            id: option.id,
            name: option.name,
            ...(option.description ? { description: option.description } : {}),
          })),
      };
    })
    .filter((attribute) => attribute.options.length > 0);
  return {
    catalogId: catalog.id,
    catalogName: catalog.name,
    type: catalog.type,
    attributes,
  };
}

function formatAttributeSelectionCompact(selection: AttributeSelection | null) {
  if (!selection || selection.attributes.length === 0) {
    return "";
  }

  return selection.attributes
    .map(
      (attribute) =>
        `${attribute.name}=${attribute.options.map((option) => option.name).join(",")};`,
    )
    .join("\n");
}

function attributeSelectionToShotAttributes(
  selection: AttributeSelection | null,
): VideoShotAttribute[] {
  if (!selection) {
    return [];
  }
  return selection.attributes
    .filter((attribute) => attribute.options.length > 0)
    .map((attribute) => ({
      id: `${selection.type}_${attribute.id}`,
      name: attribute.name,
      value: attribute.options.map((option) => option.name).join(", "),
    }));
}

function formatMediaPromptSummary(items: MediaItem[], emptyText: string) {
  if (items.length === 0) {
    return emptyText;
  }

  return items
    .map((item, index) =>
      [
        `${index + 1}. ${item.name}`,
        `   - ID: ${item.id}`,
        `   - Type: ${item.kind}`,
        `   - MIME: ${item.mimeType}`,
        `   - Size: ${formatBytes(item.sizeBytes)}`,
        ...(item.previewUrl ? [`   - Preview URL: ${item.previewUrl}`] : []),
      ].join("\n"),
    )
    .join("\n");
}

function makeScenarioEditorId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function normalizeScenarioIdentifier(value: string, fallback: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || fallback;
}

function humanizeScenarioKey(value: string) {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function splitUnescapedScenarioText(value: string, separator: string) {
  const parts: string[] = [];
  let current = "";
  let escaped = false;

  for (const character of value) {
    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }

    if (character === "\\") {
      escaped = true;
      continue;
    }

    if (character === separator) {
      parts.push(current);
      current = "";
      continue;
    }

    current += character;
  }

  parts.push(current);
  return parts;
}

function findUnescapedScenarioText(value: string, target: string) {
  let escaped = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (escaped) {
      escaped = false;
      continue;
    }

    if (character === "\\") {
      escaped = true;
      continue;
    }

    if (character === target) {
      return index;
    }
  }

  return -1;
}

function splitScenarioDetailParts(value: string) {
  return splitUnescapedScenarioText(value, "|").map((part) => part.trim());
}

function joinScenarioDetailDescription(parts: string[]) {
  return parts.filter(Boolean).join(" - ");
}

function optionFromScenarioLabel(label: string): ScenarioOption {
  return {
    id: makeScenarioEditorId("option"),
    label,
    value: label,
  };
}

function formatScenarioAttributesText(attributes: ScenarioAttribute[]) {
  return JSON.stringify(
    {
      attributes: attributes.map((attribute) => {
        const attributeDetails = readScenarioHelperDetails(
          attribute.description,
        );

        return {
          id: attribute.id,
          name: attribute.name,
          translate: attributeDetails.translate,
          description: attributeDetails.description,
          options: attribute.options.map((option) => {
            const optionDetails = readScenarioHelperDetails(option.description);

            return {
              id: option.id,
              label: option.label,
              value: option.value || option.label,
              translate: optionDetails.translate,
              description: optionDetails.description,
            };
          }),
        };
      }),
    },
    null,
    2,
  );
}

function descriptionFromScenarioTranslateAndDetail(
  translate: string,
  detail: string,
) {
  return [
    translate ? `Translate: ${translate}` : "",
    detail ? `Description: ${detail}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function parseScenarioAttributesCompactText(value: string) {
  const attributes = splitUnescapedScenarioText(value, ";")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry, attributeIndex): ScenarioAttribute | null => {
      const separatorIndex = findUnescapedScenarioText(entry, "=");
      if (separatorIndex < 1) {
        return null;
      }

      const keyParts = splitScenarioDetailParts(entry.slice(0, separatorIndex));
      const rawKey = keyParts[0] ?? "";
      const attributeDescription = joinScenarioDetailDescription(
        keyParts.slice(1),
      );
      const optionEntries = splitUnescapedScenarioText(
        entry.slice(separatorIndex + 1),
        ",",
      )
        .map((option) => splitScenarioDetailParts(option))
        .flatMap((parts) => {
          const label = parts[0];
          return label
            ? [
                {
                  label,
                  description: joinScenarioDetailDescription(parts.slice(1)),
                },
              ]
            : [];
        });

      if (!rawKey || optionEntries.length === 0) {
        return null;
      }

      const attributeId = normalizeScenarioIdentifier(
        rawKey,
        `attribute-${attributeIndex + 1}`,
      );
      return {
        id: attributeId,
        name: humanizeScenarioKey(rawKey),
        ...(attributeDescription ? { description: attributeDescription } : {}),
        options: optionEntries.map((optionEntry, optionIndex) => ({
          id: `${attributeId}-${normalizeScenarioIdentifier(optionEntry.label, `option-${optionIndex + 1}`)}`,
          label: optionEntry.label,
          value: optionEntry.label,
          ...(optionEntry.description
            ? { description: optionEntry.description }
            : {}),
        })),
      };
    })
    .filter((attribute): attribute is ScenarioAttribute => Boolean(attribute));

  const validated = TemplateAttributeSchema.array()
    .min(1)
    .safeParse(attributes);
  if (!validated.success) {
    throw new Error("Invalid Scenario attributes.");
  }

  return validated.data;
}

function parseScenarioAttributesJson(value: string) {
  const parsed = JSON.parse(value) as unknown;
  const root =
    parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : {};
  const inputAttributes = Array.isArray(parsed)
    ? parsed
    : Array.isArray(root.attributes)
      ? root.attributes
      : null;

  if (!inputAttributes) {
    throw new Error("Invalid Scenario attributes.");
  }

  const attributes = inputAttributes
    .map((attributeInput, attributeIndex): ScenarioAttribute | null => {
      const attribute =
        attributeInput && typeof attributeInput === "object"
          ? (attributeInput as Record<string, unknown>)
          : {};
      const name = String(attribute.name ?? "").trim();
      const optionsInput = Array.isArray(attribute.options)
        ? attribute.options
        : [];
      const options = optionsInput
        .map((optionInput, optionIndex): ScenarioOption | null => {
          const option =
            optionInput && typeof optionInput === "object"
              ? (optionInput as Record<string, unknown>)
              : {};
          const label =
            typeof optionInput === "string"
              ? optionInput.trim()
              : String(option.label ?? option.value ?? "").trim();
          const optionTranslate = String(
            option.translate ??
              option.vietnamese ??
              option.vi ??
              option.translation ??
              "",
          ).trim();
          const optionDetail = String(
            option.description ?? option.explanation ?? option.detail ?? "",
          ).trim();
          const optionDescription = descriptionFromScenarioTranslateAndDetail(
            optionTranslate,
            optionDetail,
          );
          if (!label) {
            return null;
          }
          const attributeId = normalizeScenarioIdentifier(
            name,
            `attribute-${attributeIndex + 1}`,
          );
          return {
            id:
              String(option.id ?? "").trim() ||
              `${attributeId}-${normalizeScenarioIdentifier(label, `option-${optionIndex + 1}`)}`,
            label,
            value: String(option.value ?? "").trim() || label,
            ...(optionDescription ? { description: optionDescription } : {}),
          };
        })
        .filter((option): option is ScenarioOption => Boolean(option));

      if (!name || options.length === 0) {
        return null;
      }
      const attributeDescription = descriptionFromScenarioTranslateAndDetail(
        String(
          attribute.translate ??
            attribute.vietnamese ??
            attribute.vi ??
            attribute.translation ??
            "",
        ).trim(),
        String(
          attribute.description ??
            attribute.explanation ??
            attribute.detail ??
            "",
        ).trim(),
      );

      return {
        id:
          String(attribute.id ?? "").trim() ||
          normalizeScenarioIdentifier(name, `attribute-${attributeIndex + 1}`),
        name,
        ...(attributeDescription ? { description: attributeDescription } : {}),
        options,
      };
    })
    .filter((attribute): attribute is ScenarioAttribute => Boolean(attribute));

  const validated = TemplateAttributeSchema.array()
    .min(1)
    .safeParse(attributes);
  if (!validated.success) {
    throw new Error("Invalid Scenario attributes.");
  }

  return validated.data;
}

function parseScenarioAttributesText(value: string) {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    throw new Error("Invalid Scenario attributes.");
  }

  return trimmedValue.startsWith("[") || trimmedValue.startsWith("{")
    ? parseScenarioAttributesJson(trimmedValue)
    : parseScenarioAttributesCompactText(trimmedValue);
}

export function ProjectWorkspace({
  projectId,
  projectName,
  projectDescription,
  flowType,
  workspaceMode = "project",
  savedTemplateSelection,
  savedAttributeSelections,
  defaultPrompt,
  defaultProductUrl,
}: ProjectWorkspaceProps) {
  const { t } = useI18n();
  const isOneClickMode = workspaceMode === "one-click";
  const oneClickRecordName =
    projectName?.trim() || t("oneClick.namePlaceholder");
  const oneClickRecordDescription =
    projectDescription?.trim() || t("oneClick.wizardDescription");
  const projectHeaderTitle =
    projectName?.trim() || t("projectDetail.fallbackTitle");
  const projectHeaderDescription =
    projectDescription?.trim() ||
    (isOneClickMode
      ? t("oneClick.wizardDescription")
      : t("projectDetail.description"));
  const [promptText, setPromptText] = useState(
    defaultPrompt || (isOneClickMode ? "" : t("projectDetail.defaultPrompt")),
  );
  const [productUrl, setProductUrl] = useState(defaultProductUrl);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [shotPlans, setShotPlans] = useState<VideoShotPlan[]>([]);
  const [selectedShotPlanId, setSelectedShotPlanId] = useState("");
  const [selectedShotIds, setSelectedShotIds] = useState<string[]>([]);
  const [shotsResultText, setShotsResultText] = useState("");
  const [shotsResultJsonError, setShotsResultJsonError] = useState("");
  const [rawShotRequest, setRawShotRequest] = useState<unknown>(null);
  const [rawShotResponse, setRawShotResponse] = useState<unknown>(null);
  const [rawStoryRequest, setRawStoryRequest] = useState<unknown>(null);
  const [rawStoryResponse, setRawStoryResponse] = useState<unknown>(null);
  const [rawTemplateRequest, setRawTemplateRequest] = useState<unknown>(null);
  const [rawTemplateResponse, setRawTemplateResponse] = useState<unknown>(null);
  const [rawProductRequest, setRawProductRequest] = useState<unknown>(null);
  const [rawProductResponse, setRawProductResponse] = useState<unknown>(null);
  const [rawDataModal, setRawDataModal] = useState<RawDataModalState | null>(
    null,
  );
  const [isRawDataCopied, setIsRawDataCopied] = useState(false);
  const [templates, setTemplates] = useState<VideoTemplate[]>([]);
  const [oneClickScenarioName, setOneClickScenarioName] = useState("");
  const [oneClickScenarioDescription, setOneClickScenarioDescription] =
    useState("");
  const [oneClickScenarioAttributesText, setOneClickScenarioAttributesText] =
    useState("");
  const [isEditingOneClickScenarioSchema, setIsEditingOneClickScenarioSchema] =
    useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedOptionIds, setSelectedOptionIds] = useState<
    Record<string, string[]>
  >({});
  const [scenarioAttributeCatalog, setScenarioAttributeCatalog] =
    useState<AttributeCatalog | null>(null);
  const [storyAttributeCatalog, setStoryAttributeCatalog] =
    useState<AttributeCatalog | null>(null);
  const [shotsAttributeCatalog, setShotsAttributeCatalog] =
    useState<AttributeCatalog | null>(null);
  const [shotAttributeCatalog, setShotAttributeCatalog] =
    useState<AttributeCatalog | null>(null);
  const [storyOptionIds, setStoryOptionIds] = useState<
    Record<string, string[]>
  >({});
  const [shotsOptionIds, setShotsOptionIds] = useState<
    Record<string, string[]>
  >({});
  const [templateAnalysisCompact, setTemplateAnalysisCompact] = useState("");
  const [generatedShotPrompts, setGeneratedShotPrompts] = useState<
    Record<string, string>
  >({});
  const [creatingVideoShotIds, setCreatingVideoShotIds] = useState<
    Record<string, boolean>
  >({});
  const [shotVideoMessages, setShotVideoMessages] = useState<
    Record<string, string>
  >({});
  const [shotVideoErrors, setShotVideoErrors] = useState<
    Record<string, string>
  >({});
  const [rawShotVideoRequests, setRawShotVideoRequests] = useState<
    Record<string, unknown>
  >({});
  const [rawShotVideoResponses, setRawShotVideoResponses] = useState<
    Record<string, unknown>
  >({});
  const [handoffShotIds, setHandoffShotIds] = useState<Record<string, boolean>>(
    {},
  );
  const [shotHandoffMessages, setShotHandoffMessages] = useState<
    Record<string, string>
  >({});
  const [shotHandoffErrors, setShotHandoffErrors] = useState<
    Record<string, string>
  >({});
  const [shotPromptTemplate, setShotPromptTemplate] = useState("");
  const [shotPromptOutputFormat, setShotPromptOutputFormat] = useState("");
  const [shotGenerationPrompt, setShotGenerationPrompt] = useState(
    DEFAULT_SHOT_GENERATION_PROMPT,
  );
  const [shotGenerationOutputFormat, setShotGenerationOutputFormat] = useState(
    DEFAULT_SHOT_GENERATION_OUTPUT_FORMAT,
  );
  const [scenarioAnalysisPrompt, setScenarioAnalysisPrompt] = useState(
    DEFAULT_TEMPLATE_SELECTION_PROMPT,
  );
  const [scenarioAnalysisOutputFormat, setScenarioAnalysisOutputFormat] =
    useState(DEFAULT_TEMPLATE_SELECTION_OUTPUT_FORMAT);
  const [scriptGenerationPrompt, setScriptGenerationPrompt] = useState(
    DEFAULT_SCRIPT_GENERATION_PROMPT,
  );
  const [scriptGenerationOutputFormat, setScriptGenerationOutputFormat] =
    useState(DEFAULT_SCRIPT_GENERATION_OUTPUT_FORMAT);
  const [showUserMasterPrompts, setShowUserMasterPrompts] = useState(false);
  const [aiHandoffProvider, setAiHandoffProvider] = useState("");
  const [aiHandoffTargetUrl, setAiHandoffTargetUrl] = useState("");
  const [aiHandoffPromptSelector, setAiHandoffPromptSelector] = useState("");
  const [isStoryStepOpen, setIsStoryStepOpen] = useState(true);
  const [isTemplateStepOpen, setIsTemplateStepOpen] = useState(true);
  const [isTemplateAttributesOpen, setIsTemplateAttributesOpen] =
    useState(false);
  const [isStoryAttributesOpen, setIsStoryAttributesOpen] = useState(false);
  const [isShotsAttributesOpen, setIsShotsAttributesOpen] = useState(false);
  const [isShotsStepOpen, setIsShotsStepOpen] = useState(true);
  const [isShotCardsStepOpen, setIsShotCardsStepOpen] = useState(true);
  const [collapsedTemplateAttributeIds, setCollapsedTemplateAttributeIds] =
    useState<Record<string, boolean>>({});
  const [collapsedCatalogAttributeIds, setCollapsedCatalogAttributeIds] =
    useState<Record<string, boolean>>({});
  const [openScenarioHelperId, setOpenScenarioHelperId] = useState("");
  const [openShotAttributePanelIds, setOpenShotAttributePanelIds] = useState<
    Record<string, boolean>
  >({});
  const [openAdminShotAttributePanelIds, setOpenAdminShotAttributePanelIds] =
    useState<Record<string, boolean>>({});
  const [finalPrompt, setFinalPrompt] = useState("");
  const [productAnalysis, setProductAnalysis] =
    useState<ProductAnalysisResult | null>(null);
  const [scriptResult, setScriptResult] = useState<ScriptResult | null>(null);
  const [status, setStatus] = useState<ActionStatus>({
    label: t("common.ready"),
    tone: "neutral",
  });
  const [errorMessage, setErrorMessage] = useState("");
  const [storyGenerationErrorMessage, setStoryGenerationErrorMessage] =
    useState("");
  const [templateAnalysisErrorMessage, setTemplateAnalysisErrorMessage] =
    useState("");
  const [shotGenerationErrorMessage, setShotGenerationErrorMessage] =
    useState("");
  const [shotGenerationSuccessMessage, setShotGenerationSuccessMessage] =
    useState("");
  const [oneClickScenarioEditorMessage, setOneClickScenarioEditorMessage] =
    useState("");
  const [oneClickScenarioEditorError, setOneClickScenarioEditorError] =
    useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingShots, setIsGeneratingShots] = useState(false);
  const [isSavingShots, setIsSavingShots] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAnalyzingTemplate, setIsAnalyzingTemplate] = useState(false);
  const [isSavingTemplateSelection, setIsSavingTemplateSelection] =
    useState(false);
  const [isSavingStoryContent, setIsSavingStoryContent] = useState(false);
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [isSavingOneClickScenario, setIsSavingOneClickScenario] =
    useState(false);
  const [isCreatingScript, setIsCreatingScript] = useState(false);
  const [isPromptPreviewOpen, setIsPromptPreviewOpen] = useState(false);
  const [isPromptPreviewCopied, setIsPromptPreviewCopied] = useState(false);
  const [oneClickStep, setOneClickStep] = useState<1 | 2 | 3>(1);
  const previewUrlsRef = useRef<string[]>([]);
  const hasUserEditedStoryContentRef = useRef(false);
  const lastSyncedOneClickScenarioIdRef = useRef("");
  const isSyncingShotsFromJsonRef = useRef(false);

  const validMediaItems = mediaItems.filter(
    (item) => item.status === "validated",
  );
  const validMediaIds = validMediaItems.map((item) => item.id);
  const selectedTemplate =
    templates.find((template) => template.id === selectedTemplateId) ?? null;
  const templateSelection = buildTemplateSelection(
    selectedTemplate,
    selectedOptionIds,
  );
  const storyAttributeSelection = buildAttributeSelection(
    storyAttributeCatalog,
    storyOptionIds,
  );
  const scenarioAttributeSelection = buildAttributeSelection(
    scenarioAttributeCatalog,
    selectedOptionIds,
  );
  const shotsAttributeSelection = buildAttributeSelection(
    shotsAttributeCatalog,
    shotsOptionIds,
  );
  const selectedShotPlan =
    shotPlans.find((shotPlan) => shotPlan.id === selectedShotPlanId) ?? null;
  const shotSelection = buildShotSelection(selectedShotPlan, selectedShotIds);

  function buildShotAttributeSelectionForShot(shot: VideoShot) {
    if (!shotAttributeCatalog) {
      return shot.attributeSelection ?? null;
    }
    const selectedIds = mergeWithRequiredCatalogOptionIds(
      shotAttributeCatalog,
      attributeSelectionToOptionIds(shot.attributeSelection),
    );
    return buildAttributeSelection(shotAttributeCatalog, selectedIds);
  }

  useEffect(() => {
    if (!shotAttributeCatalog || !selectedShotPlanId) {
      return;
    }

    setShotPlans((current) => {
      let changed = false;
      const nextPlans = current.map((shotPlan) => {
        if (shotPlan.id !== selectedShotPlanId) {
          return shotPlan;
        }
        const nextShots = shotPlan.shots.map((shot) => {
          const nextSelection = buildShotAttributeSelectionForShot(shot);
          if (
            JSON.stringify(shot.attributeSelection ?? null) ===
            JSON.stringify(nextSelection ?? null)
          ) {
            return shot;
          }
          changed = true;
          return {
            ...shot,
            attributeSelection: nextSelection,
          };
        });
        return changed ? { ...shotPlan, shots: nextShots } : shotPlan;
      });
      return changed ? nextPlans : current;
    });
  }, [selectedShotPlanId, shotAttributeCatalog]);

  useEffect(() => {
    if (isSyncingShotsFromJsonRef.current) {
      isSyncingShotsFromJsonRef.current = false;
      return;
    }

    setShotsResultText(
      selectedShotPlan ? formatShotPlanResultText(selectedShotPlan) : "",
    );
    setShotsResultJsonError("");
  }, [selectedShotPlan]);

  useEffect(() => {
    if (!isOneClickMode || !selectedTemplate) {
      lastSyncedOneClickScenarioIdRef.current = "";
      setOneClickScenarioName("");
      setOneClickScenarioDescription("");
      setOneClickScenarioAttributesText("");
      setOneClickScenarioEditorMessage("");
      setOneClickScenarioEditorError("");
      setIsEditingOneClickScenarioSchema(false);
      return;
    }

    if (lastSyncedOneClickScenarioIdRef.current === selectedTemplate.id) {
      return;
    }

    lastSyncedOneClickScenarioIdRef.current = selectedTemplate.id;
    setOneClickScenarioName(selectedTemplate.name);
    setOneClickScenarioDescription(selectedTemplate.description ?? "");
    setOneClickScenarioAttributesText(
      formatScenarioAttributesText(selectedTemplate.attributes),
    );
    setOneClickScenarioEditorMessage("");
    setOneClickScenarioEditorError("");
    setIsEditingOneClickScenarioSchema(false);
  }, [isOneClickMode, selectedTemplate]);

  function getShotMediaItems(shot: VideoShot) {
    const shotMediaIds = new Set(shot.mediaIds ?? []);
    return mediaItems.filter(
      (item) => item.shotId === shot.id || shotMediaIds.has(item.id),
    );
  }

  function getValidShotMediaItems(shot: VideoShot) {
    return getShotMediaItems(shot).filter(
      (item) => item.status === "validated",
    );
  }

  const scriptMediaIds = Array.from(
    new Set(shotSelection?.shots.flatMap((shot) => shot.mediaIds ?? []) ?? []),
  );
  const requestMediaItems =
    flowType === "script"
      ? validMediaItems.filter((item) => scriptMediaIds.includes(item.id))
      : validMediaItems;
  const requestMediaIds = requestMediaItems.map((item) => item.id);

  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach((url) => {
        URL.revokeObjectURL(url);
      });
    };
  }, []);

  useEffect(() => {
    hasUserEditedStoryContentRef.current = false;
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;

    async function loadPersistedMedia() {
      try {
        const assets = await apiGet<MediaAsset[]>(
          `/projects/${projectId}/media`,
        );
        if (!cancelled) {
          setMediaItems(assets.map((asset) => mapMediaAssetToItem(asset)));
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : t("workspace.generateFailed"),
          );
        }
      }
    }

    void loadPersistedMedia();

    return () => {
      cancelled = true;
    };
  }, [projectId, t]);

  useEffect(() => {
    let cancelled = false;

    if (flowType !== "script") {
      return () => {
        cancelled = true;
      };
    }

    async function loadStoryContent() {
      try {
        const saved = await apiGet<ProjectStoryContentResponse>(
          `/projects/${projectId}/story-content`,
        );
        if (!cancelled && saved.storyContent.trim()) {
          setPromptText((current) =>
            hasUserEditedStoryContentRef.current ? current : saved.storyContent,
          );
        }
      } catch {
        // Story Content is optional for new Scenario projects.
      }
    }

    void loadStoryContent();

    return () => {
      cancelled = true;
    };
  }, [flowType, projectId]);

  useEffect(() => {
    let cancelled = false;

    if (flowType !== "script") {
      setShotPlans([]);
      setSelectedShotPlanId("");
      setSelectedShotIds([]);
      setRawShotRequest(null);
      setRawShotResponse(null);
      return () => {
        cancelled = true;
      };
    }

    async function loadShotPlans() {
      try {
        const loadedShotPlans = await apiGet<VideoShotPlan[]>(
          `/projects/${projectId}/shots`,
        );
        if (!cancelled) {
          setShotPlans(loadedShotPlans);
          setSelectedShotPlanId(
            (current) => current || loadedShotPlans[0]?.id || "",
          );
          setSelectedShotIds((current) =>
            current.length > 0
              ? current
              : (loadedShotPlans[0]?.shots.map((shot) => shot.id) ?? []),
          );
        }
      } catch {
        if (!cancelled) {
          setShotPlans([]);
        }
      }
    }

    void loadShotPlans();

    return () => {
      cancelled = true;
    };
  }, [flowType, isOneClickMode, projectId]);

  useEffect(() => {
    let cancelled = false;

    async function loadTemplates() {
      try {
        const defaultScenarioCatalog = await apiGet<AttributeCatalog | null>(
          "/attribute-catalogs/scenario/default",
        );
        const loadedTemplates = defaultScenarioCatalog
          ? [catalogToVideoTemplate(defaultScenarioCatalog)]
          : [];
        if (!cancelled) {
          setScenarioAttributeCatalog(defaultScenarioCatalog);
          setTemplates(loadedTemplates);
          const nextTemplateId =
            loadedTemplates[0]?.id ||
            (savedTemplateSelection?.templateId ?? "");
          setSelectedTemplateId((current) => current || nextTemplateId);
          if (
            savedTemplateSelection &&
            loadedTemplates.some(
              (template) => template.id === savedTemplateSelection.templateId,
            )
          ) {
            setSelectedOptionIds(
              mergeWithRequiredOptionIds(
                loadedTemplates[0] ?? null,
                templateSelectionToOptionIds(savedTemplateSelection),
              ),
            );
          } else if (loadedTemplates[0]) {
            setSelectedOptionIds(
              requiredOptionIdsForTemplate(loadedTemplates[0]),
            );
          }
        }
      } catch {
        if (!cancelled) {
          setScenarioAttributeCatalog(null);
          setTemplates([]);
        }
      }
    }

    void loadTemplates();

    return () => {
      cancelled = true;
    };
  }, [savedTemplateSelection]);

  useEffect(() => {
    let cancelled = false;

    async function loadStepAttributeCatalogs() {
      try {
        const [storyCatalog, shotsCatalog, shotCatalog] = await Promise.all([
          apiGet<AttributeCatalog | null>("/attribute-catalogs/story/default"),
          apiGet<AttributeCatalog | null>("/attribute-catalogs/shots/default"),
          apiGet<AttributeCatalog | null>("/attribute-catalogs/shot/default"),
        ]);
        if (cancelled) {
          return;
        }
        setStoryAttributeCatalog(storyCatalog);
        setStoryOptionIds(
          mergeWithRequiredCatalogOptionIds(
            storyCatalog,
            attributeSelectionToOptionIds(savedAttributeSelections?.story),
          ),
        );
        setShotsAttributeCatalog(shotsCatalog);
        setShotsOptionIds(
          mergeWithRequiredCatalogOptionIds(
            shotsCatalog,
            attributeSelectionToOptionIds(savedAttributeSelections?.shots),
          ),
        );
        setShotAttributeCatalog(shotCatalog);
      } catch {
        if (!cancelled) {
          setStoryAttributeCatalog(null);
          setStoryOptionIds({});
          setShotsAttributeCatalog(null);
          setShotsOptionIds({});
          setShotAttributeCatalog(null);
        }
      }
    }

    void loadStepAttributeCatalogs();

    return () => {
      cancelled = true;
    };
  }, [savedAttributeSelections]);

  useEffect(() => {
    let cancelled = false;

    async function loadShotPromptConfig() {
      try {
        const config = await apiGet<ShotPromptConfig>("/admin/shot-prompt");
        if (!cancelled) {
          setShotPromptTemplate(config.shotPrompt);
          setShotPromptOutputFormat(config.shotOutputFormat);
          setShotGenerationPrompt(
            config.prompt ||
              config.defaultPrompt ||
              DEFAULT_SHOT_GENERATION_PROMPT,
          );
          setShotGenerationOutputFormat(
            config.outputFormat ??
              config.defaultOutputFormat ??
              DEFAULT_SHOT_GENERATION_OUTPUT_FORMAT,
          );
          setScenarioAnalysisPrompt(
            config.scenarioAnalysisPrompt ||
              config.defaultScenarioAnalysisPrompt ||
              DEFAULT_TEMPLATE_SELECTION_PROMPT,
          );
          setScenarioAnalysisOutputFormat(
            config.scenarioAnalysisOutputFormat ??
              config.defaultScenarioAnalysisOutputFormat ??
              DEFAULT_TEMPLATE_SELECTION_OUTPUT_FORMAT,
          );
          setScriptGenerationPrompt(
            config.scriptGenerationPrompt ||
              config.defaultScriptGenerationPrompt ||
              DEFAULT_SCRIPT_GENERATION_PROMPT,
          );
          setScriptGenerationOutputFormat(
            config.scriptGenerationOutputFormat ??
              config.defaultScriptGenerationOutputFormat ??
              DEFAULT_SCRIPT_GENERATION_OUTPUT_FORMAT,
          );
          setShowUserMasterPrompts(config.showUserMasterPrompts);
          setAiHandoffProvider(config.aiHandoffProvider);
          setAiHandoffTargetUrl(config.aiHandoffTargetUrl ?? "");
          setAiHandoffPromptSelector(config.aiHandoffPromptSelector ?? "");
        }
      } catch {
        if (!cancelled) {
          setShotPromptTemplate("");
          setShotPromptOutputFormat("");
          setShotGenerationPrompt(DEFAULT_SHOT_GENERATION_PROMPT);
          setShotGenerationOutputFormat(DEFAULT_SHOT_GENERATION_OUTPUT_FORMAT);
          setScenarioAnalysisPrompt(DEFAULT_TEMPLATE_SELECTION_PROMPT);
          setScenarioAnalysisOutputFormat(
            DEFAULT_TEMPLATE_SELECTION_OUTPUT_FORMAT,
          );
          setScriptGenerationPrompt(DEFAULT_SCRIPT_GENERATION_PROMPT);
          setScriptGenerationOutputFormat(
            DEFAULT_SCRIPT_GENERATION_OUTPUT_FORMAT,
          );
          setAiHandoffProvider("");
          setAiHandoffTargetUrl("");
          setAiHandoffPromptSelector("");
        }
      }
    }

    void loadShotPromptConfig();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setStatus((current) =>
      current.tone === "neutral"
        ? { ...current, label: t("common.ready") }
        : current,
    );
  }, [t]);

  useEffect(() => {
    if (!isPromptPreviewOpen && !rawDataModal) {
      return;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (rawDataModal) {
          setRawDataModal(null);
          return;
        }
        setIsPromptPreviewOpen(false);
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isPromptPreviewOpen, rawDataModal]);

  useEffect(() => {
    setIsRawDataCopied(false);
  }, [rawDataModal]);

  useEffect(() => {
    setIsPromptPreviewCopied(false);
  }, [isPromptPreviewOpen]);

  useEffect(() => {
    if (defaultPrompt || isOneClickMode) {
      return;
    }
    const defaultPrompts: string[] = [translate("projectDetail.defaultPrompt")];
    setPromptText((current) =>
      defaultPrompts.includes(current)
        ? t("projectDetail.defaultPrompt")
        : current,
    );
  }, [defaultPrompt, isOneClickMode, t]);

  useEffect(() => {
    if (!isOneClickMode) {
      return;
    }

    if (oneClickStep === 1) {
      setIsStoryStepOpen(true);
    }
    if (oneClickStep === 2) {
      setIsTemplateStepOpen(true);
    }
    if (oneClickStep === 3) {
      setIsShotsStepOpen(true);
    }
  }, [isOneClickMode, oneClickStep]);

  async function pollJob(jobId: string) {
    let latest = await apiGet<Job>(`/jobs/${jobId}`);
    setStatus({
      label: formatJobStatus(latest, t),
      tone: latest.status === "failed" ? "danger" : "info",
    });

    for (
      let attempt = 0;
      attempt < 12 && !terminalStatuses.has(latest.status);
      attempt += 1
    ) {
      await delay(350);
      latest = await apiGet<Job>(`/jobs/${jobId}`);
      setStatus({
        label: formatJobStatus(latest, t),
        tone:
          latest.status === "succeeded"
            ? "success"
            : latest.status === "failed"
              ? "danger"
              : "info",
      });
    }

    if (latest.status !== "succeeded") {
      throw new JobFailureError(
        latest,
        latest.error?.message ?? t("workspace.requestIncomplete"),
      );
    }

    return latest;
  }

  async function saveProjectAttributeSelections() {
    await apiPatch<{ saved: boolean }>(
      `/projects/${projectId}/attribute-selections`,
      {
        attributeSelections: {
          story: storyAttributeSelection,
          scenario: scenarioAttributeSelection,
          shots: shotsAttributeSelection,
        },
      },
    );
  }

  async function buildMediaItem(
    file: File,
    nextTotalBytes: number,
    shotId?: string,
  ): Promise<MediaItem> {
    const kind = detectMediaKind(file);
    const id = `media_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const previewUrl = URL.createObjectURL(file);

    const rejected = (validationError: string): MediaItem => ({
      id,
      name: file.name,
      sizeBytes: file.size,
      mimeType: file.type || "unknown",
      kind,
      status: "rejected",
      previewUrl,
      validationError,
      ...(shotId ? { shotId } : {}),
    });

    const keepLocalPreview = () => {
      previewUrlsRef.current.push(previewUrl);
    };

    if (kind === "unknown") {
      keepLocalPreview();
      return rejected(t("workspace.invalidFileType"));
    }
    if (nextTotalBytes > maxTotalBytes) {
      keepLocalPreview();
      return rejected(t("workspace.tooLargeTotal"));
    }
    if (kind === "image" && file.size > maxImageBytes) {
      keepLocalPreview();
      return rejected(t("workspace.tooLargeImage"));
    }
    if (kind === "video" && file.size > maxVideoBytes) {
      keepLocalPreview();
      return rejected(t("workspace.tooLargeVideo"));
    }
    let durationSeconds: number | null = null;
    if (kind === "video") {
      try {
        const duration = await getVideoDuration(previewUrl);
        durationSeconds = Number.isFinite(duration)
          ? Math.ceil(duration)
          : null;
        if (Number.isFinite(duration) && duration > maxVideoSeconds) {
          keepLocalPreview();
          return rejected(t("workspace.tooLongVideo"));
        }
      } catch {
        keepLocalPreview();
        return rejected(t("workspace.invalidVideoDuration"));
      }
    }

    try {
      const asset = await apiUploadMedia(projectId, file, durationSeconds);
      URL.revokeObjectURL(previewUrl);
      return mapMediaAssetToItem(asset, shotId);
    } catch (error) {
      keepLocalPreview();
      return rejected(
        error instanceof Error ? error.message : t("workspace.rejectedFiles"),
      );
    }
  }

  async function addFiles(files: FileList | File[], shotId?: string) {
    setErrorMessage("");
    const incoming = Array.from(files);
    if (incoming.length === 0) {
      return;
    }

    const availableSlots = Math.max(0, maxFiles - mediaItems.length);
    if (availableSlots === 0) {
      setErrorMessage(t("workspace.tooManyFiles"));
      return;
    }

    const selectedFiles = incoming.slice(0, availableSlots);
    let nextTotalBytes = mediaItems
      .filter((item) => item.status === "validated")
      .reduce((total, item) => total + item.sizeBytes, 0);
    const nextItems: MediaItem[] = [];

    for (const file of selectedFiles) {
      nextTotalBytes += file.size;
      const item = await buildMediaItem(file, nextTotalBytes, shotId);
      nextItems.push(item);
      if (item.status === "rejected") {
        nextTotalBytes -= file.size;
      }
    }

    if (incoming.length > selectedFiles.length) {
      setErrorMessage(t("workspace.tooManySkipped"));
    }

    setMediaItems((current) => [...current, ...nextItems]);
    setRawStoryRequest(null);
    setRawStoryResponse(null);
    setRawProductRequest(null);
    setRawProductResponse(null);
    const validUploadedIds = nextItems
      .filter((item) => item.status === "validated")
      .map((item) => item.id);
    if (shotId && validUploadedIds.length > 0) {
      const nextShotPlan = selectedShotPlan
        ? {
            ...selectedShotPlan,
            shots: selectedShotPlan.shots.map((shot) =>
              shot.id === shotId
                ? {
                    ...shot,
                    mediaIds: Array.from(
                      new Set([...(shot.mediaIds ?? []), ...validUploadedIds]),
                    ),
                  }
                : shot,
            ),
          }
        : null;

      if (nextShotPlan) {
        setShotPlans((current) =>
          current.map((shotPlan) =>
            shotPlan.id === nextShotPlan.id ? nextShotPlan : shotPlan,
          ),
        );
        setGeneratedShotPrompts((current) => {
          const { [shotId]: _removedPrompt, ...nextPrompts } = current;
          return nextPrompts;
        });
        void persistShotPlanMedia(nextShotPlan, [
          ...validMediaIds,
          ...validUploadedIds,
        ]);
      }
    }
    setStatus({
      label: nextItems.some((item) => item.status === "rejected")
        ? t("workspace.rejectedFiles")
        : t("workspace.referenceReady"),
      tone: nextItems.some((item) => item.status === "rejected")
        ? "warning"
        : "success",
    });
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>, shotId?: string) {
    const files = event.target.files;
    if (files) {
      void addFiles(files, shotId);
    }
    event.target.value = "";
  }

  function onDrop(event: DragEvent<HTMLDivElement>, shotId?: string) {
    event.preventDefault();
    void addFiles(event.dataTransfer.files, shotId);
  }

  function buildShotPlanSaveBody(
    shotPlan: VideoShotPlan,
    allowedMediaIds = validMediaIds,
  ) {
    return {
      name: shotPlan.name,
      description: shotPlan.description,
      durationSeconds: shotPlan.durationSeconds,
      attributes: shotPlan.attributes.filter(
        (attribute) => attribute.name.trim() && attribute.value.trim(),
      ),
      shots: shotPlan.shots.map((shot) => ({
        ...shot,
        attributeSelection: buildShotAttributeSelectionForShot(shot),
        durationSeconds: clampShotDuration(shot.durationSeconds),
        mediaIds: (shot.mediaIds ?? []).filter((mediaId) =>
          allowedMediaIds.includes(mediaId),
        ),
        attributes: shot.attributes.filter(
          (attribute) => attribute.name.trim() && attribute.value.trim(),
        ),
      })),
    };
  }

  async function persistShotPlanMedia(
    shotPlan: VideoShotPlan,
    allowedMediaIds = validMediaIds,
  ) {
    if (isDraftShotPlan(shotPlan)) {
      setShotsResultText(formatShotPlanResultText(shotPlan));
      return;
    }

    try {
      const saved = await apiPatch<VideoShotPlan>(
        `/projects/${projectId}/shots/${shotPlan.id}`,
        buildShotPlanSaveBody(shotPlan, allowedMediaIds),
      );
      setShotPlans((current) =>
        current.map((item) => (item.id === saved.id ? saved : item)),
      );
      setShotsResultText(formatShotPlanResultText(saved));
      setStatus({ label: t("workspace.shotMediaSaved"), tone: "success" });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t("workspace.shotMediaSaveFailed"),
      );
      setStatus({ label: t("workspace.shotMediaSaveFailed"), tone: "danger" });
    }
  }

  async function persistShotPlanToDatabase(shotPlan: VideoShotPlan) {
    const saveBody = buildShotPlanSaveBody(shotPlan);
    return isDraftShotPlan(shotPlan)
      ? await apiPost<VideoShotPlan>(`/projects/${projectId}/shots`, {
          ...saveBody,
          sourceText: shotPlan.sourceText,
        })
      : await apiPatch<VideoShotPlan>(
          `/projects/${projectId}/shots/${shotPlan.id}`,
          saveBody,
        );
  }

  function commitSavedShotPlan(saved: VideoShotPlan, previousId: string) {
    setShotPlans((current) => {
      const remaining = current.filter(
        (shotPlan) => shotPlan.id !== previousId && shotPlan.id !== saved.id,
      );
      return [saved, ...remaining];
    });
    setSelectedShotPlanId(saved.id);
    setSelectedShotIds((current) => {
      const selectedIds = current.filter((shotId) =>
        saved.shots.some((shot) => shot.id === shotId),
      );
      return selectedIds.length > 0
        ? selectedIds
        : saved.shots.map((shot) => shot.id);
    });
    setShotsResultText(formatShotPlanResultText(saved));
  }

  async function removeMedia(mediaId: string) {
    const itemToRemove = mediaItems.find(
      (candidate) => candidate.id === mediaId,
    );
    const isPersisted =
      itemToRemove?.previewUrl?.startsWith(apiBaseUrl) ?? false;

    if (isPersisted) {
      try {
        await apiDelete(`/projects/${projectId}/media/${mediaId}`);
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : t("workspace.rejectedFiles"),
        );
        return;
      }
    }

    setMediaItems((current) => {
      const item = current.find((candidate) => candidate.id === mediaId);
      if (item?.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
        previewUrlsRef.current = previewUrlsRef.current.filter(
          (url) => url !== item.previewUrl,
        );
      }
      return current.filter((candidate) => candidate.id !== mediaId);
    });
    const nextSelectedShotPlan = selectedShotPlan
      ? {
          ...selectedShotPlan,
          shots: selectedShotPlan.shots.map((shot) =>
            (shot.mediaIds ?? []).includes(mediaId)
              ? {
                  ...shot,
                  mediaIds: (shot.mediaIds ?? []).filter(
                    (id) => id !== mediaId,
                  ),
                }
              : shot,
          ),
        }
      : null;
    setShotPlans((current) =>
      current.map((shotPlan) => ({
        ...shotPlan,
        shots: shotPlan.shots.map((shot) =>
          (shot.mediaIds ?? []).includes(mediaId)
            ? {
                ...shot,
                mediaIds: (shot.mediaIds ?? []).filter((id) => id !== mediaId),
              }
            : shot,
        ),
      })),
    );
    if (nextSelectedShotPlan) {
      void persistShotPlanMedia(
        nextSelectedShotPlan,
        validMediaIds.filter((id) => id !== mediaId),
      );
    }
    setGeneratedShotPrompts({});
    setRawStoryRequest(null);
    setRawStoryResponse(null);
    setRawProductRequest(null);
    setRawProductResponse(null);
  }

  function updateSelectedShotPlan(
    updater: (shotPlan: VideoShotPlan) => VideoShotPlan,
  ) {
    if (!selectedShotPlan) {
      return;
    }
    setShotPlans((current) =>
      current.map((shotPlan) =>
        shotPlan.id === selectedShotPlan.id ? updater(shotPlan) : shotPlan,
      ),
    );
    setRawStoryRequest(null);
    setRawStoryResponse(null);
  }

  function updateShot(shotId: string, updater: (shot: VideoShot) => VideoShot) {
    updateSelectedShotPlan((shotPlan) => ({
      ...shotPlan,
      shots: shotPlan.shots.map((shot) =>
        shot.id === shotId ? updater(shot) : shot,
      ),
    }));
    setGeneratedShotPrompts((current) => {
      const { [shotId]: _removedPrompt, ...nextPrompts } = current;
      return nextPrompts;
    });
    setRawStoryRequest(null);
    setRawStoryResponse(null);
  }

  function addShot() {
    if (!selectedShotPlan) {
      return;
    }
    const nextShot = createLocalShot(selectedShotPlan.durationSeconds);
    updateSelectedShotPlan((shotPlan) => ({
      ...shotPlan,
      shots: [...shotPlan.shots, nextShot],
    }));
    setSelectedShotIds((current) => [...current, nextShot.id]);
    setRawStoryRequest(null);
    setRawStoryResponse(null);
  }

  function removeShot(shotId: string) {
    updateSelectedShotPlan((shotPlan) => ({
      ...shotPlan,
      shots: shotPlan.shots.filter((shot) => shot.id !== shotId),
    }));
    setSelectedShotIds((current) => current.filter((id) => id !== shotId));
    setOpenShotAttributePanelIds((current) => {
      const { [shotId]: _removedPanel, ...nextPanels } = current;
      return nextPanels;
    });
    setOpenAdminShotAttributePanelIds((current) => {
      const { [shotId]: _removedPanel, ...nextPanels } = current;
      return nextPanels;
    });
    setGeneratedShotPrompts((current) => {
      const { [shotId]: _removedPrompt, ...nextPrompts } = current;
      return nextPrompts;
    });
    setRawStoryRequest(null);
    setRawStoryResponse(null);
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

  function toggleShotSelection(shotId: string) {
    setSelectedShotIds((current) =>
      current.includes(shotId)
        ? current.filter((selectedId) => selectedId !== shotId)
        : [...current, shotId],
    );
    setRawStoryRequest(null);
    setRawStoryResponse(null);
  }

  async function generateShots() {
    const sourceText = promptText.trim();
    const masterPrompt = shotGenerationPrompt.trim();
    if (!sourceText) {
      setErrorMessage(t("workspace.shotsMissingSource"));
      setShotGenerationErrorMessage(t("workspace.shotsMissingSource"));
      setShotGenerationSuccessMessage("");
      return;
    }
    if (showUserMasterPrompts && !masterPrompt) {
      setErrorMessage(t("workspace.shotsMasterPromptMissing"));
      setShotGenerationErrorMessage(t("workspace.shotsMasterPromptMissing"));
      setShotGenerationSuccessMessage("");
      return;
    }

    setIsGeneratingShots(true);
    setErrorMessage("");
    setShotGenerationErrorMessage("");
    setShotGenerationSuccessMessage("");
    setRawShotRequest(null);
    setRawShotResponse(null);
    setStatus({ label: t("workspace.shotsGenerating"), tone: "info" });

    try {
      await saveProjectAttributeSelections();
      const queuedJob = await apiPost<Job>(
        `/projects/${projectId}/shots/generate`,
        {
          sourceText,
          attributes: templateSelectionToShotAttributes(templateSelection),
          scenarioAttributes: attributeSelectionToShotAttributes(
            scenarioAttributeSelection,
          ),
          shotsAttributes: attributeSelectionToShotAttributes(
            shotsAttributeSelection,
          ),
          ...(showUserMasterPrompts ? { masterPrompt } : {}),
          ...(isOneClickMode
            ? {
                name: oneClickRecordName,
                description: oneClickRecordDescription,
              }
            : {}),
        },
      );
      const completedJob = await pollJob(queuedJob.jobId);
      const result = getJobResult<GenerateShotsJobResult>(completedJob);
      const shotPlan = result.shotPlan;
      setRawShotRequest(result.rawRequest);
      setRawShotResponse(result.rawResponse);
      setShotPlans((current) => [
        shotPlan,
        ...current.filter((item) => item.id !== shotPlan.id),
      ]);
      setSelectedShotPlanId(shotPlan.id);
      setSelectedShotIds(shotPlan.shots.map((shot) => shot.id));
      setShotsResultText(formatShotPlanResultText(shotPlan));
      setShotsResultJsonError("");
      setShotGenerationSuccessMessage(
        t("workspace.shotsGeneratedDetail", {
          count: shotPlan.shots.length,
        }),
      );
      setStatus({ label: t("workspace.shotsGenerated"), tone: "success" });
    } catch (error) {
      const nextError = formatShotGenerationError(error, t);
      setErrorMessage(nextError);
      setShotGenerationErrorMessage(nextError);
      setShotGenerationSuccessMessage("");
      setStatus({ label: t("workspace.shotsGenerateFailed"), tone: "danger" });
    } finally {
      setIsGeneratingShots(false);
    }
  }

  function syncShotsResultJson(nextText: string) {
    setShotsResultText(nextText);
    if (!nextText.trim()) {
      setShotsResultJsonError(t("workspace.shotsResultInvalid"));
      return null;
    }

    try {
      const nextShotPlan = parseShotPlanResultText(nextText, selectedShotPlan, {
        projectId,
        name: projectHeaderTitle,
        description: projectHeaderDescription,
        sourceText: promptText,
      });
      setShotPlans((current) => {
        const existingIndex = current.findIndex(
          (shotPlan) => shotPlan.id === nextShotPlan.id,
        );
        if (existingIndex < 0) {
          return [nextShotPlan, ...current];
        }
        return current.map((shotPlan) =>
          shotPlan.id === nextShotPlan.id ? nextShotPlan : shotPlan,
        );
      });
      setSelectedShotPlanId(nextShotPlan.id);
      setSelectedShotIds(nextShotPlan.shots.map((shot) => shot.id));
      setOpenShotAttributePanelIds({});
      setOpenAdminShotAttributePanelIds({});
      setGeneratedShotPrompts({});
      isSyncingShotsFromJsonRef.current = true;
      setShotsResultJsonError("");
      return nextShotPlan;
    } catch (error) {
      setShotsResultJsonError(
        error instanceof Error
          ? error.message
          : t("workspace.shotsResultInvalid"),
      );
      return null;
    }
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
    if (shotsResultJsonError) {
      setErrorMessage(shotsResultJsonError);
      setStatus({ label: t("workspace.shotsResultInvalid"), tone: "danger" });
      return;
    }

    setIsSavingShots(true);
    setErrorMessage("");
    setStatus({ label: t("workspace.shotsSaving"), tone: "info" });

    try {
      const saved = await persistShotPlanToDatabase(selectedShotPlan);
      commitSavedShotPlan(saved, selectedShotPlan.id);
      setStatus({ label: t("workspace.shotsSaved"), tone: "success" });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t("workspace.shotsSaveFailed"),
      );
      setStatus({ label: t("workspace.shotsSaveFailed"), tone: "danger" });
    } finally {
      setIsSavingShots(false);
    }
  }

  async function saveProject() {
    setIsSavingProject(true);
    setErrorMessage("");
    setStoryGenerationErrorMessage("");
    setTemplateAnalysisErrorMessage("");
    setShotGenerationErrorMessage("");
    setStatus({ label: t("workspace.projectSaving"), tone: "info" });

    try {
      if (flowType === "script") {
        const storyContent = promptText.trim();
        if (storyContent) {
          const savedStory = await apiPatch<SaveProjectStoryContentResponse>(
            `/projects/${projectId}/story-content`,
            { storyContent },
          );
          if (!savedStory.saved) {
            throw new Error(t("oneClick.storySaveFailed"));
          }
        }

        if (templateSelection) {
          const savedTemplateSelection = await apiPatch<{
            saved: boolean;
            templateSelection: TemplateSelection | null;
          }>(`/projects/${projectId}/template-selection`, {
            templateSelection,
          });
          if (!savedTemplateSelection.saved) {
            throw new Error(t("workspace.templateSelectionSaveFailed"));
          }
        }
      }

      await saveProjectAttributeSelections();

      let shotPlanToSave = selectedShotPlan;
      if (shotsResultJsonError) {
        throw new Error(shotsResultJsonError);
      }
      if (shotsResultText.trim() && !shotPlanToSave) {
        shotPlanToSave = parseShotPlanResultText(
          shotsResultText,
          selectedShotPlan,
          {
            projectId,
            name: projectHeaderTitle,
            description: projectHeaderDescription,
            sourceText: promptText,
          },
        );
        setShotPlans((current) => {
          const existingIndex = current.findIndex(
            (shotPlan) => shotPlan.id === shotPlanToSave?.id,
          );
          if (existingIndex < 0 && shotPlanToSave) {
            return [shotPlanToSave, ...current];
          }
          return current.map((shotPlan) =>
            shotPlan.id === shotPlanToSave?.id && shotPlanToSave
              ? shotPlanToSave
              : shotPlan,
          );
        });
      }

      if (shotPlanToSave) {
        if (shotPlanToSave.shots.length === 0) {
          throw new Error(t("workspace.shotsNeedOne"));
        }
        const savedShotPlan = await persistShotPlanToDatabase(shotPlanToSave);
        commitSavedShotPlan(savedShotPlan, shotPlanToSave.id);
      }

      setShotsResultJsonError("");
      setStatus({ label: t("workspace.projectSaved"), tone: "success" });
    } catch (error) {
      const nextError =
        error instanceof Error
          ? error.message
          : t("workspace.projectSaveFailed");
      setErrorMessage(nextError);
      setStatus({ label: t("workspace.projectSaveFailed"), tone: "danger" });
    } finally {
      setIsSavingProject(false);
    }
  }

  async function saveStoryContent() {
    const storyContent = promptText.trim();
    if (!storyContent) {
      setErrorMessage(t("workspace.missingPrompt"));
      setStoryGenerationErrorMessage(t("workspace.missingPrompt"));
      return false;
    }

    setIsSavingStoryContent(true);
    setErrorMessage("");
    setStoryGenerationErrorMessage("");
    setStatus({ label: t("oneClick.storySaving"), tone: "info" });

    try {
      const saved = await apiPatch<SaveProjectStoryContentResponse>(
        `/projects/${projectId}/story-content`,
        { storyContent },
      );
      if (!saved.saved) {
        throw new Error(t("oneClick.storySaveFailed"));
      }
      await saveProjectAttributeSelections();
      setStatus({ label: t("oneClick.storySaved"), tone: "success" });
      return true;
    } catch (error) {
      const nextError =
        error instanceof Error ? error.message : t("oneClick.storySaveFailed");
      setErrorMessage(nextError);
      setStoryGenerationErrorMessage(nextError);
      setStatus({ label: t("oneClick.storySaveFailed"), tone: "danger" });
      return false;
    } finally {
      setIsSavingStoryContent(false);
    }
  }

  async function generatePrompt() {
    const inputText = promptText.trim();
    const masterPrompt = scriptGenerationPrompt.trim();
    if (!inputText) {
      setErrorMessage(t("workspace.missingPrompt"));
      setStoryGenerationErrorMessage(t("workspace.missingPrompt"));
      return;
    }
    if (showUserMasterPrompts && !masterPrompt) {
      setErrorMessage(t("workspace.storyMasterPromptMissing"));
      setStoryGenerationErrorMessage(t("workspace.storyMasterPromptMissing"));
      return;
    }

    setIsGenerating(true);
    setErrorMessage("");
    setStoryGenerationErrorMessage("");
    setRawStoryRequest(null);
    setRawStoryResponse(null);
    setScriptResult(null);
    setGeneratedShotPrompts({});
    setTemplateAnalysisCompact("");
    setTemplateAnalysisErrorMessage("");
    setStatus({ label: t("workspace.generatingPrompt"), tone: "info" });

    try {
      await saveProjectAttributeSelections();
      const queuedJob = await apiPost<Job>(
        `/projects/${projectId}/prompts/generate`,
        {
          inputText,
          mediaIds: requestMediaIds,
          ...(showUserMasterPrompts ? { masterPrompt } : {}),
          attributeSelections: {
            story: storyAttributeSelection,
            scenario: scenarioAttributeSelection,
            shots: shotsAttributeSelection,
          },
          ...(shotSelection ? { shotSelection } : {}),
          ...(templateSelection ? { templateSelection } : {}),
        },
      );
      const completedJob = await pollJob(queuedJob.jobId);
      const result = getJobResult<PromptResult>(completedJob);
      setRawStoryRequest(result.rawRequest ?? null);
      setRawStoryResponse(result.rawResponse ?? null);
      setPromptText(result.generatedPrompt);
      setFinalPrompt(result.generatedPrompt);
      setProductAnalysis(null);
      setStatus({
        label: t("workspace.storyGenerateSuccess"),
        tone: "success",
      });
    } catch (error) {
      const nextError = formatStoryGenerationError(error, t);
      setErrorMessage(nextError);
      setStoryGenerationErrorMessage(nextError);
      setStatus({ label: t("workspace.storyGenerateFailed"), tone: "danger" });
    } finally {
      setIsGenerating(false);
    }
  }

  async function analyzeProduct() {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(productUrl.trim());
    } catch {
      setErrorMessage(t("workspace.invalidProductUrl"));
      return;
    }

    setIsAnalyzing(true);
    setErrorMessage("");
    setRawProductRequest(null);
    setRawProductResponse(null);
    setScriptResult(null);
    setStatus({ label: t("workspace.analyzingProduct"), tone: "info" });

    try {
      const productRequestPayload = {
        productUrl: parsedUrl.toString(),
        mediaIds: validMediaIds,
        ...(templateSelection ? { templateSelection } : {}),
      };
      const queuedJob = await apiPost<Job>(
        `/projects/${projectId}/products/analyze`,
        productRequestPayload,
      );
      const completedJob = await pollJob(queuedJob.jobId);
      const result = getJobResult<ProductAnalysisResult>(completedJob);
      setRawProductRequest(result.rawRequest ?? productRequestPayload);
      setRawProductResponse(result.rawResponse ?? result);
      setProductAnalysis(result);
      setFinalPrompt(result.generatedPrompt);
      setStatus({ label: t("workspace.productSuccess"), tone: "success" });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t("workspace.analyzeFailed"),
      );
      setStatus({ label: t("workspace.analyzeFailed"), tone: "danger" });
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function analyzeTemplateSelection() {
    const inputText = promptText.trim();
    const masterPrompt = scenarioAnalysisPrompt.trim();
    if (!inputText) {
      setErrorMessage(t("workspace.missingPrompt"));
      setTemplateAnalysisErrorMessage(t("workspace.missingPrompt"));
      return;
    }
    if (showUserMasterPrompts && !masterPrompt) {
      setErrorMessage(t("workspace.templateMasterPromptMissing"));
      setTemplateAnalysisErrorMessage(
        t("workspace.templateMasterPromptMissing"),
      );
      return;
    }
    if (!selectedTemplate) {
      setErrorMessage(t("workspace.templateNone"));
      setTemplateAnalysisErrorMessage(t("workspace.templateNone"));
      return;
    }

    setIsAnalyzingTemplate(true);
    setErrorMessage("");
    setTemplateAnalysisErrorMessage("");
    setTemplateAnalysisCompact("");
    setRawTemplateRequest(null);
    setRawTemplateResponse(null);
    setGeneratedShotPrompts({});
    setStatus({ label: t("workspace.templateAnalyzing"), tone: "info" });

    try {
      await saveProjectAttributeSelections();
      const queuedJob = await apiPost<Job>(
        `/projects/${projectId}/template-selection/analyze`,
        {
          inputText,
          catalogId: selectedTemplate.id,
          ...(showUserMasterPrompts ? { masterPrompt } : {}),
        },
      );
      const completedJob = await pollJob(queuedJob.jobId);
      const result =
        getJobResult<TemplateSelectionAnalysisResult>(completedJob);
      setRawTemplateRequest(result.rawRequest);
      setRawTemplateResponse(result.rawResponse);
      setSelectedTemplateId(result.templateSelection.templateId);
      setSelectedOptionIds(
        mergeWithRequiredOptionIds(
          selectedTemplate,
          templateSelectionToOptionIds(result.templateSelection),
        ),
      );
      setTemplateAnalysisCompact(result.compactSelection);
      setTemplateAnalysisErrorMessage("");
      setStatus({
        label: t("workspace.templateAnalyzeSuccess"),
        tone: "success",
      });
    } catch (error) {
      const nextError = formatScenarioAnalysisError(error, t);
      setErrorMessage(nextError);
      setTemplateAnalysisErrorMessage(nextError);
      setStatus({
        label: t("workspace.templateAnalyzeFailed"),
        tone: "danger",
      });
    } finally {
      setIsAnalyzingTemplate(false);
    }
  }

  async function saveTemplateSelection() {
    setIsSavingTemplateSelection(true);
    setErrorMessage("");
    setTemplateAnalysisErrorMessage("");
    setGeneratedShotPrompts({});
    setStatus({ label: t("workspace.templateSelectionSaving"), tone: "info" });

    try {
      await apiPatch<{
        saved: boolean;
        templateSelection: TemplateSelection | null;
      }>(`/projects/${projectId}/template-selection`, {
        templateSelection,
      });
      await saveProjectAttributeSelections();
      setStatus({
        label: t("workspace.templateSelectionSaved"),
        tone: "success",
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t("workspace.templateSelectionSaveFailed"),
      );
      setStatus({
        label: t("workspace.templateSelectionSaveFailed"),
        tone: "danger",
      });
    } finally {
      setIsSavingTemplateSelection(false);
    }
  }

  async function createScript() {
    const finalText = (flowType === "script" ? promptText : finalPrompt).trim();
    if (!finalText) {
      setErrorMessage(t("workspace.missingFinal"));
      return;
    }

    setIsCreatingScript(true);
    setErrorMessage("");
    setStatus({ label: t("workspace.creatingScript"), tone: "info" });

    try {
      const script = await apiPost<ScriptResult>(
        `/projects/${projectId}/scripts`,
        {
          finalPrompt: finalText,
        },
      );
      setScriptResult(script);
      setStatus({ label: t("workspace.createScriptSuccess"), tone: "success" });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t("workspace.createScriptFailed"),
      );
      setStatus({ label: t("workspace.createScriptFailed"), tone: "danger" });
    } finally {
      setIsCreatingScript(false);
    }
  }

  function buildTemplateGuidancePreview() {
    if (!templateSelection || templateSelection.attributes.length === 0) {
      return t("workspace.promptPreviewNoTemplate");
    }

    const selectedGroups = templateSelection.attributes
      .filter((attribute) => attribute.options.length > 0)
      .map(
        (attribute) =>
          `${attribute.name}: ${attribute.options.map((option) => option.label).join(", ")}`,
      );

    if (selectedGroups.length === 0) {
      return t("workspace.promptPreviewNoTemplate");
    }

    return t("workspace.promptPreviewTemplate", {
      templateName: templateSelection.templateName,
      selections: selectedGroups.join("; "),
    });
  }

  function buildShotGuidancePreview() {
    if (!shotSelection || shotSelection.shots.length === 0) {
      return t("workspace.promptPreviewNoShots");
    }

    const selectedShots = shotSelection.shots
      .map(
        (shot, index) =>
          `${index + 1}. ${shot.title} (${shot.durationSeconds}s): ${shot.description}`,
      )
      .join(" ");

    return t("workspace.promptPreviewShots", {
      shotPlanName: shotSelection.shotPlanName,
      shots: selectedShots,
    });
  }

  function formatPlanAttributesForPrompt(attributes: VideoShotAttribute[]) {
    const lines = attributes
      .filter((attribute) => attribute.name.trim() && attribute.value.trim())
      .map(
        (attribute) => `${attribute.name.trim()}=${attribute.value.trim()};`,
      );
    return lines.length > 0
      ? lines.join("\n")
      : "none=No extra plan-level attributes provided;";
  }

  function buildStoryContentFullPrompt() {
    const inputText = promptText.trim();
    const masterPrompt = scriptGenerationPrompt.trim();
    if (!inputText || !masterPrompt) {
      return null;
    }

    const renderedPrompt = renderPromptTemplate(masterPrompt, {
      storyContent: inputText,
      storyAttributes: formatAttributeSelectionCompact(storyAttributeSelection),
      outputFormat: scriptGenerationOutputFormat,
    });
    return renderedPrompt;
  }

  function buildScenarioAnalysisFullPrompt() {
    const inputText = promptText.trim();
    const masterPrompt = scenarioAnalysisPrompt.trim();
    if (!inputText || !masterPrompt || !selectedTemplate) {
      return null;
    }

    const attributeCatalog = selectedTemplate.attributes.map((attribute) => ({
      attributeId: attribute.id,
      attributeName: attribute.name,
      options: attribute.options.map((option) => ({
        optionId: option.id,
        label: option.label,
        value: option.value,
      })),
    }));
    const attributeCatalogText = JSON.stringify(
      {
        templateId: selectedTemplate.id,
        templateName: selectedTemplate.name,
        attributes: attributeCatalog,
      },
      null,
      2,
    );
    const renderedPrompt = renderPromptTemplate(masterPrompt, {
      story: inputText,
      attributes: attributeCatalogText,
      scenarioAttributes: attributeCatalogText,
      outputFormat: scenarioAnalysisOutputFormat,
    });

    return renderedPrompt;
  }

  function buildOneClickScenarioReviewFullPrompt() {
    const inputText = promptText.trim();
    const masterPrompt = scenarioAnalysisPrompt.trim();
    if (!inputText || !masterPrompt) {
      return null;
    }

    const attributeContext = scenarioAttributeCatalog
      ? JSON.stringify(
          {
            catalogId: scenarioAttributeCatalog.id,
            catalogName: scenarioAttributeCatalog.name,
            attributes: scenarioAttributeCatalog.attributes,
          },
          null,
          2,
        )
      : "";
    const renderedPrompt = renderPromptTemplate(masterPrompt, {
      story: inputText,
      attributes: attributeContext,
      scenarioAttributes: attributeContext,
      outputFormat: scenarioAnalysisOutputFormat,
    });

    return renderedPrompt;
  }

  function buildShotGenerationFullPrompt() {
    const sourceText = promptText.trim();
    const masterPrompt = shotGenerationPrompt.trim();
    if (!sourceText || !masterPrompt) {
      return null;
    }

    const attributeText = formatPlanAttributesForPrompt(
      templateSelectionToShotAttributes(templateSelection),
    );
    const scenarioAttributesText = formatPlanAttributesForPrompt(
      attributeSelectionToShotAttributes(scenarioAttributeSelection),
    );
    const shotsAttributesText = formatPlanAttributesForPrompt(
      attributeSelectionToShotAttributes(shotsAttributeSelection),
    );
    const renderedPrompt = renderPromptTemplate(masterPrompt, {
      story: sourceText,
      attributes: attributeText,
      scenarioAttributes: scenarioAttributesText,
      shotsAttributes: shotsAttributesText,
      outputFormat: shotGenerationOutputFormat,
    });

    return renderedPrompt;
  }

  function buildComposedInstructionPreview() {
    const previewMediaItems =
      flowType === "script" ? requestMediaItems : validMediaItems;
    const mediaInstruction =
      previewMediaItems.length > 0
        ? [
            t("workspace.promptPreviewMedia", {
              count: previewMediaItems.length,
            }),
            formatMediaPromptSummary(previewMediaItems, ""),
          ].join("\n")
        : t("workspace.promptPreviewNoMedia");
    const shotInstruction = buildShotGuidancePreview();
    const templateInstruction = buildTemplateGuidancePreview();

    if (flowType === "script") {
      return [
        t("workspace.promptPreviewScriptBase"),
        t("workspace.promptPreviewInput", {
          input: promptText.trim() || t("workspace.promptPreviewEmptyInput"),
        }),
        mediaInstruction,
        shotInstruction,
        templateInstruction,
      ].join("\n");
    }

    return [
      t("workspace.promptPreviewProductBase"),
      t("workspace.promptPreviewProductUrl", {
        url: productUrl.trim() || t("workspace.promptPreviewEmptyProductUrl"),
      }),
      mediaInstruction,
      templateInstruction,
    ].join("\n");
  }

  function buildPromptPreviewPayload(): PromptPreviewPayload {
    const requestBody =
      flowType === "script"
        ? {
            inputText: promptText.trim(),
            mediaIds: requestMediaIds,
            attributeSelections: {
              story: storyAttributeSelection,
              scenario: scenarioAttributeSelection,
              shots: shotsAttributeSelection,
            },
            ...(shotSelection ? { shotSelection } : {}),
            ...(templateSelection ? { templateSelection } : {}),
          }
        : {
            productUrl: productUrl.trim(),
            mediaIds: validMediaIds,
            ...(templateSelection ? { templateSelection } : {}),
          };

    return {
      flowType,
      endpoint:
        flowType === "script"
          ? `/api/v1/projects/${projectId}/prompts/generate`
          : `/api/v1/projects/${projectId}/products/analyze`,
      requestBody,
      mediaReferences: (flowType === "script"
        ? requestMediaItems
        : validMediaItems
      ).map((item) => ({
        id: item.id,
        name: item.name,
        mediaType: item.kind,
        mimeType: item.mimeType,
        sizeBytes: item.sizeBytes,
      })),
      composedInstructionPreview: buildComposedInstructionPreview(),
    };
  }

  function renderPromptPreviewModal() {
    if (!isPromptPreviewOpen) {
      return null;
    }

    const previewPayload = buildPromptPreviewPayload();
    const renderedPreviewPayload = JSON.stringify(previewPayload, null, 2);

    async function copyPromptPreviewValue() {
      try {
        let copied = copyPromptWithTextarea(renderedPreviewPayload);
        if (!copied && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(renderedPreviewPayload);
          copied = true;
        }
        if (copied) {
          setIsPromptPreviewCopied(true);
        }
      } catch {
        setStatus({
          label: t("workspace.shotPromptCopyFailed"),
          tone: "danger",
        });
      }
    }

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
        role="presentation"
        onClick={() => setIsPromptPreviewOpen(false)}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="prompt-preview-title"
          className="flex max-h-[calc(100vh-3rem)] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-border bg-white shadow-xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div>
              <h3
                id="prompt-preview-title"
                className="text-base font-semibold text-foreground"
              >
                {t("workspace.promptPreviewTitle")}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("workspace.promptPreviewHelp")}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-sky-200"
                onClick={() => void copyPromptPreviewValue()}
                aria-label={
                  isPromptPreviewCopied
                    ? t("workspace.shotPromptCopied")
                    : t("workspace.shotPromptCopy")
                }
                title={
                  isPromptPreviewCopied
                    ? t("workspace.shotPromptCopied")
                    : t("workspace.shotPromptCopy")
                }
              >
                {isPromptPreviewCopied ? (
                  <CheckCircle2 size={16} />
                ) : (
                  <Copy size={16} />
                )}
              </button>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-sky-200"
                onClick={() => setIsPromptPreviewOpen(false)}
                aria-label={t("workspace.promptPreviewClose")}
              >
                <X size={16} />
              </button>
            </div>
          </div>
          <div className="grid gap-4 overflow-y-auto p-5">
            <div>
              <div className="text-xs font-semibold uppercase text-muted-foreground">
                {t("workspace.promptPreviewComposed")}
              </div>
              <div className="mt-2 whitespace-pre-wrap rounded-md border border-border bg-sky-50 p-3 text-sm leading-6 text-sky-950">
                {previewPayload.composedInstructionPreview}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase text-muted-foreground">
                {t("workspace.promptPreviewRequest")}
              </div>
              <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-md bg-slate-950 p-4 text-xs leading-5 text-slate-50">
                {renderedPreviewPayload}
              </pre>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderRawDataModal() {
    if (!rawDataModal) {
      return null;
    }

    const modalTitle = rawDataModal.title;
    const modalHelp = rawDataModal.help;
    const renderedValue = formatRawJson(rawDataModal.value);
    const modalMediaItems = rawDataModal.mediaItems ?? [];
    const hasMediaItems = modalMediaItems.length > 0;

    async function copyRawDataValue() {
      try {
        let copied = copyPromptWithTextarea(renderedValue);
        if (!copied && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(renderedValue);
          copied = true;
        }
        if (copied) {
          setIsRawDataCopied(true);
        }
      } catch {
        setStatus({
          label: t("workspace.shotPromptCopyFailed"),
          tone: "danger",
        });
      }
    }

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
        role="presentation"
        onClick={() => setRawDataModal(null)}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="raw-data-title"
          className="flex max-h-[calc(100vh-3rem)] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-border bg-white shadow-xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div>
              <h3
                id="raw-data-title"
                className="text-base font-semibold text-foreground"
              >
                {modalTitle}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">{modalHelp}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-sky-200"
                onClick={() => void copyRawDataValue()}
                aria-label={
                  isRawDataCopied
                    ? t("workspace.shotPromptCopied")
                    : t("workspace.shotPromptCopy")
                }
                title={
                  isRawDataCopied
                    ? t("workspace.shotPromptCopied")
                    : t("workspace.shotPromptCopy")
                }
              >
                {isRawDataCopied ? (
                  <CheckCircle2 size={16} />
                ) : (
                  <Copy size={16} />
                )}
              </button>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-sky-200"
                onClick={() => setRawDataModal(null)}
                aria-label={t("workspace.rawDataClose")}
              >
                <X size={16} />
              </button>
            </div>
          </div>
          <div className="overflow-y-auto p-5">
            {hasMediaItems ? (
              <div className="mb-4 grid gap-3 sm:grid-cols-2">
                {modalMediaItems.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-md border border-sky-100 bg-sky-50 p-3"
                  >
                    <div className="mb-2 overflow-hidden rounded-md border border-sky-100 bg-white">
                      {item.kind === "image" && item.previewUrl ? (
                        <img
                          alt={item.name}
                          src={item.previewUrl}
                          className="h-32 w-full object-cover"
                        />
                      ) : item.kind === "video" && item.previewUrl ? (
                        <video
                          className="h-32 w-full bg-black object-contain"
                          src={item.previewUrl}
                          controls
                          muted
                        />
                      ) : (
                        <div className="flex h-32 items-center justify-center text-muted-foreground">
                          <AlertCircle size={24} />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">
                        {item.name}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {item.id} | {item.mimeType} |{" "}
                        {formatBytes(item.sizeBytes)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap break-words rounded-md bg-slate-950 p-4 text-xs leading-5 text-slate-50">
              {renderedValue}
            </pre>
          </div>
        </div>
      </div>
    );
  }

  function renderMediaUpload(shot?: VideoShot) {
    const targetMediaItems = shot ? getShotMediaItems(shot) : mediaItems;
    const mediaInputId = shot
      ? `shot-media-upload-${shot.id}`
      : "project-media-upload";
    const uploadTargetShotId = shot?.id;

    return (
      <div
        className="mt-4 rounded-lg border border-dashed border-sky-200 bg-sky-50 p-4"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => onDrop(event, uploadTargetShotId)}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 font-medium text-sky-800">
              <Upload size={18} />
              {shot ? t("workspace.shotMediaTitle") : t("workspace.mediaTitle")}
            </div>
            <p className="mt-1 text-sm text-sky-700">
              {shot ? t("workspace.shotMediaHelp") : t("workspace.mediaHelp")}
            </p>
            <p className="mt-1 text-xs text-sky-700">
              {t("workspace.mediaTypes")}
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => document.getElementById(mediaInputId)?.click()}
          >
            {t("workspace.chooseFile")}
          </Button>
          <input
            id={mediaInputId}
            className="sr-only"
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.webp,.mp4,.mov,.webm,image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
            onChange={(event) => onFileChange(event, uploadTargetShotId)}
          />
        </div>

        {targetMediaItems.length === 0 ? (
          <div className="mt-4 rounded-md border border-sky-100 bg-white p-4 text-sm text-muted-foreground">
            {shot
              ? t("workspace.shotMediaEmpty")
              : t("workspace.dropzoneEmpty")}
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {targetMediaItems.map((item) => (
              <div
                key={item.id}
                className="rounded-md border border-border bg-white p-3"
              >
                <div className="mb-3 overflow-hidden rounded-md border border-border bg-muted">
                  {item.kind === "image" && item.previewUrl ? (
                    <img
                      alt={item.name}
                      src={item.previewUrl}
                      className="h-32 w-full object-cover"
                    />
                  ) : item.kind === "video" && item.previewUrl ? (
                    <video
                      className="h-32 w-full bg-black object-contain"
                      src={item.previewUrl}
                      controls
                      muted
                    />
                  ) : (
                    <div className="flex h-32 items-center justify-center text-muted-foreground">
                      <AlertCircle size={24} />
                    </div>
                  )}
                </div>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {item.kind === "video" ? (
                        <FileVideo
                          size={16}
                          className="shrink-0 text-sky-600"
                        />
                      ) : (
                        <ImageIcon
                          size={16}
                          className="shrink-0 text-sky-600"
                        />
                      )}
                      <div className="truncate text-sm font-medium">
                        {item.name}
                      </div>
                    </div>
                    <div className="mt-2">
                      <Badge variant={statusVariant(item)}>
                        {statusText(item, t)}
                      </Badge>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-sky-200"
                    onClick={() => void removeMedia(item.id)}
                    aria-label={t("workspace.removeMedia", { name: item.name })}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  function renderScriptStatus() {
    if (flowType !== "script" || (!errorMessage && status.tone === "neutral")) {
      return null;
    }

    return (
      <div className="mt-4 rounded-md border border-border bg-white p-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={status.tone}>{status.label}</Badge>
          {errorMessage ? (
            <span className="whitespace-pre-wrap text-red-700">
              {errorMessage}
            </span>
          ) : null}
        </div>
      </div>
    );
  }

  function renderRawDataButton(
    label: string,
    title: string,
    help: string,
    value: unknown,
  ) {
    const hasValue = value !== null && value !== undefined;

    return (
      <Button
        type="button"
        variant="secondary"
        className="h-10 gap-2 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!hasValue}
        title={hasValue ? title : t("workspace.rawDataUnavailable")}
        onClick={() => {
          if (hasValue) {
            setRawDataModal({ title, help, value });
          }
        }}
      >
        <Eye size={15} />
        {label}
      </Button>
    );
  }

  function renderFullPromptButton(
    title: string,
    help: string,
    value: string | null,
    mediaItems?: MediaItem[],
  ) {
    const hasValue = Boolean(value);

    return (
      <Button
        type="button"
        variant="secondary"
        className="h-10 gap-2 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!hasValue}
        title={hasValue ? title : t("workspace.fullPromptUnavailable")}
        onClick={() => {
          if (value) {
            setRawDataModal({
              title,
              help,
              value,
              ...(mediaItems ? { mediaItems } : {}),
            });
          }
        }}
      >
        <FileText size={15} />
        {t("workspace.fullPromptButton")}
      </Button>
    );
  }

  function renderAttributeCatalogSelection({
    catalog,
    selectedIds,
    setSelectedIds,
    title,
    help,
    helperPrefix,
    panelOpen,
    onPanelToggle,
  }: {
    catalog: AttributeCatalog | null;
    selectedIds: Record<string, string[]>;
    setSelectedIds: (
      updater: (current: Record<string, string[]>) => Record<string, string[]>,
    ) => void;
    title: string;
    help: string;
    helperPrefix: string;
    panelOpen?: boolean;
    onPanelToggle?: () => void;
  }) {
    const isPanelMode = typeof onPanelToggle === "function";
    const isPanelOpen = panelOpen ?? true;
    const selectedCount =
      catalog?.attributes.reduce(
        (total, attribute) => total + (selectedIds[attribute.id] ?? []).length,
        0,
      ) ?? 0;

    if (!catalog) {
      const unavailable = (
        <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
          No active {title.toLowerCase()} catalog is configured in Admin.
        </div>
      );

      if (isPanelMode) {
        return (
          <div className="rounded-md border border-border bg-white">
            <button
              type="button"
              className="flex w-full items-start justify-between gap-3 p-3 text-left focus:outline-none focus:ring-2 focus:ring-sky-200"
              onClick={onPanelToggle}
              aria-expanded={isPanelOpen}
            >
              <span className="min-w-0">
                <span className="flex min-w-0 items-center gap-2 font-medium">
                  {isPanelOpen ? (
                    <ChevronDown size={18} className="text-muted-foreground" />
                  ) : (
                    <ChevronRight size={18} className="text-muted-foreground" />
                  )}
                  <span className="truncate">{title}</span>
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {selectedCount} selected
                </span>
              </span>
              <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                0
              </span>
            </button>
            {isPanelOpen ? (
              <div className="border-t border-border p-3">{unavailable}</div>
            ) : null}
          </div>
        );
      }

      return unavailable;
    }

    function toggleCatalogOption(attributeId: string, optionId: string) {
      setSelectedIds((current) => {
        const attribute = catalog?.attributes.find(
          (item) => item.id === attributeId,
        );
        const currentIds = current[attributeId] ?? [];
        const nextIds = currentIds.includes(optionId)
          ? currentIds.filter((selectedId) => selectedId !== optionId)
          : [...currentIds, optionId];

        if (
          attribute?.required &&
          nextIds.length === 0 &&
          attribute.options[0]
        ) {
          return {
            ...current,
            [attributeId]: [attribute.options[0].id],
          };
        }

        return {
          ...current,
          [attributeId]: nextIds,
        };
      });
      setGeneratedShotPrompts({});
      setRawStoryRequest(null);
      setRawStoryResponse(null);
      setRawTemplateRequest(null);
      setRawTemplateResponse(null);
      setRawShotRequest(null);
      setRawShotResponse(null);
      setShotGenerationErrorMessage("");
      setShotGenerationSuccessMessage("");
      setTemplateAnalysisCompact("");
      setTemplateAnalysisErrorMessage("");
      setRawDataModal(null);
    }

    const attributeList = (
      <div className="grid gap-3">
        {catalog.attributes.map((attribute, attributeIndex) => {
          const attributeSelectedIds = selectedIds[attribute.id] ?? [];
          const collapseKey = `${helperPrefix}:${attribute.id}`;
          const isAttributeCollapsed =
            collapsedCatalogAttributeIds[collapseKey] ?? true;
          return (
            <div
              key={attribute.id}
              className="rounded-md border border-border p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-start gap-2 text-left focus:outline-none focus:ring-2 focus:ring-sky-200"
                  onClick={() =>
                    setCollapsedCatalogAttributeIds((current) => ({
                      ...current,
                      [collapseKey]: !isAttributeCollapsed,
                    }))
                  }
                  aria-expanded={!isAttributeCollapsed}
                >
                  {isAttributeCollapsed ? (
                    <ChevronRight
                      size={16}
                      className="mt-1 shrink-0 text-muted-foreground"
                    />
                  ) : (
                    <ChevronDown
                      size={16}
                      className="mt-1 shrink-0 text-muted-foreground"
                    />
                  )}
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm text-sky-800">
                    {attributeIndex + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-medium">
                        {attribute.name}
                      </span>
                      {attribute.required ? (
                        <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                          Required
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {attributeSelectedIds.length} selected
                    </span>
                  </span>
                </button>
                <ScenarioTextHelper
                  description={attribute.description}
                  descriptionLabel={t("workspace.scenarioHelperDescription")}
                  helperId={`${helperPrefix}:attribute:${attribute.id}`}
                  label={t("workspace.scenarioHelperOpen")}
                  onToggle={setOpenScenarioHelperId}
                  openHelperId={openScenarioHelperId}
                  translateLabel={t("workspace.scenarioHelperTranslate")}
                />
              </div>
              {!isAttributeCollapsed ? (
                <>
                  {attribute.description ? (
                    <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">
                      {attribute.description}
                    </p>
                  ) : null}
                  <div className="mt-3 grid gap-2">
                    {attribute.options.map((option, optionIndex) => {
                      const checked = attributeSelectedIds.includes(option.id);
                      const optionInputId = `${helperPrefix}-${attribute.id}-${option.id}`;
                      return (
                        <div
                          key={option.id}
                          className={`grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-md border px-3 py-2 text-sm transition ${
                            checked
                              ? "border-sky-300 bg-sky-50 text-sky-800"
                              : "border-border bg-white text-foreground hover:bg-muted"
                          }`}
                        >
                          <input
                            id={optionInputId}
                            type="checkbox"
                            className="h-4 w-4 rounded border-border"
                            checked={checked}
                            onChange={() =>
                              toggleCatalogOption(attribute.id, option.id)
                            }
                          />
                          <label
                            htmlFor={optionInputId}
                            className="flex min-w-0 cursor-pointer items-center gap-2"
                          >
                            <span className="shrink-0 rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                              {attributeIndex + 1}.{optionIndex + 1}
                            </span>
                            <span className="truncate">{option.name}</span>
                          </label>
                          <ScenarioTextHelper
                            description={option.description}
                            descriptionLabel={t(
                              "workspace.scenarioHelperDescription",
                            )}
                            helperId={`${helperPrefix}:option:${attribute.id}:${option.id}`}
                            label={t("workspace.scenarioHelperOpen")}
                            onToggle={setOpenScenarioHelperId}
                            openHelperId={openScenarioHelperId}
                            translateLabel={t(
                              "workspace.scenarioHelperTranslate",
                            )}
                          />
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : null}
            </div>
          );
        })}
      </div>
    );

    if (isPanelMode) {
      return (
        <div className="rounded-md border border-border bg-white">
          <button
            type="button"
            className="flex w-full items-start justify-between gap-3 p-3 text-left focus:outline-none focus:ring-2 focus:ring-sky-200"
            onClick={onPanelToggle}
            aria-expanded={isPanelOpen}
          >
            <span className="min-w-0">
              <span className="flex min-w-0 items-center gap-2 font-medium">
                {isPanelOpen ? (
                  <ChevronDown size={18} className="text-muted-foreground" />
                ) : (
                  <ChevronRight size={18} className="text-muted-foreground" />
                )}
                <span className="truncate">{title}</span>
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {selectedCount} selected
              </span>
            </span>
            <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
              {catalog.attributes.length}
            </span>
          </button>
          {isPanelOpen ? (
            <div className="border-t border-border p-3">
              <p className="mb-3 text-xs leading-5 text-muted-foreground">
                {help}
              </p>
              {attributeList}
            </div>
          ) : null}
        </div>
      );
    }

    return (
      <div className="rounded-md border border-border bg-white p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-foreground">{title}</div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {help}
            </p>
          </div>
          <Badge variant="info">{selectedCount} selected</Badge>
        </div>
        <div className="mt-3">{attributeList}</div>
      </div>
    );
  }

  function renderStoryContentStep() {
    if (flowType !== "script") {
      return null;
    }

    return (
      <div className="mt-4 rounded-lg border border-border bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <button
            type="button"
            className="min-w-0 flex-1 text-left focus:outline-none focus:ring-2 focus:ring-sky-200"
            onClick={() => setIsStoryStepOpen((current) => !current)}
            aria-expanded={isStoryStepOpen}
          >
            <div className="flex items-center gap-2 font-medium">
              {isStoryStepOpen ? (
                <ChevronDown size={18} className="text-muted-foreground" />
              ) : (
                <ChevronRight size={18} className="text-muted-foreground" />
              )}
              <Sparkles size={18} className="text-sky-600" />
              {t("workspace.storyStepTitle")}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("workspace.storyStepHelp")}
            </p>
          </button>
        </div>

        {isStoryStepOpen ? (
          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="min-w-0 space-y-4">
              {showUserMasterPrompts ? (
                <MasterPromptField
                  id="storyMasterPrompt"
                  label={t("workspace.storyMasterPromptLabel")}
                  help={t("workspace.storyMasterPromptHelp")}
                  rows={7}
                  value={scriptGenerationPrompt}
                  onChange={(event) => {
                    setScriptGenerationPrompt(event.target.value);
                    setStoryGenerationErrorMessage("");
                    setRawStoryRequest(null);
                    setRawStoryResponse(null);
                    setRawDataModal(null);
                  }}
                  placeholderSuggestions={MASTER_PROMPT_PLACEHOLDERS.scripts}
                />
              ) : null}

              <div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <label
                      className="text-sm font-medium"
                      htmlFor="scenarioStory"
                    >
                      {t("workspace.storyInputLabel")}
                    </label>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("workspace.storyInputHelp")}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-8 w-8 shrink-0 px-0 text-sky-700 hover:text-sky-800"
                    aria-label={t("workspace.promptPreviewOpen")}
                    title={t("workspace.promptPreviewOpen")}
                    onClick={() => setIsPromptPreviewOpen(true)}
                  >
                    <Eye size={16} />
                  </Button>
                </div>
                <TextareaWithCounter
                  id="scenarioStory"
                  rows={8}
                  value={promptText}
                  onChange={(event) => {
                    hasUserEditedStoryContentRef.current = true;
                    setPromptText(event.target.value);
                    setGeneratedShotPrompts({});
                    setStoryGenerationErrorMessage("");
                    setRawStoryRequest(null);
                    setRawStoryResponse(null);
                    setRawTemplateRequest(null);
                    setRawTemplateResponse(null);
                    setRawShotRequest(null);
                    setRawShotResponse(null);
                    setShotGenerationErrorMessage("");
                    setShotGenerationSuccessMessage("");
                    setTemplateAnalysisCompact("");
                    setTemplateAnalysisErrorMessage("");
                    setRawDataModal(null);
                  }}
                  className="mt-2 w-full rounded-md border border-border p-3 text-sm outline-none focus:ring-2 focus:ring-sky-200"
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  className="gap-2 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isGenerating}
                  onClick={() => void generatePrompt()}
                >
                  {isGenerating ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Sparkles size={16} />
                  )}
                  {isGenerating
                    ? t("workspace.storyGenerating")
                    : t("workspace.storyGenerate")}
                </Button>
                {renderFullPromptButton(
                  t("workspace.storyFullPrompt"),
                  t("workspace.storyFullPromptHelp"),
                  buildStoryContentFullPrompt(),
                  requestMediaItems,
                )}
                {renderRawDataButton(
                  t("workspace.rawRequestButton"),
                  t("workspace.storyRawRequest"),
                  t("workspace.storyRawRequestHelp"),
                  rawStoryRequest,
                )}
                {renderRawDataButton(
                  t("workspace.rawResponseButton"),
                  t("workspace.storyRawResponse"),
                  t("workspace.storyRawResponseHelp"),
                  rawStoryResponse,
                )}
              </div>

              {storyGenerationErrorMessage ? (
                <div className="flex items-start gap-2 rounded-md border border-red-100 bg-red-50 p-3 text-sm leading-6 text-red-700">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span className="whitespace-pre-wrap">
                    {storyGenerationErrorMessage}
                  </span>
                </div>
              ) : null}
            </div>

            <aside className="min-w-0">
              {renderAttributeCatalogSelection({
                catalog: storyAttributeCatalog,
                selectedIds: storyOptionIds,
                setSelectedIds: setStoryOptionIds,
                title: "Story Attributes",
                help: "Admin-managed Story attributes. Required attributes keep at least one selected option.",
                helperPrefix: "story",
                panelOpen: isStoryAttributesOpen,
                onPanelToggle: () =>
                  setIsStoryAttributesOpen((current) => !current),
              })}
            </aside>
          </div>
        ) : null}
      </div>
    );
  }

  function updateOneClickScenarioAttributes(
    updater: (attributes: ScenarioAttribute[]) => ScenarioAttribute[],
  ) {
    if (!selectedTemplate) {
      return;
    }

    setOneClickScenarioEditorMessage("");
    setOneClickScenarioEditorError("");
    setIsEditingOneClickScenarioSchema(false);
    setTemplates((current) =>
      current.map((template) =>
        template.id === selectedTemplate.id
          ? { ...template, attributes: updater(template.attributes) }
          : template,
      ),
    );
  }

  function updateOneClickScenarioAttribute(
    attributeId: string,
    patch: Partial<ScenarioAttribute>,
  ) {
    updateOneClickScenarioAttributes((attributes) =>
      attributes.map((attribute) =>
        attribute.id === attributeId ? { ...attribute, ...patch } : attribute,
      ),
    );
  }

  function updateOneClickScenarioOption(
    attributeId: string,
    optionId: string,
    label: string,
  ) {
    updateOneClickScenarioAttributes((attributes) =>
      attributes.map((attribute) =>
        attribute.id === attributeId
          ? {
              ...attribute,
              options: attribute.options.map((option) =>
                option.id === optionId
                  ? { ...option, label, value: label }
                  : option,
              ),
            }
          : attribute,
      ),
    );
  }

  function addOneClickScenarioAttribute() {
    updateOneClickScenarioAttributes((attributes) => [
      ...attributes,
      {
        id: makeScenarioEditorId("attribute"),
        name: "",
        description: "",
        options: [optionFromScenarioLabel("")],
      },
    ]);
  }

  function removeOneClickScenarioAttribute(attributeId: string) {
    updateOneClickScenarioAttributes((attributes) =>
      attributes.filter((attribute) => attribute.id !== attributeId),
    );
  }

  function addOneClickScenarioOption(attributeId: string) {
    updateOneClickScenarioAttributes((attributes) =>
      attributes.map((attribute) =>
        attribute.id === attributeId
          ? {
              ...attribute,
              options: [...attribute.options, optionFromScenarioLabel("")],
            }
          : attribute,
      ),
    );
  }

  function removeOneClickScenarioOption(attributeId: string, optionId: string) {
    updateOneClickScenarioAttributes((attributes) =>
      attributes.map((attribute) =>
        attribute.id === attributeId
          ? {
              ...attribute,
              options: attribute.options.filter(
                (option) => option.id !== optionId,
              ),
            }
          : attribute,
      ),
    );
  }

  function applyOneClickScenarioSchema() {
    if (!selectedTemplate) {
      return;
    }

    try {
      const parsedAttributes = parseScenarioAttributesText(
        oneClickScenarioAttributesText,
      );
      setTemplates((current) =>
        current.map((template) =>
          template.id === selectedTemplate.id
            ? { ...template, attributes: parsedAttributes }
            : template,
        ),
      );
      setOneClickScenarioAttributesText(
        formatScenarioAttributesText(parsedAttributes),
      );
      setOneClickScenarioEditorMessage(t("template.jsonApplied"));
      setOneClickScenarioEditorError("");
      setIsEditingOneClickScenarioSchema(false);
    } catch {
      setOneClickScenarioEditorMessage("");
      setOneClickScenarioEditorError(t("template.jsonInvalid"));
    }
  }

  async function saveOneClickScenario() {
    if (!selectedTemplate) {
      return;
    }

    let attributesToSave: ScenarioAttribute[];
    try {
      attributesToSave = isEditingOneClickScenarioSchema
        ? parseScenarioAttributesText(oneClickScenarioAttributesText)
        : selectedTemplate.attributes;
    } catch {
      attributesToSave = selectedTemplate.attributes;
    }

    const normalizedAttributes = attributesToSave
      .map((attribute) => ({
        ...attribute,
        name: attribute.name.trim(),
        description: attribute.description?.trim() || undefined,
        options: attribute.options
          .map((option) => ({
            ...option,
            label: option.label.trim(),
            value: option.value.trim() || option.label.trim(),
            description: option.description?.trim() || undefined,
          }))
          .filter((option) => option.label),
      }))
      .filter((attribute) => attribute.name && attribute.options.length > 0);

    if (!oneClickScenarioName.trim() || normalizedAttributes.length === 0) {
      setOneClickScenarioEditorMessage("");
      setOneClickScenarioEditorError(t("template.jsonInvalid"));
      return;
    }

    setIsSavingOneClickScenario(true);
    setOneClickScenarioEditorMessage("");
    setOneClickScenarioEditorError("");

    try {
      const savedScenario = await apiPatch<VideoTemplate>(
        `/templates/${selectedTemplate.id}`,
        {
          name: oneClickScenarioName.trim(),
          description: oneClickScenarioDescription.trim() || undefined,
          idea: promptText.trim() || selectedTemplate.idea,
          attributes: normalizedAttributes,
        },
      );
      setTemplates((current) =>
        current.map((template) =>
          template.id === savedScenario.id ? savedScenario : template,
        ),
      );
      setSelectedOptionIds((current) => {
        const validOptionIds = new Set(
          savedScenario.attributes.flatMap((attribute) =>
            attribute.options.map((option) => option.id),
          ),
        );
        const nextSelectedOptionIds: Record<string, string[]> = {};
        for (const [attributeId, optionIds] of Object.entries(current)) {
          const filteredOptionIds = optionIds.filter((optionId) =>
            validOptionIds.has(optionId),
          );
          if (filteredOptionIds.length > 0) {
            nextSelectedOptionIds[attributeId] = filteredOptionIds;
          }
        }
        return nextSelectedOptionIds;
      });
      setOneClickScenarioAttributesText(
        formatScenarioAttributesText(savedScenario.attributes),
      );
      setOneClickScenarioEditorMessage(t("template.saved"));
      setIsEditingOneClickScenarioSchema(false);
    } catch (error) {
      setOneClickScenarioEditorError(
        error instanceof Error ? error.message : t("template.empty"),
      );
    } finally {
      setIsSavingOneClickScenario(false);
    }
  }

  function renderOneClickScenarioEditor() {
    if (!selectedTemplate) {
      return null;
    }

    return (
      <div className="rounded-md border border-border bg-white p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">
              {t("template.editTitle")}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("template.editorDescription")}
            </p>
          </div>
          {oneClickScenarioEditorMessage ? (
            <Badge variant="success">{oneClickScenarioEditorMessage}</Badge>
          ) : null}
        </div>

        {oneClickScenarioEditorError ? (
          <div className="mt-3 whitespace-pre-line rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-700">
            {oneClickScenarioEditorError}
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-sm font-medium">
            {t("template.name")}
            <input
              value={oneClickScenarioName}
              onChange={(event) => {
                setOneClickScenarioName(event.target.value);
                setOneClickScenarioEditorMessage("");
                setOneClickScenarioEditorError("");
              }}
              className="mt-2 h-10 w-full rounded-md border border-border px-3 text-sm outline-none focus:ring-2 focus:ring-sky-200"
            />
          </label>
          <label className="text-sm font-medium">
            {t("template.descriptionField")}
            <input
              value={oneClickScenarioDescription}
              onChange={(event) => {
                setOneClickScenarioDescription(event.target.value);
                setOneClickScenarioEditorMessage("");
                setOneClickScenarioEditorError("");
              }}
              className="mt-2 h-10 w-full rounded-md border border-border px-3 text-sm outline-none focus:ring-2 focus:ring-sky-200"
            />
          </label>
        </div>

        <div className="mt-5 grid gap-3">
          <div className="rounded-md border border-border bg-muted/40 p-3">
            <label
              className="text-sm font-medium"
              htmlFor="oneClickScenarioAttributesSchema"
            >
              {t("template.jsonEditor")}
            </label>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("template.jsonHelp")}
            </p>
            <TextareaWithCounter
              id="oneClickScenarioAttributesSchema"
              value={oneClickScenarioAttributesText}
              onChange={(event) => {
                setOneClickScenarioAttributesText(event.target.value);
                setIsEditingOneClickScenarioSchema(true);
                setOneClickScenarioEditorMessage("");
                setOneClickScenarioEditorError("");
              }}
              spellCheck={false}
              className="mt-3 min-h-52 w-full resize-y rounded-md border border-border bg-white p-3 font-mono text-xs leading-5 outline-none focus:ring-2 focus:ring-sky-200"
            />
            <Button
              type="button"
              variant="secondary"
              className="mt-3 gap-2"
              onClick={applyOneClickScenarioSchema}
            >
              <Sparkles size={15} />
              {t("template.jsonApply")}
            </Button>
          </div>

          {selectedTemplate.attributes.map((attribute, attributeIndex) => (
            <div
              key={attribute.id}
              className="rounded-md border border-border p-3"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-semibold text-sky-800">
                  {attributeIndex + 1}
                </span>
                <input
                  value={attribute.name}
                  onChange={(event) =>
                    updateOneClickScenarioAttribute(attribute.id, {
                      name: event.target.value,
                    })
                  }
                  placeholder={t("template.attributeName")}
                  className="h-10 min-w-0 flex-1 rounded-md border border-border px-3 text-sm outline-none focus:ring-2 focus:ring-sky-200"
                />
                <Button
                  type="button"
                  variant="ghost"
                  className="h-10 w-10 px-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => removeOneClickScenarioAttribute(attribute.id)}
                  aria-label={t("template.delete")}
                >
                  <Trash2 size={15} />
                </Button>
              </div>
              {attribute.description ? (
                <p className="mt-2 whitespace-pre-wrap rounded-md border border-sky-100 bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-900">
                  {attribute.description}
                </p>
              ) : null}

              <div className="mt-3 grid gap-2">
                {attribute.options.map((option, optionIndex) => (
                  <div
                    key={option.id}
                    className="grid grid-cols-[auto_1fr_auto] items-start gap-2"
                  >
                    <span className="mt-1 rounded bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                      {attributeIndex + 1}.{optionIndex + 1}
                    </span>
                    <div className="min-w-0">
                      <input
                        value={option.label}
                        onChange={(event) =>
                          updateOneClickScenarioOption(
                            attribute.id,
                            option.id,
                            event.target.value,
                          )
                        }
                        placeholder={t("template.optionLabel")}
                        className="h-10 min-w-0 w-full rounded-md border border-border px-3 text-sm outline-none focus:ring-2 focus:ring-sky-200"
                      />
                      {option.description ? (
                        <p className="mt-1 whitespace-pre-wrap rounded-md bg-muted/60 px-3 py-2 text-xs leading-5 text-muted-foreground">
                          {option.description}
                        </p>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-10 w-10 px-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() =>
                        removeOneClickScenarioOption(attribute.id, option.id)
                      }
                      aria-label={t("template.delete")}
                    >
                      <Trash2 size={15} />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="secondary"
                  className="w-fit gap-2"
                  onClick={() => addOneClickScenarioOption(attribute.id)}
                >
                  <Plus size={15} />
                  {t("template.addOption")}
                </Button>
              </div>
            </div>
          ))}

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="secondary"
              className="gap-2"
              onClick={addOneClickScenarioAttribute}
            >
              <Plus size={15} />
              {t("template.addAttribute")}
            </Button>
            <Button
              type="button"
              className="gap-2"
              disabled={isSavingOneClickScenario}
              onClick={() => void saveOneClickScenario()}
            >
              {isSavingOneClickScenario ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              {t("template.save")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  function renderOneClickScenarioStep() {
    return (
      <div className="mt-4 rounded-lg border border-border bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 font-medium">
              <FileText size={18} className="text-sky-600" />
              {t("oneClick.step2Title")}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("oneClick.step2Help")}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-4">
          {showUserMasterPrompts ? (
            <MasterPromptField
              id="oneClickScenarioMasterPrompt"
              label={t("oneClick.step2PromptLabel")}
              help={t("oneClick.step2PromptHelp")}
              rows={7}
              value={scenarioAnalysisPrompt}
              onChange={(event) => {
                setScenarioAnalysisPrompt(event.target.value);
                setTemplateAnalysisCompact("");
                setTemplateAnalysisErrorMessage("");
                setRawTemplateRequest(null);
                setRawTemplateResponse(null);
                setRawDataModal(null);
              }}
              placeholderSuggestions={MASTER_PROMPT_PLACEHOLDERS.scenario}
            />
          ) : null}

          <div>
            <label
              className="text-sm font-medium"
              htmlFor="oneClickStoryReview"
            >
              {t("workspace.storyInputLabel")}
            </label>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("oneClick.step2StoryHelp")}
            </p>
            <TextareaWithCounter
              id="oneClickStoryReview"
              rows={8}
              value={promptText}
              onChange={(event) => {
                hasUserEditedStoryContentRef.current = true;
                setPromptText(event.target.value);
                setGeneratedShotPrompts({});
                setTemplateAnalysisCompact("");
                setTemplateAnalysisErrorMessage("");
                setRawTemplateRequest(null);
                setRawTemplateResponse(null);
                setRawShotRequest(null);
                setRawShotResponse(null);
                setShotGenerationErrorMessage("");
                setShotGenerationSuccessMessage("");
                setRawDataModal(null);
              }}
              className="mt-2 w-full rounded-md border border-border p-3 text-sm outline-none focus:ring-2 focus:ring-sky-200"
            />
          </div>

          {selectedTemplate ? (
            <div className="rounded-md border border-sky-100 bg-sky-50 p-3 text-sm text-sky-900">
              {t("oneClick.step2DefaultScenario", {
                name: selectedTemplate.name,
              })}
            </div>
          ) : (
            <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
              {t("workspace.templateNone")}
            </div>
          )}

          {renderAttributeCatalogSelection({
            catalog: scenarioAttributeCatalog,
            selectedIds: selectedOptionIds,
            setSelectedIds: setSelectedOptionIds,
            title: "Scenario Attributes",
            help: "Admin-managed Scenario attributes. AI can analyze Story Content and select matching options, and required attributes cannot be empty.",
            helperPrefix: "scenario-one-click",
          })}

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              className="gap-2 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isAnalyzingTemplate || !selectedTemplate}
              onClick={() => void analyzeTemplateSelection()}
            >
              {isAnalyzingTemplate ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Sparkles size={16} />
              )}
              {isAnalyzingTemplate
                ? t("workspace.templateAnalyzing")
                : t("workspace.templateAnalyze")}
            </Button>
            {renderFullPromptButton(
              t("oneClick.step2FullPrompt"),
              t("oneClick.step2FullPromptHelp"),
              selectedTemplate
                ? buildScenarioAnalysisFullPrompt()
                : buildOneClickScenarioReviewFullPrompt(),
            )}
            {renderRawDataButton(
              t("workspace.rawRequestButton"),
              t("workspace.scenarioRawRequest"),
              t("workspace.scenarioRawRequestHelp"),
              rawTemplateRequest,
            )}
            {renderRawDataButton(
              t("workspace.rawResponseButton"),
              t("workspace.scenarioRawResponse"),
              t("workspace.scenarioRawResponseHelp"),
              rawTemplateResponse,
            )}
          </div>

          {templateAnalysisErrorMessage ? (
            <div className="flex items-start gap-2 rounded-md border border-red-100 bg-red-50 p-3 text-sm leading-6 text-red-700">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span className="whitespace-pre-wrap">
                {templateAnalysisErrorMessage}
              </span>
            </div>
          ) : null}

          {templateAnalysisCompact ? (
            <div className="rounded-md border border-sky-100 bg-sky-50 p-3 font-mono text-xs leading-5 text-sky-950">
              <div className="mb-1 font-sans text-sm font-medium text-sky-900">
                {t("workspace.templateAnalysisResult")}
              </div>
              <pre className="whitespace-pre-wrap break-words">
                {templateAnalysisCompact}
              </pre>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  function toggleTemplateOption(attributeId: string, optionId: string) {
    setSelectedOptionIds((current) => {
      const attribute = selectedTemplate?.attributes.find(
        (item) => item.id === attributeId,
      );
      const selectedIds = current[attributeId] ?? [];
      const nextIds = selectedIds.includes(optionId)
        ? selectedIds.filter((selectedId) => selectedId !== optionId)
        : [...selectedIds, optionId];
      if (attribute?.required && nextIds.length === 0 && attribute.options[0]) {
        return {
          ...current,
          [attributeId]: [attribute.options[0].id],
        };
      }
      return {
        ...current,
        [attributeId]: nextIds,
      };
    });
    setGeneratedShotPrompts({});
    setTemplateAnalysisCompact("");
    setRawTemplateRequest(null);
    setRawTemplateResponse(null);
    setRawStoryRequest(null);
    setRawStoryResponse(null);
    setRawShotRequest(null);
    setRawShotResponse(null);
    setShotGenerationErrorMessage("");
    setShotGenerationSuccessMessage("");
    setRawProductRequest(null);
    setRawProductResponse(null);
    setRawDataModal(null);
  }

  function composeShotPrompt(shot: VideoShot) {
    const masterPrompt = shotPromptTemplate.trim();
    if (!masterPrompt) {
      throw new Error(t("workspace.shotMasterPromptMissing"));
    }
    if (masterPrompt.includes("{masterPromptAttributes}")) {
      throw new Error(t("workspace.masterPromptAttributesUserBlocked"));
    }
    if (masterPrompt.includes("{shotAttributes}") && !shotAttributeCatalog) {
      throw new Error(t("workspace.shotAttributeCatalogMissing"));
    }

    const sourceText = promptText.trim();
    const shotMediaItems = getValidShotMediaItems(shot);
    const shotDialogue = getShotDialogue(shot).trim();
    const generatedAttributes = shot.attributes.filter(
      (attribute) =>
        attribute.name.trim() &&
        attribute.value.trim() &&
        !isDialogueAttribute(attribute),
    );

    const generatedAttributeText =
      generatedAttributes.length > 0
        ? generatedAttributes
            .map((attribute) =>
              formatPromptAttributeLine(attribute.name, attribute.value),
            )
            .join("\n")
        : "";
    const shotAttributeText = formatAttributeSelectionCompact(
      buildShotAttributeSelectionForShot(shot),
    );
    const mediaSummary =
      shotMediaItems.length > 0
        ? formatMediaPromptSummary(shotMediaItems, "")
        : "";

    return renderPromptTemplate(masterPrompt, {
      storyContent: sourceText,
      shotTitle: shot.title,
      shotDescription: shot.description,
      shotDialogue,
      shotDuration: `${shot.durationSeconds}s`,
      shotGeneratedAttributes: generatedAttributeText,
      shotAttributes: shotAttributeText,
      referenceMedia: mediaSummary,
      outputFormat: shotPromptOutputFormat,
    });
  }

  function openShotPrompt(shot: VideoShot) {
    let prompt = "";
    try {
      prompt = composeShotPrompt(shot);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : t("workspace.shotMasterPromptMissing");
      setShotVideoErrors((current) => ({
        ...current,
        [shot.id]: message,
      }));
      setStatus({ label: message, tone: "danger" });
      return;
    }
    const shotMediaItems = getValidShotMediaItems(shot);
    setGeneratedShotPrompts((current) => ({
      ...current,
      [shot.id]: prompt,
    }));
    setRawDataModal({
      title: t("workspace.shotPromptTitle"),
      help: t("workspace.shotPromptPopupHelp"),
      value: prompt,
      mediaItems: shotMediaItems,
    });
    setErrorMessage("");
    setStatus({ label: t("workspace.shotPromptGenerated"), tone: "success" });
  }

  async function createShotVideo(shot: VideoShot) {
    let finalPrompt = "";
    try {
      finalPrompt = (
        generatedShotPrompts[shot.id] ?? composeShotPrompt(shot)
      ).trim();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : t("workspace.shotVideoMissingPrompt");
      setShotVideoErrors((current) => ({
        ...current,
        [shot.id]: message,
      }));
      setStatus({ label: t("workspace.shotVideoFailed"), tone: "danger" });
      return;
    }
    if (!finalPrompt) {
      setShotVideoErrors((current) => ({
        ...current,
        [shot.id]: t("workspace.shotVideoMissingPrompt"),
      }));
      setStatus({ label: t("workspace.shotVideoFailed"), tone: "danger" });
      return;
    }

    const mediaIds = getValidShotMediaItems(shot).map((item) => item.id);
    const appRequest = {
      endpoint: `/api/v1/projects/${projectId}/videos`,
      body: {
        finalPrompt,
        mediaIds,
      },
      shot: {
        id: shot.id,
        title: shot.title,
      },
    };

    setGeneratedShotPrompts((current) => ({
      ...current,
      [shot.id]: finalPrompt,
    }));
    setCreatingVideoShotIds((current) => ({ ...current, [shot.id]: true }));
    setShotVideoMessages((current) => {
      const next = { ...current };
      delete next[shot.id];
      return next;
    });
    setShotVideoErrors((current) => {
      const next = { ...current };
      delete next[shot.id];
      return next;
    });
    setRawShotVideoRequests((current) => ({
      ...current,
      [shot.id]: appRequest,
    }));
    setRawShotVideoResponses((current) => {
      const next = { ...current };
      delete next[shot.id];
      return next;
    });
    setErrorMessage("");
    setStatus({ label: t("workspace.shotVideoCreating"), tone: "info" });

    try {
      const queuedJob = await apiPost<Job>(`/projects/${projectId}/videos`, {
        finalPrompt,
        mediaIds,
      });
      const completedJob = await pollJob(queuedJob.jobId);
      const result = getJobResult<VideoGenerationResult>(completedJob);
      setRawShotVideoRequests((current) => ({
        ...current,
        [shot.id]: result.rawRequest ?? appRequest,
      }));
      setRawShotVideoResponses((current) => ({
        ...current,
        [shot.id]: result.rawResponse ?? result,
      }));
      setShotVideoMessages((current) => ({
        ...current,
        [shot.id]: t("workspace.shotVideoSuccess"),
      }));
      setStatus({ label: t("workspace.shotVideoSuccess"), tone: "success" });
    } catch (error) {
      const nextError = formatVideoGenerationError(error, t);
      const rawFailure =
        error instanceof JobFailureError
          ? {
              jobId: error.job.jobId,
              status: error.job.status,
              error: error.job.error,
              result: error.job.result,
            }
          : {
              error:
                error instanceof Error
                  ? error.message
                  : t("workspace.shotVideoFailed"),
            };
      setRawShotVideoResponses((current) => ({
        ...current,
        [shot.id]: rawFailure,
      }));
      setShotVideoErrors((current) => ({
        ...current,
        [shot.id]: nextError,
      }));
      setStatus({ label: t("workspace.shotVideoFailed"), tone: "danger" });
    } finally {
      setCreatingVideoShotIds((current) => {
        const next = { ...current };
        delete next[shot.id];
        return next;
      });
    }
  }

  async function startAiHandoff(shot: VideoShot) {
    if (!aiHandoffEnabled || !aiHandoffExtensionId) {
      setShotHandoffErrors((current) => ({
        ...current,
        [shot.id]: t("workspace.aiHandoffDisabled"),
      }));
      setStatus({ label: t("workspace.aiHandoffFailed"), tone: "danger" });
      return;
    }

    const handoffProvider = aiHandoffProvider.trim();
    const handoffTargetUrl = aiHandoffTargetUrl.trim();
    const handoffPromptSelector = aiHandoffPromptSelector.trim();
    if (!handoffProvider || !handoffTargetUrl) {
      setShotHandoffErrors((current) => ({
        ...current,
        [shot.id]: t("workspace.aiHandoffTargetMissing"),
      }));
      setStatus({ label: t("workspace.aiHandoffFailed"), tone: "danger" });
      return;
    }
    if (!handoffPromptSelector) {
      setShotHandoffErrors((current) => ({
        ...current,
        [shot.id]: t("workspace.aiHandoffPromptSelectorMissing"),
      }));
      setStatus({ label: t("workspace.aiHandoffFailed"), tone: "danger" });
      return;
    }
    if (!isValidAbsoluteUrl(handoffTargetUrl)) {
      setShotHandoffErrors((current) => ({
        ...current,
        [shot.id]: t("workspace.aiHandoffTargetInvalid"),
      }));
      setStatus({ label: t("workspace.aiHandoffFailed"), tone: "danger" });
      return;
    }

    let promptText = "";
    try {
      promptText = (
        generatedShotPrompts[shot.id] ?? composeShotPrompt(shot)
      ).trim();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : t("workspace.shotVideoMissingPrompt");
      setShotHandoffErrors((current) => ({
        ...current,
        [shot.id]: message,
      }));
      setStatus({ label: t("workspace.aiHandoffFailed"), tone: "danger" });
      return;
    }

    if (!promptText) {
      setShotHandoffErrors((current) => ({
        ...current,
        [shot.id]: t("workspace.shotVideoMissingPrompt"),
      }));
      setStatus({ label: t("workspace.aiHandoffFailed"), tone: "danger" });
      return;
    }

    setHandoffShotIds((current) => ({ ...current, [shot.id]: true }));
    setGeneratedShotPrompts((current) => ({
      ...current,
      [shot.id]: promptText,
    }));
    setShotHandoffMessages((current) => {
      const next = { ...current };
      delete next[shot.id];
      return next;
    });
    setShotHandoffErrors((current) => {
      const next = { ...current };
      delete next[shot.id];
      return next;
    });
    setStatus({ label: t("workspace.aiHandoffSending"), tone: "info" });

    let handoff: AiHandoff | null = null;
    try {
      handoff = await apiPost<AiHandoff>(`/projects/${projectId}/ai-handoffs`, {
        shotId: shot.id,
        provider: handoffProvider,
        targetUrl: handoffTargetUrl,
        promptText,
      });
      await apiPatch<AiHandoff>(
        `/projects/${projectId}/ai-handoffs/${handoff.id}`,
        {
          status: "sent_to_extension",
        },
      );
      const extensionResult = await sendAiHandoffToExtension(
        {
          handoffId: handoff.id,
          provider: handoff.provider,
          targetUrl: handoff.targetUrl,
          promptText: handoff.promptText,
          promptSelector: handoffPromptSelector,
          shotId: handoff.shotId,
        },
        t("workspace.aiHandoffExtensionMissing"),
        t("workspace.aiHandoffExtensionRejected"),
      );

      if (!extensionResult.ok) {
        throw new Error(extensionResult.errorMessage);
      }

      await apiPatch<AiHandoff>(
        `/projects/${projectId}/ai-handoffs/${handoff.id}`,
        {
          status: extensionResult.status,
        },
      );
      setShotHandoffMessages((current) => ({
        ...current,
        [shot.id]: extensionResult.message || t("workspace.aiHandoffSuccess"),
      }));
      setStatus({ label: t("workspace.aiHandoffSuccess"), tone: "success" });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("workspace.aiHandoffFailed");
      if (handoff) {
        try {
          await apiPatch<AiHandoff>(
            `/projects/${projectId}/ai-handoffs/${handoff.id}`,
            {
              status: "failed",
              errorMessage: message,
            },
          );
        } catch {
          // The inline error below still tells the user what failed.
        }
      }
      setShotHandoffErrors((current) => ({
        ...current,
        [shot.id]: message,
      }));
      setStatus({ label: t("workspace.aiHandoffFailed"), tone: "danger" });
    } finally {
      setHandoffShotIds((current) => {
        const next = { ...current };
        delete next[shot.id];
        return next;
      });
    }
  }

  function copyPromptWithTextarea(prompt: string) {
    const textarea = document.createElement("textarea");
    textarea.value = prompt;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, prompt.length);

    try {
      return document.execCommand("copy");
    } finally {
      document.body.removeChild(textarea);
    }
  }

  function renderShotsPanel() {
    if (flowType !== "script") {
      return null;
    }

    const scenarioShotAttributes =
      templateSelectionToShotAttributes(templateSelection);
    const scenarioAttributeSummary = scenarioShotAttributes
      .map((attribute) => `${attribute.name}=${attribute.value}`)
      .join("; ");

    return (
      <>
        <div className="mt-4 rounded-lg border border-border bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <button
              type="button"
              className="min-w-0 flex-1 text-left focus:outline-none focus:ring-2 focus:ring-sky-200"
              onClick={() => setIsShotsStepOpen((current) => !current)}
              aria-expanded={isShotsStepOpen}
            >
              <div className="flex items-center gap-2 font-medium">
                {isShotsStepOpen ? (
                  <ChevronDown size={18} className="text-muted-foreground" />
                ) : (
                  <ChevronRight size={18} className="text-muted-foreground" />
                )}
                <Clapperboard size={18} className="text-sky-600" />
                {t("workspace.shotsTitle")}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("workspace.shotsHelp")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("workspace.shotsAdminManaged")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {scenarioShotAttributes.length > 0
                  ? t("workspace.shotsScenarioAttributes", {
                      attributes: scenarioAttributeSummary,
                    })
                  : t("workspace.shotsScenarioAttributesEmpty")}
              </p>
            </button>
          </div>

          {isShotsStepOpen ? (
            <>
              <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
                <div className="min-w-0">
                  {showUserMasterPrompts ? (
                    <MasterPromptField
                      id="shotsMasterPrompt"
                      label={t("workspace.shotsMasterPromptLabel")}
                      help={t("workspace.shotsMasterPromptHelp")}
                      rows={7}
                      value={shotGenerationPrompt}
                      onChange={(event) => {
                        setShotGenerationPrompt(event.target.value);
                        setRawShotRequest(null);
                        setRawShotResponse(null);
                        setShotGenerationErrorMessage("");
                        setShotGenerationSuccessMessage("");
                        setRawDataModal(null);
                      }}
                      placeholderSuggestions={MASTER_PROMPT_PLACEHOLDERS.shots}
                    />
                  ) : null}

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      className="gap-2 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={isGeneratingShots}
                      onClick={() => void generateShots()}
                    >
                      {isGeneratingShots ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Sparkles size={16} />
                      )}
                      {t("workspace.shotsGenerate")}
                    </Button>
                    {renderFullPromptButton(
                      t("workspace.shotsFullPrompt"),
                      t("workspace.shotsFullPromptHelp"),
                      buildShotGenerationFullPrompt(),
                      requestMediaItems,
                    )}
                    {renderRawDataButton(
                      t("workspace.rawRequestButton"),
                      t("shots.rawRequest"),
                      t("shots.rawRequestHelp"),
                      rawShotRequest,
                    )}
                    {renderRawDataButton(
                      t("workspace.rawResponseButton"),
                      t("shots.rawResponse"),
                      t("shots.rawResponseHelp"),
                      rawShotResponse,
                    )}
                  </div>

                  <div className="mt-4 rounded-md border border-border bg-muted/30 p-3">
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">
                        {t("workspace.shotsResultTitle")}
                      </h4>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {t("workspace.shotsResultHelp")}
                      </p>
                    </div>
                    <TextareaWithCounter
                      rows={10}
                      value={shotsResultText}
                      onChange={(event) =>
                        syncShotsResultJson(event.target.value)
                      }
                      placeholder={t("workspace.shotsResultPlaceholder")}
                      spellCheck={false}
                      className="mt-3 min-h-72 w-full resize-y rounded-md border border-border bg-white p-3 font-mono text-xs leading-5 outline-none focus:ring-2 focus:ring-sky-200"
                    />
                    {shotsResultJsonError ? (
                      <div className="mt-2 whitespace-pre-wrap rounded-md border border-red-100 bg-red-50 p-3 text-xs leading-5 text-red-700">
                        {shotsResultJsonError}
                      </div>
                    ) : null}
                  </div>

                  {shotGenerationErrorMessage ? (
                    <div className="mt-3 flex items-start gap-2 rounded-md border border-red-100 bg-red-50 p-3 text-sm leading-6 text-red-700">
                      <AlertCircle size={16} className="mt-0.5 shrink-0" />
                      <span className="whitespace-pre-wrap">
                        {shotGenerationErrorMessage}
                      </span>
                    </div>
                  ) : shotGenerationSuccessMessage ? (
                    <div className="mt-3 flex items-start gap-2 rounded-md border border-emerald-100 bg-emerald-50 p-3 text-sm leading-6 text-emerald-700">
                      <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                      <span>{shotGenerationSuccessMessage}</span>
                    </div>
                  ) : null}
                </div>

                <aside className="min-w-0 space-y-3">
                  {renderAttributeCatalogSelection({
                    catalog: shotsAttributeCatalog,
                    selectedIds: shotsOptionIds,
                    setSelectedIds: setShotsOptionIds,
                    title: "Shots Attributes",
                    help: "Admin-managed Shots attributes used when the Shots master prompt contains {shotsAttributes}. Required attributes keep at least one selected option.",
                    helperPrefix: "shots",
                    panelOpen: isShotsAttributesOpen,
                    onPanelToggle: () =>
                      setIsShotsAttributesOpen((current) => !current),
                  })}
                </aside>
              </div>

              <div className="mt-4 rounded-md bg-muted p-3 text-sm text-muted-foreground">
                {t("workspace.shotsSourceFromScenario")}
              </div>
            </>
          ) : null}
        </div>

        <div className="mt-4 rounded-lg border border-border bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <button
              type="button"
              className="min-w-0 flex-1 text-left focus:outline-none focus:ring-2 focus:ring-sky-200"
              onClick={() => setIsShotCardsStepOpen((current) => !current)}
              aria-expanded={isShotCardsStepOpen}
            >
              <div className="flex items-center gap-2 font-medium">
                {isShotCardsStepOpen ? (
                  <ChevronDown size={18} className="text-muted-foreground" />
                ) : (
                  <ChevronRight size={18} className="text-muted-foreground" />
                )}
                <Clapperboard size={18} className="text-sky-600" />
                {t("workspace.shotsCardsTitle")}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("workspace.shotsCardsHelp")}
              </p>
            </button>
          </div>

          {isShotCardsStepOpen ? (
            !selectedShotPlan ? (
              <div className="mt-3 rounded-md bg-muted p-3 text-sm text-muted-foreground">
                {t("workspace.shotsNone")}
              </div>
            ) : (
              <>
                {showUserMasterPrompts ? (
                  <div className="mt-4">
                    <MasterPromptField
                      id="shotMasterPrompt"
                      label={t("workspace.shotMasterPromptLabel")}
                      help={t("workspace.shotMasterPromptHelp")}
                      rows={7}
                      value={shotPromptTemplate}
                      onChange={(event) => {
                        setShotPromptTemplate(event.target.value);
                        setGeneratedShotPrompts({});
                        setRawDataModal(null);
                      }}
                      placeholderSuggestions={MASTER_PROMPT_PLACEHOLDERS.shot}
                    />
                  </div>
                ) : null}

                <div className="mt-4 grid gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground">
                        {t("workspace.shotsEditorTitle")}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("workspace.shotsEditorHelp")}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
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
                        className="gap-2 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isSavingShots}
                        onClick={() => void saveShotPlan()}
                      >
                        {isSavingShots ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Save size={16} />
                        )}
                        {t("workspace.shotsSave")}
                      </Button>
                    </div>
                  </div>

                  {selectedShotPlan.shots.map((shot, shotIndex) => {
                    const checked = selectedShotIds.includes(shot.id);
                    const shotAttributes = shot.attributes.filter(
                      (attribute) => !isDialogueAttribute(attribute),
                    );
                    const adminShotSelectedIds = attributeSelectionToOptionIds(
                      buildShotAttributeSelectionForShot(shot),
                    );
                    const isShotAttributesOpen =
                      openShotAttributePanelIds[shot.id] ?? false;
                    const isAdminShotAttributesOpen =
                      openAdminShotAttributePanelIds[shot.id] ?? false;
                    const isCreatingShotVideo =
                      creatingVideoShotIds[shot.id] ?? false;
                    const isSendingHandoff = handoffShotIds[shot.id] ?? false;
                    const shotVideoMessage = shotVideoMessages[shot.id];
                    const shotVideoError = shotVideoErrors[shot.id];
                    const shotHandoffMessage = shotHandoffMessages[shot.id];
                    const shotHandoffError = shotHandoffErrors[shot.id];
                    return (
                      <div
                        key={shot.id}
                        className={`rounded-md border p-3 transition ${
                          checked
                            ? "border-sky-300 bg-sky-50"
                            : "border-border bg-white"
                        }`}
                      >
                        <div className="flex flex-wrap items-start gap-3">
                          <label className="mt-2 inline-flex items-center gap-2 text-sm font-medium">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-border"
                              checked={checked}
                              onChange={() => toggleShotSelection(shot.id)}
                            />
                            {t("workspace.shotsUse")}
                          </label>
                          <input
                            value={shot.title}
                            onChange={(event) =>
                              updateShot(shot.id, (currentShot) => ({
                                ...currentShot,
                                title: event.target.value,
                              }))
                            }
                            aria-label={t("workspace.shotsTitleInput", {
                              index: shotIndex + 1,
                            })}
                            className="h-10 min-w-0 flex-1 rounded-md border border-border bg-white px-3 text-sm font-medium outline-none focus:ring-2 focus:ring-sky-200"
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
                              index: shotIndex + 1,
                            })}
                            className="h-10 w-20 rounded-md border border-border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-sky-200"
                          />
                          <button
                            type="button"
                            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-white hover:text-foreground focus:outline-none focus:ring-2 focus:ring-sky-200"
                            onClick={() => removeShot(shot.id)}
                            aria-label={t("workspace.shotsRemove", {
                              title: shot.title,
                            })}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <div className="mt-3 grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
                          <aside className="order-2 min-w-0 space-y-3 xl:col-start-2 xl:row-start-1 xl:order-none">
                            {renderAttributeCatalogSelection({
                              catalog: shotAttributeCatalog,
                              selectedIds: adminShotSelectedIds,
                              setSelectedIds: (updater) => {
                                updateShot(shot.id, (currentShot) => {
                                  const currentIds = shotAttributeCatalog
                                    ? mergeWithRequiredCatalogOptionIds(
                                        shotAttributeCatalog,
                                        attributeSelectionToOptionIds(
                                          currentShot.attributeSelection,
                                        ),
                                      )
                                    : attributeSelectionToOptionIds(
                                        currentShot.attributeSelection,
                                      );
                                  const nextIds = updater(currentIds);
                                  return {
                                    ...currentShot,
                                    attributeSelection: shotAttributeCatalog
                                      ? buildAttributeSelection(
                                          shotAttributeCatalog,
                                          nextIds,
                                        )
                                      : null,
                                  };
                                });
                              },
                              title: t("workspace.adminShotAttributesTitle"),
                              help: t("workspace.adminShotAttributesHelp"),
                              helperPrefix: `admin-shot-${shot.id}`,
                              panelOpen: isAdminShotAttributesOpen,
                              onPanelToggle: () =>
                                setOpenAdminShotAttributePanelIds(
                                  (current) => ({
                                    ...current,
                                    [shot.id]: !isAdminShotAttributesOpen,
                                  }),
                                ),
                            })}
                            <div className="rounded-md border border-border bg-white">
                              <button
                                type="button"
                                className="flex w-full items-start justify-between gap-3 p-3 text-left focus:outline-none focus:ring-2 focus:ring-sky-200"
                                onClick={() =>
                                  setOpenShotAttributePanelIds((current) => ({
                                    ...current,
                                    [shot.id]: !isShotAttributesOpen,
                                  }))
                                }
                                aria-expanded={isShotAttributesOpen}
                              >
                                <span className="min-w-0">
                                  <span className="flex min-w-0 items-center gap-2 font-medium">
                                    {isShotAttributesOpen ? (
                                      <ChevronDown
                                        size={18}
                                        className="text-muted-foreground"
                                      />
                                    ) : (
                                      <ChevronRight
                                        size={18}
                                        className="text-muted-foreground"
                                      />
                                    )}
                                    <span className="truncate">
                                      {t(
                                        "workspace.shotGeneratedAttributesTitle",
                                      )}
                                    </span>
                                  </span>
                                  <span className="mt-1 block text-xs text-muted-foreground">
                                    {t("workspace.shotAttributesCount", {
                                      count: shotAttributes.length,
                                    })}
                                  </span>
                                </span>
                                <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                                  {shotAttributes.length}
                                </span>
                              </button>

                              {isShotAttributesOpen ? (
                                <div className="border-t border-border p-3">
                                  <p className="mb-3 text-xs text-muted-foreground">
                                    {t("workspace.shotAttributesPanelHelp")}
                                  </p>
                                  <div className="grid gap-3">
                                    {shotAttributes.length === 0 ? (
                                      <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
                                        {t("workspace.shotPromptNoAttributes")}
                                      </div>
                                    ) : null}
                                    {shotAttributes.map(
                                      (attribute, attributeIndex) => (
                                        <div
                                          key={attribute.id}
                                          className="rounded-md border border-border p-3"
                                        >
                                          <div className="flex items-center gap-2">
                                            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm text-sky-800">
                                              {attributeIndex + 1}
                                            </span>
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
                                              aria-label={t(
                                                "workspace.shotsAttributeName",
                                              )}
                                              className="h-9 min-w-0 flex-1 rounded-md border border-border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-sky-200"
                                            />
                                            <button
                                              type="button"
                                              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-sky-200"
                                              onClick={() =>
                                                removeShotAttribute(
                                                  shot.id,
                                                  attribute.id,
                                                )
                                              }
                                              aria-label={t(
                                                "workspace.shotsRemoveAttribute",
                                              )}
                                            >
                                              <Trash2 size={15} />
                                            </button>
                                          </div>
                                          <AutoResizeTextarea
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
                                            aria-label={t(
                                              "workspace.shotsAttributeValue",
                                            )}
                                            className="mt-2 min-h-9 w-full resize-none overflow-hidden rounded-md border border-border bg-white px-3 py-2 text-sm leading-5 outline-none focus:ring-2 focus:ring-sky-200"
                                          />
                                        </div>
                                      ),
                                    )}
                                    <button
                                      type="button"
                                      className="inline-flex h-9 w-fit items-center gap-2 rounded-md border border-border bg-white px-3 text-sm font-medium transition hover:bg-muted"
                                      onClick={() => addShotAttribute(shot.id)}
                                    >
                                      <Plus size={15} />
                                      {t("workspace.shotsAddAttribute")}
                                    </button>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          </aside>

                          <div className="order-1 min-w-0 xl:col-start-1 xl:row-start-1 xl:order-none">
                            <TextareaWithCounter
                              rows={3}
                              value={shot.description}
                              onChange={(event) =>
                                updateShot(shot.id, (currentShot) => ({
                                  ...currentShot,
                                  description: event.target.value,
                                }))
                              }
                              className="w-full rounded-md border border-border bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-sky-200"
                            />
                            <label className="mt-3 block text-sm font-medium text-foreground">
                              {t("workspace.shotDialogue")}
                              <TextareaWithCounter
                                rows={3}
                                value={getShotDialogue(shot)}
                                onChange={(event) =>
                                  updateShotDialogue(
                                    shot.id,
                                    event.target.value,
                                  )
                                }
                                placeholder={t(
                                  "workspace.shotDialoguePlaceholder",
                                )}
                                className="mt-2 w-full rounded-md border border-border bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-sky-200"
                              />
                            </label>
                            {renderMediaUpload(shot)}
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button
                                type="button"
                                variant="secondary"
                                className="gap-2"
                                onClick={() => openShotPrompt(shot)}
                              >
                                <FileText size={15} />
                                {t("workspace.fullPromptButton")}
                              </Button>
                              <Button
                                type="button"
                                className="gap-2 disabled:cursor-not-allowed disabled:opacity-60"
                                disabled={isCreatingShotVideo}
                                onClick={() => void createShotVideo(shot)}
                              >
                                {isCreatingShotVideo ? (
                                  <Loader2 size={15} className="animate-spin" />
                                ) : (
                                  <FileVideo size={15} />
                                )}
                                {isCreatingShotVideo
                                  ? t("workspace.shotVideoCreating")
                                  : t("workspace.shotVideoCreate")}
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                className="gap-2 disabled:cursor-not-allowed disabled:opacity-60"
                                disabled={isSendingHandoff}
                                onClick={() => void startAiHandoff(shot)}
                              >
                                {isSendingHandoff ? (
                                  <Loader2 size={15} className="animate-spin" />
                                ) : (
                                  <Send size={15} />
                                )}
                                {isSendingHandoff
                                  ? t("workspace.aiHandoffSending")
                                  : t("workspace.aiHandoffButton")}
                              </Button>
                              {renderRawDataButton(
                                t("workspace.rawRequestButton"),
                                t("workspace.shotVideoRawRequest"),
                                t("workspace.shotVideoRawRequestHelp"),
                                rawShotVideoRequests[shot.id],
                              )}
                              {renderRawDataButton(
                                t("workspace.rawResponseButton"),
                                t("workspace.shotVideoRawResponse"),
                                t("workspace.shotVideoRawResponseHelp"),
                                rawShotVideoResponses[shot.id],
                              )}
                            </div>
                            {shotVideoMessage ? (
                              <div className="mt-3 rounded-md border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-800">
                                {shotVideoMessage}
                              </div>
                            ) : null}
                            {shotVideoError ? (
                              <div className="mt-3 whitespace-pre-wrap rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-700">
                                {shotVideoError}
                              </div>
                            ) : null}
                            {shotHandoffMessage ? (
                              <div className="mt-3 rounded-md border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-800">
                                {shotHandoffMessage}
                              </div>
                            ) : null}
                            {shotHandoffError ? (
                              <div className="mt-3 whitespace-pre-wrap rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-700">
                                {shotHandoffError}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )
          ) : null}
        </div>
      </>
    );
  }

  function renderTemplateSelector() {
    const activeTemplate = selectedTemplate ?? templates[0] ?? null;
    const selectedTemplateOptionCount = selectedTemplate
      ? selectedTemplate.attributes.reduce(
          (total, attribute) =>
            total + (selectedOptionIds[attribute.id] ?? []).length,
          0,
        )
      : 0;
    const templateTitle =
      flowType === "script"
        ? t("workspace.templateTitle")
        : t("workspace.productTemplateTitle");
    const templateHelp =
      flowType === "script"
        ? t("workspace.templateHelp")
        : t("workspace.productTemplateHelp");

    return (
      <div className="mt-4 rounded-lg border border-border bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <button
            type="button"
            className="min-w-0 flex-1 text-left focus:outline-none focus:ring-2 focus:ring-sky-200"
            onClick={() => setIsTemplateStepOpen((current) => !current)}
            aria-expanded={isTemplateStepOpen}
          >
            <div className="flex items-center gap-2 font-medium">
              {isTemplateStepOpen ? (
                <ChevronDown size={18} className="text-muted-foreground" />
              ) : (
                <ChevronRight size={18} className="text-muted-foreground" />
              )}
              {templateTitle}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{templateHelp}</p>
          </button>
        </div>

        {isTemplateStepOpen ? (
          <>
            {templates.length === 0 || !activeTemplate ? (
              <div className="mt-3 rounded-md bg-muted p-3 text-sm text-muted-foreground">
                {t("workspace.templateNone")}
              </div>
            ) : (
              <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
                <div className="min-w-0 xl:col-start-1 xl:row-start-1">
                  <div className="rounded-md border border-sky-100 bg-sky-50 p-3 text-sm text-sky-900">
                    <div className="font-medium">Active Scenario catalog</div>
                    <p className="mt-1">{activeTemplate.name}</p>
                    {activeTemplate.description ? (
                      <p className="mt-1 text-xs leading-5 text-sky-800">
                        {activeTemplate.description}
                      </p>
                    ) : null}
                  </div>

                  {flowType === "script" ? (
                    <div className="mt-4 grid gap-4">
                      {showUserMasterPrompts ? (
                        <MasterPromptField
                          id="scenarioMasterPrompt"
                          label={t("workspace.templateMasterPromptLabel")}
                          help={t("workspace.templateMasterPromptHelp")}
                          rows={7}
                          value={scenarioAnalysisPrompt}
                          onChange={(event) => {
                            setScenarioAnalysisPrompt(event.target.value);
                            setTemplateAnalysisCompact("");
                            setTemplateAnalysisErrorMessage("");
                            setRawTemplateRequest(null);
                            setRawTemplateResponse(null);
                            setRawDataModal(null);
                          }}
                          placeholderSuggestions={
                            MASTER_PROMPT_PLACEHOLDERS.scenario
                          }
                        />
                      ) : null}
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-3">
                    {flowType === "script" ? (
                      <Button
                        type="button"
                        className="gap-2 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isAnalyzingTemplate || !selectedTemplate}
                        onClick={() => void analyzeTemplateSelection()}
                      >
                        {isAnalyzingTemplate ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Sparkles size={16} />
                        )}
                        {isAnalyzingTemplate
                          ? t("workspace.templateAnalyzing")
                          : t("workspace.templateAnalyze")}
                      </Button>
                    ) : null}
                    {flowType === "script" ? (
                      <>
                        {renderFullPromptButton(
                          t("workspace.scenarioFullPrompt"),
                          t("workspace.scenarioFullPromptHelp"),
                          buildScenarioAnalysisFullPrompt(),
                        )}
                        {renderRawDataButton(
                          t("workspace.rawRequestButton"),
                          t("workspace.scenarioRawRequest"),
                          t("workspace.scenarioRawRequestHelp"),
                          rawTemplateRequest,
                        )}
                        {renderRawDataButton(
                          t("workspace.rawResponseButton"),
                          t("workspace.scenarioRawResponse"),
                          t("workspace.scenarioRawResponseHelp"),
                          rawTemplateResponse,
                        )}
                      </>
                    ) : null}
                    <Button
                      type="button"
                      variant="secondary"
                      className="gap-2 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={isSavingTemplateSelection}
                      onClick={() => void saveTemplateSelection()}
                    >
                      {isSavingTemplateSelection ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Save size={16} />
                      )}
                      {isSavingTemplateSelection
                        ? t("workspace.templateSelectionSaving")
                        : t("workspace.templateSelectionSave")}
                    </Button>
                  </div>

                  {templateAnalysisErrorMessage ? (
                    <div className="mt-3 flex items-start gap-2 rounded-md border border-red-100 bg-red-50 p-3 text-sm leading-6 text-red-700">
                      <AlertCircle size={16} className="mt-0.5 shrink-0" />
                      <span className="whitespace-pre-wrap">
                        {templateAnalysisErrorMessage}
                      </span>
                    </div>
                  ) : null}

                  {templateAnalysisCompact ? (
                    <div className="mt-4 rounded-md border border-sky-100 bg-sky-50 p-3 font-mono text-xs leading-5 text-sky-950">
                      <div className="mb-1 font-sans text-sm font-medium text-sky-900">
                        {t("workspace.templateAnalysisResult")}
                      </div>
                      <pre className="whitespace-pre-wrap break-words">
                        {templateAnalysisCompact}
                      </pre>
                    </div>
                  ) : null}
                </div>

                <aside className="min-w-0 xl:col-start-2 xl:row-start-1">
                  {selectedTemplate ? (
                    <div className="rounded-md border border-border bg-white">
                      <button
                        type="button"
                        className="flex w-full items-start justify-between gap-3 p-3 text-left focus:outline-none focus:ring-2 focus:ring-sky-200"
                        onClick={() =>
                          setIsTemplateAttributesOpen((current) => !current)
                        }
                        aria-expanded={isTemplateAttributesOpen}
                      >
                        <span className="min-w-0">
                          <span className="flex min-w-0 items-center gap-2 font-medium">
                            {isTemplateAttributesOpen ? (
                              <ChevronDown
                                size={18}
                                className="text-muted-foreground"
                              />
                            ) : (
                              <ChevronRight
                                size={18}
                                className="text-muted-foreground"
                              />
                            )}
                            <span className="truncate">
                              {t("workspace.templateAttributesTitle")}
                            </span>
                          </span>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {t("workspace.templateSelectedCount", {
                              count: selectedTemplateOptionCount,
                            })}
                          </span>
                        </span>
                        <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                          {selectedTemplate.attributes.length}
                        </span>
                      </button>

                      {isTemplateAttributesOpen ? (
                        <div className="border-t border-border p-3">
                          <p className="mb-3 text-xs text-muted-foreground">
                            {t("workspace.templateAttributesHelp")}
                          </p>
                          <div className="grid gap-3">
                            {selectedTemplate.attributes.map(
                              (attribute, attributeIndex) => {
                                const isAttributeCollapsed =
                                  collapsedTemplateAttributeIds[attribute.id] ??
                                  true;
                                const selectedCount = (
                                  selectedOptionIds[attribute.id] ?? []
                                ).length;
                                return (
                                  <div
                                    key={attribute.id}
                                    className="rounded-md border border-border p-3"
                                  >
                                    <div className="flex w-full items-center justify-between gap-2">
                                      <button
                                        type="button"
                                        className="flex min-w-0 flex-1 items-center gap-2 text-left font-medium focus:outline-none focus:ring-2 focus:ring-sky-200"
                                        onClick={() =>
                                          setCollapsedTemplateAttributeIds(
                                            (current) => ({
                                              ...current,
                                              [attribute.id]:
                                                !isAttributeCollapsed,
                                            }),
                                          )
                                        }
                                        aria-expanded={!isAttributeCollapsed}
                                      >
                                        {isAttributeCollapsed ? (
                                          <ChevronRight
                                            size={16}
                                            className="shrink-0 text-muted-foreground"
                                          />
                                        ) : (
                                          <ChevronDown
                                            size={16}
                                            className="shrink-0 text-muted-foreground"
                                          />
                                        )}
                                        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm text-sky-800">
                                          {attributeIndex + 1}
                                        </span>
                                        <span className="truncate">
                                          {attribute.name}
                                        </span>
                                      </button>
                                      <div className="flex shrink-0 items-center gap-2">
                                        <ScenarioTextHelper
                                          description={attribute.description}
                                          descriptionLabel={t(
                                            "workspace.scenarioHelperDescription",
                                          )}
                                          helperId={`attribute:${attribute.id}`}
                                          label={t(
                                            "workspace.scenarioHelperOpen",
                                          )}
                                          onToggle={setOpenScenarioHelperId}
                                          openHelperId={openScenarioHelperId}
                                          translateLabel={t(
                                            "workspace.scenarioHelperTranslate",
                                          )}
                                        />
                                        <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                                          {t(
                                            "workspace.templateSelectedCount",
                                            {
                                              count: selectedCount,
                                            },
                                          )}
                                        </span>
                                      </div>
                                    </div>
                                    {!isAttributeCollapsed ? (
                                      <div className="mt-3 grid gap-2">
                                        {attribute.options.map(
                                          (option, optionIndex) => {
                                            const checked = (
                                              selectedOptionIds[attribute.id] ??
                                              []
                                            ).includes(option.id);
                                            const optionInputId = `template-option-${attribute.id}-${option.id}`;
                                            return (
                                              <div
                                                key={option.id}
                                                className={`grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-md border px-3 py-2 text-sm transition ${
                                                  checked
                                                    ? "border-sky-300 bg-sky-50 text-sky-800"
                                                    : "border-border bg-white text-foreground hover:bg-muted"
                                                }`}
                                              >
                                                <input
                                                  id={optionInputId}
                                                  type="checkbox"
                                                  className="h-4 w-4 rounded border-border"
                                                  checked={checked}
                                                  onChange={() =>
                                                    toggleTemplateOption(
                                                      attribute.id,
                                                      option.id,
                                                    )
                                                  }
                                                />
                                                <label
                                                  htmlFor={optionInputId}
                                                  className="flex min-w-0 cursor-pointer items-center gap-2"
                                                >
                                                  <span className="shrink-0 rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                                    {attributeIndex + 1}.
                                                    {optionIndex + 1}
                                                  </span>
                                                  <span className="truncate">
                                                    {option.label}
                                                  </span>
                                                </label>
                                                <ScenarioTextHelper
                                                  description={
                                                    option.description
                                                  }
                                                  descriptionLabel={t(
                                                    "workspace.scenarioHelperDescription",
                                                  )}
                                                  helperId={`option:${attribute.id}:${option.id}`}
                                                  label={t(
                                                    "workspace.scenarioHelperOpen",
                                                  )}
                                                  onToggle={
                                                    setOpenScenarioHelperId
                                                  }
                                                  openHelperId={
                                                    openScenarioHelperId
                                                  }
                                                  translateLabel={t(
                                                    "workspace.scenarioHelperTranslate",
                                                  )}
                                                />
                                              </div>
                                            );
                                          },
                                        )}
                                      </div>
                                    ) : null}
                                  </div>
                                );
                              },
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </aside>
              </div>
            )}
          </>
        ) : null}
      </div>
    );
  }

  const createScriptButton = (
    <Button
      type="button"
      variant={flowType === "product" ? "primary" : "secondary"}
      className="disabled:cursor-not-allowed disabled:opacity-60"
      disabled={isCreatingScript}
      onClick={() => void createScript()}
    >
      {isCreatingScript ? t("workspace.creating") : t("workspace.createScript")}
    </Button>
  );

  function renderOneClickWizard() {
    const steps: Array<{ id: 1 | 2 | 3; label: string }> = [
      { id: 1, label: t("oneClick.step1Short") },
      { id: 2, label: t("oneClick.step2Short") },
      { id: 3, label: t("oneClick.step3Short") },
    ];
    const hasStoryContent = promptText.trim().length > 0;
    const canGoNext = hasStoryContent;
    const goToNextStep = async () => {
      if (oneClickStep === 1 || oneClickStep === 2) {
        const saved = await saveStoryContent();
        if (!saved) {
          return;
        }
      }
      if (oneClickStep === 1) {
        setOneClickStep(2);
        return;
      }
      setOneClickStep(3);
    };

    return (
      <Card
        title={t("oneClick.wizardTitle")}
        action={<Badge variant="info">{t("oneClick.shortcutBadge")}</Badge>}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {steps.map((step) => {
            const active = step.id === oneClickStep;
            const disabled = step.id > 1 && !hasStoryContent;
            return (
              <button
                key={step.id}
                type="button"
                disabled={disabled}
                className={`rounded-md border p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-sky-200 disabled:cursor-not-allowed disabled:opacity-50 ${
                  active
                    ? "border-sky-300 bg-sky-50 text-sky-950"
                    : "border-border bg-white text-muted-foreground hover:bg-muted"
                }`}
                onClick={() => {
                  if (!disabled) {
                    setOneClickStep(step.id);
                  }
                }}
              >
                <span className="block text-xs font-medium uppercase">
                  {t("oneClick.stepNumber", { step: step.id })}
                </span>
                <span className="mt-1 block text-sm font-semibold">
                  {step.label}
                </span>
              </button>
            );
          })}
        </div>

        {oneClickStep === 1 ? renderStoryContentStep() : null}
        {oneClickStep === 2 ? renderOneClickScenarioStep() : null}
        {oneClickStep === 3 ? renderShotsPanel() : null}
        {renderScriptStatus()}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <Button
            type="button"
            variant="secondary"
            disabled={oneClickStep === 1}
            onClick={() =>
              setOneClickStep((current) =>
                current === 3 ? 2 : current === 2 ? 1 : 1,
              )
            }
          >
            {t("oneClick.backStep")}
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <LinkButton href={`/projects/${projectId}`} variant="secondary">
              {t("oneClick.openProject")}
            </LinkButton>
            {oneClickStep < 3 ? (
              <Button
                type="button"
                disabled={!canGoNext || isSavingStoryContent}
                onClick={() => void goToNextStep()}
              >
                {isSavingStoryContent
                  ? t("oneClick.storySaving")
                  : t("oneClick.nextStep")}
              </Button>
            ) : null}
          </div>
        </div>
      </Card>
    );
  }

  function renderProjectSaveBar() {
    return (
      <div className="sticky top-0 z-20 mb-5 rounded-lg border border-border bg-white/95 p-3 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2
              className="truncate text-base font-semibold text-foreground"
              title={projectHeaderTitle}
            >
              {projectHeaderTitle}
            </h2>
            <p
              className="mt-1 truncate text-sm text-muted-foreground"
              title={projectHeaderDescription}
            >
              {projectHeaderDescription}
            </p>
          </div>
          <Button
            type="button"
            className="shrink-0 gap-2 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSavingProject}
            onClick={() => void saveProject()}
          >
            {isSavingProject ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            {isSavingProject
              ? t("workspace.projectSaving")
              : t("workspace.projectSave")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      {renderProjectSaveBar()}
      <div
        className={
          flowType === "script"
            ? "grid gap-5"
            : "grid gap-5 xl:grid-cols-[1.08fr_0.92fr]"
        }
      >
        {isOneClickMode ? (
          renderOneClickWizard()
        ) : flowType === "script" ? (
          <Card
            title={t("flow.script")}
            action={<Badge variant="info">{t("workspace.selectedFlow")}</Badge>}
          >
            {renderStoryContentStep()}
            {renderTemplateSelector()}
            {renderShotsPanel()}
            {renderScriptStatus()}
          </Card>
        ) : (
          <Card
            title={t("flow.product")}
            action={<Badge variant="info">{t("workspace.selectedFlow")}</Badge>}
          >
            <label className="text-sm font-medium" htmlFor="productUrl">
              {t("workspace.productLabel")}
            </label>
            <div className="mt-2">
              <input
                id="productUrl"
                value={productUrl}
                onChange={(event) => {
                  setProductUrl(event.target.value);
                  setRawProductRequest(null);
                  setRawProductResponse(null);
                }}
                className="h-10 w-full rounded-md border border-border px-3 text-sm outline-none focus:ring-2 focus:ring-sky-200"
              />
            </div>
            <div className="mt-4 rounded-md bg-muted p-3 text-sm text-muted-foreground">
              {t("workspace.productHelp")}
            </div>
            {renderMediaUpload()}
            {renderTemplateSelector()}
            <div className="mt-4 flex flex-wrap gap-3">
              <Button
                type="button"
                variant="secondary"
                className="gap-2 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isAnalyzing}
                onClick={() => void analyzeProduct()}
              >
                {isAnalyzing ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Link2 size={16} />
                )}
                {t("workspace.analyze")}
              </Button>
              {renderRawDataButton(
                t("workspace.rawRequestButton"),
                t("workspace.productRawRequest"),
                t("workspace.productRawRequestHelp"),
                rawProductRequest,
              )}
              {renderRawDataButton(
                t("workspace.rawResponseButton"),
                t("workspace.productRawResponse"),
                t("workspace.productRawResponseHelp"),
                rawProductResponse,
              )}
              {createScriptButton}
            </div>
          </Card>
        )}

        {flowType === "product" ? (
          <Card
            title={t("workspace.aiOutput")}
            action={<Badge variant={status.tone}>{status.label}</Badge>}
          >
            <div className="space-y-4 text-sm">
              {errorMessage ? (
                <div className="flex items-start gap-2 rounded-md border border-red-100 bg-red-50 p-3 text-red-700">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              ) : null}

              {productAnalysis ? (
                <div className="grid gap-3">
                  <div>
                    <div className="font-medium">
                      {t("workspace.productFacts")}
                    </div>
                    <ul className="mt-2 space-y-1 rounded-md border border-border bg-white p-3 text-muted-foreground">
                      {productAnalysis.productFacts.map((fact) => (
                        <li key={fact}>- {fact}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="font-medium">
                      {t("workspace.mediaInsights")}
                    </div>
                    <ul className="mt-2 space-y-1 rounded-md border border-border bg-white p-3 text-muted-foreground">
                      {productAnalysis.mediaInsights.map((insight) => (
                        <li key={insight}>- {insight}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null}

              <div>
                <div className="font-medium">{t("workspace.finalContent")}</div>
                <TextareaWithCounter
                  rows={12}
                  value={finalPrompt}
                  onChange={(event) => setFinalPrompt(event.target.value)}
                  placeholder={t("workspace.finalPlaceholder")}
                  className="mt-2 w-full rounded-md border border-border bg-white p-3 text-sm leading-6 text-foreground outline-none focus:ring-2 focus:ring-sky-200"
                />
              </div>

              <div className="rounded-md bg-muted p-3 text-muted-foreground">
                {t("workspace.mediaCount", { count: validMediaItems.length })}
              </div>

              {scriptResult ? (
                <div className="flex items-start gap-2 rounded-md border border-emerald-100 bg-emerald-50 p-3 text-emerald-700">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                  <span>
                    {t("workspace.scriptCreated")}{" "}
                    <span className="font-medium">{scriptResult.scriptId}</span>
                  </span>
                </div>
              ) : null}
            </div>
          </Card>
        ) : null}
      </div>
      {renderPromptPreviewModal()}
      {renderRawDataModal()}
    </>
  );
}
