"use client";

import type { ChangeEvent, DragEvent } from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type {
  ApiError,
  GenerateShotsJobResult,
  Job,
  MasterPromptConfig,
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
  DEFAULT_SHOT_GENERATION_PROMPT,
  DEFAULT_SHOT_PROMPT_COMPOSER_PROMPT,
  DEFAULT_TEMPLATE_SELECTION_PROMPT,
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
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { MasterPromptField } from "../ui/master-prompt-field";
import { TextareaWithCounter } from "../ui/textarea-with-counter";
import { useI18n } from "../i18n/language-provider";
import {
  translate,
  type TranslationKey,
  type TranslationValues,
} from "../../lib/i18n/dictionary";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? "http://localhost:4000";

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
  flowType: ProjectFlow;
  savedTemplateSelection?: TemplateSelection | null;
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
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
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
      if (isRecord(payload.error) && typeof payload.error.message === "string") {
        const code =
          typeof payload.error.code === "string" ? `${payload.error.code}: ` : "";
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
  const provider = detailString(details, "provider") || t("workspace.aiErrorActiveProvider");
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

function formatJobFailureMessage(job: Job, fallbackLabel: string, t: Translate) {
  const error = job.error;
  const details = isRecord(error?.details) ? error.details : {};
  const lines = [
    fallbackLabel,
    formatAiErrorCause(error, t),
  ];

  if (error?.message) {
    lines.push(t("workspace.aiErrorProviderMessage", { message: error.message }));
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
  const description = descriptionLine
    ?.replace(/^Description:\s*/i, "")
    .trim();
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
  description?: ScenarioAttribute["description"] | ScenarioOption["description"];
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
        value: "Continue from the previous shot or establish the first clear visual state.",
      },
      {
        id: `${id}_end_state`,
        name: "End state",
        value: "Describe the final visual state that the next shot should continue from.",
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
  return Object.entries(values).reduce(
    (rendered, [key, value]) => rendered.replaceAll(`{${key}}`, value),
    template,
  );
}

export function ProjectWorkspace({
  projectId,
  flowType,
  savedTemplateSelection,
  defaultPrompt,
  defaultProductUrl,
}: ProjectWorkspaceProps) {
  const { t } = useI18n();
  const [promptText, setPromptText] = useState(
    defaultPrompt || t("projectDetail.defaultPrompt"),
  );
  const [productUrl, setProductUrl] = useState(defaultProductUrl);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [shotPlans, setShotPlans] = useState<VideoShotPlan[]>([]);
  const [selectedShotPlanId, setSelectedShotPlanId] = useState("");
  const [selectedShotIds, setSelectedShotIds] = useState<string[]>([]);
  const [shotDurationSeconds, setShotDurationSeconds] = useState(8);
  const [rawShotRequest, setRawShotRequest] = useState<unknown>(null);
  const [rawShotResponse, setRawShotResponse] = useState<unknown>(null);
  const [rawStoryRequest, setRawStoryRequest] = useState<unknown>(null);
  const [rawStoryResponse, setRawStoryResponse] = useState<unknown>(null);
  const [rawTemplateRequest, setRawTemplateRequest] = useState<unknown>(null);
  const [rawTemplateResponse, setRawTemplateResponse] = useState<unknown>(null);
  const [rawProductRequest, setRawProductRequest] = useState<unknown>(null);
  const [rawProductResponse, setRawProductResponse] = useState<unknown>(null);
  const [rawDataModal, setRawDataModal] =
    useState<RawDataModalState | null>(null);
  const [templates, setTemplates] = useState<VideoTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedOptionIds, setSelectedOptionIds] = useState<
    Record<string, string[]>
  >({});
  const [templateAnalysisCompact, setTemplateAnalysisCompact] = useState("");
  const [generatedShotPrompts, setGeneratedShotPrompts] = useState<
    Record<string, string>
  >({});
  const [shotComposerPromptTemplate, setShotComposerPromptTemplate] = useState(
    DEFAULT_SHOT_PROMPT_COMPOSER_PROMPT,
  );
  const [shotGenerationPrompt, setShotGenerationPrompt] = useState(
    DEFAULT_SHOT_GENERATION_PROMPT,
  );
  const [scenarioAnalysisPrompt, setScenarioAnalysisPrompt] = useState(
    DEFAULT_TEMPLATE_SELECTION_PROMPT,
  );
  const [scriptGenerationPrompt, setScriptGenerationPrompt] = useState(
    DEFAULT_SCRIPT_GENERATION_PROMPT,
  );
  const [isStoryStepOpen, setIsStoryStepOpen] = useState(true);
  const [isTemplateStepOpen, setIsTemplateStepOpen] = useState(true);
  const [isTemplateAttributesOpen, setIsTemplateAttributesOpen] =
    useState(false);
  const [isShotsStepOpen, setIsShotsStepOpen] = useState(true);
  const [collapsedTemplateAttributeIds, setCollapsedTemplateAttributeIds] =
    useState<Record<string, boolean>>({});
  const [openScenarioHelperId, setOpenScenarioHelperId] = useState("");
  const [openShotAttributePanelIds, setOpenShotAttributePanelIds] = useState<
    Record<string, boolean>
  >({});
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingShots, setIsGeneratingShots] = useState(false);
  const [isSavingShots, setIsSavingShots] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAnalyzingTemplate, setIsAnalyzingTemplate] = useState(false);
  const [isSavingTemplateSelection, setIsSavingTemplateSelection] =
    useState(false);
  const [isCreatingScript, setIsCreatingScript] = useState(false);
  const [isPromptPreviewOpen, setIsPromptPreviewOpen] = useState(false);
  const previewUrlsRef = useRef<string[]>([]);

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
  const selectedShotPlan =
    shotPlans.find((shotPlan) => shotPlan.id === selectedShotPlanId) ?? null;
  const shotSelection = buildShotSelection(selectedShotPlan, selectedShotIds);

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
        const loadedShotPlans = await apiGet<VideoShotPlan[]>("/shots");
        if (!cancelled) {
          setShotPlans(loadedShotPlans);
          setSelectedShotPlanId(
            (current) => current || loadedShotPlans[0]?.id || "",
          );
          setSelectedShotIds((current) =>
            current.length > 0
              ? current
              : loadedShotPlans[0]?.shots.map((shot) => shot.id) ?? [],
          );
          if (loadedShotPlans[0]) {
            setShotDurationSeconds(loadedShotPlans[0].durationSeconds);
          }
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
  }, [flowType, projectId]);

  useEffect(() => {
    let cancelled = false;

    async function loadTemplates() {
      try {
        const loadedTemplates = await apiGet<VideoTemplate[]>("/templates");
        if (!cancelled) {
          setTemplates(loadedTemplates);
          setSelectedTemplateId(
            (current) =>
              current ||
              (savedTemplateSelection &&
              loadedTemplates.some(
                (template) => template.id === savedTemplateSelection.templateId,
              )
                ? savedTemplateSelection.templateId
                : loadedTemplates[0]?.id || ""),
          );
          if (
            savedTemplateSelection &&
            loadedTemplates.some(
              (template) => template.id === savedTemplateSelection.templateId,
            )
          ) {
            setSelectedOptionIds(
              templateSelectionToOptionIds(savedTemplateSelection),
            );
          }
        }
      } catch {
        if (!cancelled) {
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

    async function loadShotPromptConfig() {
      try {
        const [config, masterPromptConfig] = await Promise.all([
          apiGet<ShotPromptConfig>("/admin/shot-prompt"),
          apiGet<MasterPromptConfig>("/admin/master-prompts").catch(
            () => null,
          ),
        ]);
        if (!cancelled) {
          const scriptsPrompt =
            masterPromptConfig?.groups.find((group) => group.type === "scripts")
              ?.defaultPrompt.content || DEFAULT_SCRIPT_GENERATION_PROMPT;
          setShotComposerPromptTemplate(
            config.composerPrompt || DEFAULT_SHOT_PROMPT_COMPOSER_PROMPT,
          );
          setShotGenerationPrompt(
            config.prompt || config.defaultPrompt || DEFAULT_SHOT_GENERATION_PROMPT,
          );
          setScenarioAnalysisPrompt(
            config.scenarioAnalysisPrompt ||
              config.defaultScenarioAnalysisPrompt ||
              DEFAULT_TEMPLATE_SELECTION_PROMPT,
          );
          setScriptGenerationPrompt(scriptsPrompt);
        }
      } catch {
        if (!cancelled) {
          setShotComposerPromptTemplate(DEFAULT_SHOT_PROMPT_COMPOSER_PROMPT);
          setShotGenerationPrompt(DEFAULT_SHOT_GENERATION_PROMPT);
          setScenarioAnalysisPrompt(DEFAULT_TEMPLATE_SELECTION_PROMPT);
          setScriptGenerationPrompt(DEFAULT_SCRIPT_GENERATION_PROMPT);
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
    if (defaultPrompt) {
      return;
    }
    const defaultPrompts: string[] = [translate("projectDetail.defaultPrompt")];
    setPromptText((current) =>
      defaultPrompts.includes(current)
        ? t("projectDetail.defaultPrompt")
        : current,
    );
  }, [defaultPrompt, t]);

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
      updateShot(shotId, (shot) => ({
        ...shot,
        mediaIds: Array.from(
          new Set([...(shot.mediaIds ?? []), ...validUploadedIds]),
        ),
      }));
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
    setGeneratedShotPrompts({});
    setRawStoryRequest(null);
    setRawStoryResponse(null);
    setRawProductRequest(null);
    setRawProductResponse(null);
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
    const nextShot = createLocalShot(shotDurationSeconds);
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
    if (!masterPrompt) {
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
      const queuedJob = await apiPost<Job>("/shots/generate", {
        sourceText,
        durationSeconds: shotDurationSeconds,
        attributes: templateSelectionToShotAttributes(templateSelection),
        masterPrompt,
      });
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
      setShotDurationSeconds(shotPlan.durationSeconds);
      setShotGenerationSuccessMessage(
        t("workspace.shotsGeneratedDetail", {
          count: shotPlan.shots.length,
          name: shotPlan.name,
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

  async function saveShotPlan() {
    if (!selectedShotPlan) {
      setErrorMessage(t("workspace.shotsNone"));
      return;
    }
    if (selectedShotPlan.shots.length === 0) {
      setErrorMessage(t("workspace.shotsNeedOne"));
      return;
    }

    setIsSavingShots(true);
    setErrorMessage("");
    setStatus({ label: t("workspace.shotsSaving"), tone: "info" });

    try {
      const saved = await apiPatch<VideoShotPlan>(
        `/shots/${selectedShotPlan.id}`,
        {
          name: selectedShotPlan.name,
          durationSeconds: selectedShotPlan.durationSeconds,
          attributes: selectedShotPlan.attributes.filter(
            (attribute) => attribute.name.trim() && attribute.value.trim(),
          ),
          shots: selectedShotPlan.shots.map((shot) => ({
            ...shot,
            durationSeconds: clampShotDuration(shot.durationSeconds),
            mediaIds: (shot.mediaIds ?? []).filter((mediaId) =>
              validMediaIds.includes(mediaId),
            ),
            attributes: shot.attributes.filter(
              (attribute) => attribute.name.trim() && attribute.value.trim(),
            ),
          })),
        },
      );
      setShotPlans((current) =>
        current.map((shotPlan) => (shotPlan.id === saved.id ? saved : shotPlan)),
      );
      setSelectedShotIds((current) =>
        current.filter((shotId) =>
          saved.shots.some((shot) => shot.id === shotId),
        ),
      );
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

  async function generatePrompt() {
    const inputText = promptText.trim();
    const masterPrompt = scriptGenerationPrompt.trim();
    if (!inputText) {
      setErrorMessage(t("workspace.missingPrompt"));
      setStoryGenerationErrorMessage(t("workspace.missingPrompt"));
      return;
    }
    if (!masterPrompt) {
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
      const queuedJob = await apiPost<Job>(
        `/projects/${projectId}/prompts/generate`,
        {
          inputText,
          mediaIds: requestMediaIds,
          masterPrompt,
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
      setStatus({ label: t("workspace.storyGenerateSuccess"), tone: "success" });
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
    if (!masterPrompt) {
      setErrorMessage(t("workspace.templateMasterPromptMissing"));
      setTemplateAnalysisErrorMessage(t("workspace.templateMasterPromptMissing"));
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
      const queuedJob = await apiPost<Job>(
        `/projects/${projectId}/template-selection/analyze`,
        {
          inputText,
          templateId: selectedTemplate.id,
          masterPrompt,
        },
      );
      const completedJob = await pollJob(queuedJob.jobId);
      const result =
        getJobResult<TemplateSelectionAnalysisResult>(completedJob);
      setRawTemplateRequest(result.rawRequest);
      setRawTemplateResponse(result.rawResponse);
      setSelectedTemplateId(result.templateSelection.templateId);
      setSelectedOptionIds(
        templateSelectionToOptionIds(result.templateSelection),
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
      await apiPatch<{ saved: boolean; templateSelection: TemplateSelection | null }>(
        `/projects/${projectId}/template-selection`,
        {
          templateSelection,
        },
      );
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

  function buildTemplateGuidance() {
    if (!templateSelection || templateSelection.attributes.length === 0) {
      return "";
    }

    const selections = templateSelection.attributes
      .filter((attribute) => attribute.options.length > 0)
      .map(
        (attribute) =>
          `${attribute.name}: ${attribute.options.map((option) => option.label).join(", ")}`,
      );

    if (selections.length === 0) {
      return "";
    }

    return [
      `Template attributes: ${templateSelection.templateName}`,
      ...selections.map((selection) => `- ${selection}`),
    ].join("\n");
  }

  function buildShotGuidance() {
    if (!shotSelection || shotSelection.shots.length === 0) {
      return "";
    }

    const planAttributes = shotSelection.attributes
      .filter((attribute) => attribute.name && attribute.value)
      .map((attribute) => `- ${attribute.name}: ${attribute.value}`);
    const shots = shotSelection.shots.map((shot, index) => {
      const attributes = shot.attributes
        .filter((attribute) => attribute.name && attribute.value)
        .map((attribute) => `   - ${attribute.name}: ${attribute.value}`);
      return [
        `${index + 1}. ${shot.title} (${shot.durationSeconds}s)`,
        `   - Description: ${shot.description}`,
        ...attributes,
      ].join("\n");
    });

    return [
      `Selected shot plan: ${shotSelection.shotPlanName}`,
      ...(planAttributes.length > 0
        ? ["Plan-level attributes:", ...planAttributes]
        : []),
      ...shots,
    ].join("\n");
  }

  function formatPlanAttributesForPrompt(attributes: VideoShotAttribute[]) {
    const lines = attributes
      .filter((attribute) => attribute.name.trim() && attribute.value.trim())
      .map((attribute) => `${attribute.name.trim()}=${attribute.value.trim()};`);
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

    const mediaSummary =
      requestMediaIds.length > 0
        ? `Use ${requestMediaIds.length} reference media file(s) to keep visual style, lighting, composition, and pacing consistent.`
        : "No reference media. Use a clean modern style, soft lighting, and stable camera movement.";
    const shotSelectionText = buildShotGuidance() || "No selected shot plan.";
    const scenarioSelection = buildTemplateGuidance() || "No selected scenario options.";
    const renderedPrompt = renderPromptTemplate(masterPrompt, {
      inputText,
      mediaSummary,
      shotSelection: shotSelectionText,
      scenarioSelection,
    });

    return [
      renderedPrompt,
      "",
      "Runtime context:",
      "User source text:",
      inputText,
      "",
      "Reference media:",
      mediaSummary,
      "",
      "Shot selection:",
      shotSelectionText,
      "",
      "Scenario selection:",
      scenarioSelection,
      "",
      "Output format:",
      "Return readable sections with concise bullets for direction, visual style, and script/prompt content.",
    ].join("\n");
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
    });

    return [
      renderedPrompt,
      "",
      "Scenario catalog:",
      attributeCatalogText,
      "",
      "User story/script:",
      inputText,
    ].join("\n");
  }

  function buildShotGenerationFullPrompt() {
    const sourceText = promptText.trim();
    const masterPrompt = shotGenerationPrompt.trim();
    if (!sourceText || !masterPrompt) {
      return null;
    }

    const durationSeconds = shotDurationSeconds;
    const attributeText = formatPlanAttributesForPrompt(
      templateSelectionToShotAttributes(templateSelection),
    );
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
                {
                  name: "Dialogue",
                  value: "Short spoken line or voiceover for this shot.",
                },
                { name: "Camera", value: "Camera movement and framing." },
                {
                  name: "Visual",
                  value: "Lighting, composition, production details.",
                },
                { name: "Action", value: "Primary action in the shot." },
                {
                  name: "Transition",
                  value: "How this shot connects to the next one.",
                },
              ],
            },
          ],
        },
        null,
        2,
      ),
    ].join("\n");
  }

  function buildComposedInstructionPreview() {
    const previewMediaItems =
      flowType === "script" ? requestMediaItems : validMediaItems;
    const mediaInstruction =
      previewMediaItems.length > 0
        ? t("workspace.promptPreviewMedia", { count: previewMediaItems.length })
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
            <button
              type="button"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-sky-200"
              onClick={() => setIsPromptPreviewOpen(false)}
              aria-label={t("workspace.promptPreviewClose")}
            >
              <X size={16} />
            </button>
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
                {JSON.stringify(previewPayload, null, 2)}
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
                {rawDataModal.title}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {rawDataModal.help}
              </p>
            </div>
            <button
              type="button"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-sky-200"
              onClick={() => setRawDataModal(null)}
              aria-label={t("workspace.rawDataClose")}
            >
              <X size={16} />
            </button>
          </div>
          <div className="overflow-y-auto p-5">
            <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap break-words rounded-md bg-slate-950 p-4 text-xs leading-5 text-slate-50">
              {formatRawJson(rawDataModal.value)}
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
            {shot ? t("workspace.shotMediaEmpty") : t("workspace.dropzoneEmpty")}
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
            setRawDataModal({ title, help, value });
          }
        }}
      >
        <FileText size={15} />
        {t("workspace.fullPromptButton")}
      </Button>
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
          <div className="mt-4 grid gap-4">
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
              }}
            />

            <div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <label className="text-sm font-medium" htmlFor="scenarioStory">
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
        ) : null}
      </div>
    );
  }

  function toggleTemplateOption(attributeId: string, optionId: string) {
    setSelectedOptionIds((current) => {
      const selectedIds = current[attributeId] ?? [];
      const nextIds = selectedIds.includes(optionId)
        ? selectedIds.filter((selectedId) => selectedId !== optionId)
        : [...selectedIds, optionId];
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
  }

  function composeShotPrompt(shot: VideoShot) {
    const sourceText = promptText.trim() || t("workspace.promptPreviewEmptyInput");
    const shotMediaItems = getValidShotMediaItems(shot);
    const shotDialogue = getShotDialogue(shot).trim();
    const shotAttributes = shot.attributes.filter(
      (attribute) =>
        attribute.name.trim() &&
        attribute.value.trim() &&
        !isDialogueAttribute(attribute),
    );
    const planAttributes =
      selectedShotPlan?.attributes.filter(
        (attribute) => attribute.name.trim() && attribute.value.trim(),
      ) ?? [];
    const templateAttributes =
      templateSelection?.attributes.filter(
        (attribute) => attribute.options.length > 0,
      ) ?? [];

    const templateLines =
      templateAttributes.length > 0
        ? [
            `- ${templateSelection?.templateName ?? selectedTemplate?.name}`,
            ...templateAttributes.flatMap((attribute) => [
              `- ${attribute.name}`,
              ...attribute.options.map((option) => `  - ${option.label}`),
            ]),
          ]
        : [`- ${t("workspace.shotPromptNoTemplateOptions")}`];

    const shotAttributeText =
      shotDialogue || shotAttributes.length > 0
        ? [
            ...(shotDialogue
              ? [formatPromptAttributeLine("Voiceover Script", shotDialogue)]
              : []),
            ...shotAttributes.map((attribute) =>
              formatPromptAttributeLine(attribute.name, attribute.value),
            ),
          ].join("\n")
        : `- ${t("workspace.shotPromptNoAttributes")}`;
    const planAttributeText =
      planAttributes.length > 0
        ? planAttributes
            .map((attribute) =>
              formatPromptAttributeLine(attribute.name, attribute.value),
            )
            .join("\n")
        : `- ${t("workspace.shotPromptNoPlanAttributes")}`;
    const templateSelectionText = templateLines.join("\n");
    const mediaSummary =
      shotMediaItems.length > 0
        ? `- ${t("workspace.mediaCount", { count: shotMediaItems.length })}`
        : `- ${t("workspace.shotPromptNoMedia")}`;
    const renderedPrompt = renderPromptTemplate(shotComposerPromptTemplate, {
      source: `- ${sourceText}`,
      shotTitle: shot.title,
      shotDuration: `${shot.durationSeconds}s`,
      shotDescription: shot.description,
      shotDialogue: shotDialogue || t("workspace.shotDialogueEmpty"),
      shotAttributes: shotAttributeText,
      planAttributes: planAttributeText,
      templateSelection: templateSelectionText,
      mediaSummary,
    });

    return [
      renderedPrompt,
      "",
      "Runtime context:",
      "",
      `${t("workspace.shotPromptSource")}:`,
      `- ${sourceText}`,
      "",
      `${t("workspace.shotPromptShot")}:`,
      `${t("workspace.shotPromptTitleField")}: ${shot.title}`,
      `${t("workspace.shotPromptDuration")}: ${shot.durationSeconds}s`,
      `${t("workspace.shotPromptDescription")}: ${shot.description}`,
      `${t("workspace.shotPromptDialogue")}: ${shotDialogue || t("workspace.shotDialogueEmpty")}`,
      "",
      `${t("workspace.shotPromptAttributes")}:`,
      shotAttributeText,
      "",
      `${t("workspace.shotPromptPlanAttributes")}:`,
      planAttributeText,
      "",
      `${t("workspace.shotPromptTemplate")}:`,
      templateSelectionText,
      "",
      `${t("workspace.shotPromptMedia")}:`,
      mediaSummary,
    ].join("\n");
  }

  function createShotPrompt(shot: VideoShot) {
    setGeneratedShotPrompts((current) => ({
      ...current,
      [shot.id]: composeShotPrompt(shot),
    }));
    setErrorMessage("");
    setStatus({ label: t("workspace.shotPromptGenerated"), tone: "success" });
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

  async function copyShotPrompt(prompt: string) {
    try {
      let copied = copyPromptWithTextarea(prompt);

      if (!copied && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(prompt);
        copied = true;
      }

      if (!copied) {
        throw new Error("Copy command failed");
      }

      setErrorMessage("");
      setStatus({ label: t("workspace.shotPromptCopied"), tone: "success" });
    } catch {
      setErrorMessage(t("workspace.shotPromptCopyFailed"));
      setStatus({ label: t("workspace.shotPromptCopyFailed"), tone: "danger" });
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
            <div className="mt-4">
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
                }}
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <label className="text-sm font-medium" htmlFor="shotDuration">
                {t("workspace.shotsDuration")}
              </label>
              <input
                id="shotDuration"
                type="number"
                min={1}
                max={8}
                value={shotDurationSeconds}
                onChange={(event) => {
                  const nextDuration = clampShotDuration(
                    Number(event.target.value),
                  );
                  setShotDurationSeconds(nextDuration);
                  setRawShotRequest(null);
                  setRawShotResponse(null);
                  setShotGenerationErrorMessage("");
                  setShotGenerationSuccessMessage("");
                  updateSelectedShotPlan((shotPlan) => ({
                    ...shotPlan,
                    durationSeconds: nextDuration,
                  }));
                }}
                className="h-9 w-20 rounded-md border border-border px-3 text-sm outline-none focus:ring-2 focus:ring-sky-200"
              />
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

            <div className="mt-4 rounded-md bg-muted p-3 text-sm text-muted-foreground">
              {t("workspace.shotsSourceFromScenario")}
            </div>

        {shotPlans.length === 0 ? (
          <div className="mt-3 rounded-md bg-muted p-3 text-sm text-muted-foreground">
            {t("workspace.shotsNone")}
          </div>
        ) : (
          <>
            <label className="mt-3 block text-sm font-medium" htmlFor="shotPlan">
              {t("workspace.shotsSelect")}
            </label>
            <select
              id="shotPlan"
              value={selectedShotPlanId}
              onChange={(event) => {
                const nextShotPlanId = event.target.value;
                const nextShotPlan =
                  shotPlans.find((shotPlan) => shotPlan.id === nextShotPlanId) ??
                  null;
                setSelectedShotPlanId(nextShotPlanId);
                setSelectedShotIds(
                  nextShotPlan?.shots.map((shot) => shot.id) ?? [],
                );
                setRawStoryRequest(null);
                setRawStoryResponse(null);
                setOpenShotAttributePanelIds({});
                if (nextShotPlan) {
                  setShotDurationSeconds(nextShotPlan.durationSeconds);
                }
              }}
              className="mt-2 h-10 w-full rounded-md border border-border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-sky-200"
            >
              {shotPlans.map((shotPlan) => (
                <option key={shotPlan.id} value={shotPlan.id}>
                  {shotPlan.name}
                </option>
              ))}
            </select>

            {selectedShotPlan ? (
              <div className="mt-4 grid gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <input
                    value={selectedShotPlan.name}
                    onChange={(event) =>
                      updateSelectedShotPlan((shotPlan) => ({
                        ...shotPlan,
                        name: event.target.value,
                      }))
                    }
                    aria-label={t("workspace.shotsName")}
                    className="h-10 min-w-0 flex-1 rounded-md border border-border px-3 text-sm font-medium outline-none focus:ring-2 focus:ring-sky-200"
                  />
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

                {selectedShotPlan.shots.map((shot, shotIndex) => {
                  const checked = selectedShotIds.includes(shot.id);
                  const generatedShotPrompt = generatedShotPrompts[shot.id];
                  const shotAttributes = shot.attributes.filter(
                    (attribute) => !isDialogueAttribute(attribute),
                  );
                  const isShotAttributesOpen =
                    openShotAttributePanelIds[shot.id] ?? false;
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
                        <aside className="order-2 min-w-0 xl:col-start-2 xl:row-start-1 xl:order-none">
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
                                    {t("workspace.templateAttributesTitle")}
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
                                          aria-label={t(
                                            "workspace.shotsAttributeValue",
                                          )}
                                          className="mt-2 h-9 w-full rounded-md border border-border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-sky-200"
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
                                updateShotDialogue(shot.id, event.target.value)
                              }
                              placeholder={t("workspace.shotDialoguePlaceholder")}
                              className="mt-2 w-full rounded-md border border-border bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-sky-200"
                            />
                          </label>
                          {renderMediaUpload(shot)}
                          <Button
                            type="button"
                            className="mt-3 w-fit gap-2"
                            onClick={() => createShotPrompt(shot)}
                          >
                            <Sparkles size={15} />
                            {t("workspace.shotPromptGenerate")}
                          </Button>

                          {generatedShotPrompt ? (
                            <div className="relative mt-3 rounded-md border border-sky-100 bg-white p-3 pr-12 text-sm leading-6 text-foreground shadow-sm">
                              <button
                                type="button"
                                className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-sky-200"
                                aria-label={t("workspace.shotPromptCopy")}
                                title={t("workspace.shotPromptCopy")}
                                onClick={() =>
                                  void copyShotPrompt(generatedShotPrompt)
                                }
                              >
                                <Copy size={15} />
                              </button>
                              <pre className="whitespace-pre-wrap break-words font-sans">
                                {generatedShotPrompt}
                              </pre>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </>
        )}
          </>
        ) : null}
      </div>
    );
  }

  function renderTemplateSelector() {
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
            <p className="mt-1 text-sm text-muted-foreground">
              {templateHelp}
            </p>
          </button>
          <Link
            href="/templates"
            className="inline-flex h-9 items-center rounded-md border border-border bg-white px-3 text-sm font-medium text-foreground transition hover:bg-muted"
          >
            {t("workspace.templateCreateLink")}
          </Link>
        </div>

        {isTemplateStepOpen ? (
          <>
        {templates.length === 0 ? (
          <div className="mt-3 rounded-md bg-muted p-3 text-sm text-muted-foreground">
            {t("workspace.templateNone")}
          </div>
        ) : (
          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="min-w-0 xl:col-start-1 xl:row-start-1">
              <label className="block text-sm font-medium" htmlFor="template">
                {t("workspace.templateSelect")}
              </label>
              <select
                id="template"
                value={selectedTemplateId}
                onChange={(event) => {
                  setSelectedTemplateId(event.target.value);
                  setSelectedOptionIds({});
                  setGeneratedShotPrompts({});
                  setTemplateAnalysisCompact("");
                  setTemplateAnalysisErrorMessage("");
                  setRawTemplateRequest(null);
                  setRawTemplateResponse(null);
                  setRawShotRequest(null);
                  setRawShotResponse(null);
                  setShotGenerationErrorMessage("");
                  setShotGenerationSuccessMessage("");
                  setRawProductRequest(null);
                  setRawProductResponse(null);
                  setIsTemplateAttributesOpen(false);
                  setCollapsedTemplateAttributeIds({});
                }}
                className="mt-2 h-10 w-full rounded-md border border-border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-sky-200"
              >
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>

              {flowType === "script" ? (
                <div className="mt-4 grid gap-4">
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
                    }}
                  />
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
                                          [attribute.id]: !isAttributeCollapsed,
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
                                      label={t("workspace.scenarioHelperOpen")}
                                      onToggle={setOpenScenarioHelperId}
                                      openHelperId={openScenarioHelperId}
                                      translateLabel={t(
                                        "workspace.scenarioHelperTranslate",
                                      )}
                                    />
                                    <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                                      {t("workspace.templateSelectedCount", {
                                        count: selectedCount,
                                      })}
                                    </span>
                                  </div>
                                </div>
                                {!isAttributeCollapsed ? (
                                  <div className="mt-3 grid gap-2">
                                    {attribute.options.map(
                                      (option, optionIndex) => {
                                        const checked = (
                                          selectedOptionIds[attribute.id] ?? []
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
                                              description={option.description}
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

  return (
    <>
      <div
        className={
          flowType === "script"
            ? "grid gap-5"
            : "grid gap-5 xl:grid-cols-[1.08fr_0.92fr]"
        }
      >
        {flowType === "script" ? (
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
