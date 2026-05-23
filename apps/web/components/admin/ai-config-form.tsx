"use client";

import { type ReactNode, useMemo, useState } from "react";
import type { AiConfig, ContentMode } from "@videoai/contracts";
import { ChevronDown, ChevronRight, KeyRound, Loader2, Save, TestTube2 } from "lucide-react";
import { useI18n } from "../i18n/language-provider";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { FeedbackToast, useFeedbackToast } from "../ui/feedback-toast";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? "";

type ApiSuccess<T> = {
  data: T;
};

type KeyTarget = "prompt" | "video";
type ConfigSectionKey = "content" | "site" | "prompt" | "video";
type ProviderKeyStatus = AiConfig["videoKeyStatus"];

type TestConnectionResponse = {
  provider: string;
  model: string;
  status: "success" | "failed";
  keySource: "input" | "stored" | "env" | "missing";
  message: string;
};

const providerSuggestions = ["gemini", "chatgpt", "openai", "veo"];

const modelSuggestionsByProvider: Record<string, string[]> = {
  gemini: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"],
  chatgpt: ["gpt-5.5", "gpt-5.5-chat-latest", "gpt-5.4", "gpt-5.4-mini", "gpt-5.4-nano"],
  openai: ["gpt-5.5", "gpt-5.5-chat-latest", "gpt-5.4", "gpt-5.4-mini", "gpt-5.4-nano"],
  veo: ["veo-default", "veo-3.1", "veo-3.1-fast"],
};

function normalizeProvider(value: string) {
  return value.trim().toLowerCase();
}

function modelSuggestionsFor(provider: string) {
  return modelSuggestionsByProvider[normalizeProvider(provider)] ?? [];
}

function keyStatusVariant(status: ProviderKeyStatus) {
  return status === "missing" ? "warning" : "success";
}

function keyStatusLabel(status: ProviderKeyStatus, t: ReturnType<typeof useI18n>["t"]) {
  if (status === "configured") {
    return t("adminConfig.keyStatusConfigured");
  }
  return t("adminConfig.keyStatusMissing");
}

type AiConfigFormProps = {
  config: AiConfig;
};

export function AiConfigForm({ config }: AiConfigFormProps) {
  const { t } = useI18n();
  const { clearToast, showToast, toast } = useFeedbackToast();
  const [contentMode, setContentMode] = useState<ContentMode>(config.contentMode);
  const [showUserMasterPrompts, setShowUserMasterPrompts] = useState(
    config.showUserMasterPrompts,
  );
  const [promptProvider, setPromptProvider] = useState(config.promptProvider);
  const [promptModel, setPromptModel] = useState(config.promptModel);
  const [promptApiKey, setPromptApiKey] = useState("");
  const [promptKeyStatus, setPromptKeyStatus] = useState(config.promptKeyStatus);
  const [videoProvider, setVideoProvider] = useState(config.videoProvider);
  const [videoModel, setVideoModel] = useState(config.videoModel);
  const [videoApiKey, setVideoApiKey] = useState("");
  const [videoKeyStatus, setVideoKeyStatus] = useState(config.videoKeyStatus);
  const [updatedAt, setUpdatedAt] = useState(config.updatedAt);
  const [expandedSections, setExpandedSections] = useState<Record<ConfigSectionKey, boolean>>({
    content: false,
    site: false,
    prompt: false,
    video: false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [testingTarget, setTestingTarget] = useState<KeyTarget | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [promptKeyMessage, setPromptKeyMessage] = useState("");
  const [videoKeyMessage, setVideoKeyMessage] = useState("");

  const promptModelSuggestions = useMemo(
    () => modelSuggestionsFor(promptProvider),
    [promptProvider],
  );
  const videoModelSuggestions = useMemo(
    () => modelSuggestionsFor(videoProvider),
    [videoProvider],
  );

  async function saveConfig() {
    setIsSaving(true);
    setStatusMessage("");
    setErrorMessage("");
    setPromptKeyMessage("");
    setVideoKeyMessage("");

    const trimmedPromptApiKey = promptApiKey.trim();
    const trimmedVideoApiKey = videoApiKey.trim();

    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/admin/ai-config`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          "x-request-id": `web-${Date.now()}`,
        },
        body: JSON.stringify({
          contentMode,
          showUserMasterPrompts,
          promptProvider: normalizeProvider(promptProvider),
          promptModel: promptModel.trim(),
          ...(trimmedPromptApiKey ? { promptApiKey: trimmedPromptApiKey } : {}),
          videoProvider: normalizeProvider(videoProvider),
          videoModel: videoModel.trim(),
          ...(trimmedVideoApiKey ? { videoApiKey: trimmedVideoApiKey } : {}),
        }),
      });

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as ApiSuccess<AiConfig>;
      setContentMode(payload.data.contentMode);
      setShowUserMasterPrompts(payload.data.showUserMasterPrompts);
      setPromptProvider(payload.data.promptProvider);
      setPromptModel(payload.data.promptModel);
      setPromptKeyStatus(payload.data.promptKeyStatus);
      setVideoProvider(payload.data.videoProvider);
      setVideoModel(payload.data.videoModel);
      setVideoKeyStatus(payload.data.videoKeyStatus);
      setUpdatedAt(payload.data.updatedAt);
      if (trimmedPromptApiKey) {
        setPromptApiKey("");
        setPromptKeyMessage(t("adminConfig.keySaved"));
      }
      if (trimmedVideoApiKey) {
        setVideoApiKey("");
        setVideoKeyMessage(t("adminConfig.keySaved"));
      }
      setStatusMessage(t("adminConfig.saved"));
      showToast({ type: "success", message: t("adminConfig.saved") });
    } catch (error) {
      const message = error instanceof Error ? error.message : t("adminConfig.saveFailed");
      setErrorMessage(message);
      showToast({ type: "error", message });
    } finally {
      setIsSaving(false);
    }
  }

  async function testProvider(target: KeyTarget) {
    const provider = target === "prompt" ? promptProvider : videoProvider;
    const model = target === "prompt" ? promptModel : videoModel;
    const apiKey = target === "prompt" ? promptApiKey : videoApiKey;
    const setMessage = target === "prompt" ? setPromptKeyMessage : setVideoKeyMessage;

    if (!provider.trim() || !model.trim()) {
      const message = t("adminConfig.providerModelRequired");
      setMessage(message);
      showToast({ type: "error", message });
      return;
    }

    setTestingTarget(target);
    setMessage("");
    setErrorMessage("");

    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/admin/ai-config/test-connection`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-request-id": `web-${Date.now()}`,
        },
        body: JSON.stringify({
          provider: normalizeProvider(provider),
          model: model.trim(),
          ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
        }),
      });

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as ApiSuccess<TestConnectionResponse>;
      if (payload.data.keySource === "stored") {
        if (target === "prompt") {
          setPromptKeyStatus("configured");
        } else {
          setVideoKeyStatus("configured");
        }
      }
      if (payload.data.keySource === "missing") {
        if (target === "prompt") {
          setPromptKeyStatus("missing");
        } else {
          setVideoKeyStatus("missing");
        }
      }
      const message = `${payload.data.status === "success" ? t("adminConfig.testSuccess") : t("adminConfig.testFailed")}: ${
        payload.data.message
      }`;
      setMessage(message);
      showToast({ type: payload.data.status === "success" ? "success" : "error", message });
    } catch (error) {
      const message = error instanceof Error ? error.message : t("adminConfig.testFailed");
      setMessage(message);
      showToast({ type: "error", message });
    } finally {
      setTestingTarget(null);
    }
  }

  function toggleSection(section: ConfigSectionKey) {
    setExpandedSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  }

  function renderSaveControls() {
    return (
      <div className="flex flex-wrap items-center justify-end gap-3">
        {updatedAt ? (
          <span className="text-sm text-muted-foreground">
            {t("adminConfig.updated", {
              date: new Date(updatedAt).toLocaleString(),
            })}
          </span>
        ) : null}
        {statusMessage ? <Badge variant="success">{statusMessage}</Badge> : null}
        <Button
          type="button"
          className="gap-2"
          disabled={isSaving}
          onClick={() => void saveConfig()}
        >
          {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {t("adminConfig.save")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <FeedbackToast toast={toast} onClose={clearToast} />
      {renderSaveControls()}

      <div className="space-y-3">
        <CollapsibleConfigSection
          title={t("adminConfig.contentMode")}
          isOpen={expandedSections.content}
          onToggle={() => toggleSection("content")}
          summary={contentMode === "script" ? t("adminConfig.createScript") : t("adminConfig.createVideo")}
        >
          <div className="grid gap-3">
            <button
              type="button"
              onClick={() => setContentMode("script")}
              className={`rounded-md border p-4 text-left transition ${
                contentMode === "script"
                  ? "border-sky-300 bg-sky-50"
                  : "border-border bg-white hover:bg-muted"
              }`}
            >
              <div className="font-medium">{t("adminConfig.createScript")}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {t("adminConfig.createScriptHelp")}
              </div>
            </button>
            <button
              type="button"
              onClick={() => setContentMode("video")}
              className={`rounded-md border p-4 text-left transition ${
                contentMode === "video"
                  ? "border-sky-300 bg-sky-50"
                  : "border-border bg-white hover:bg-muted"
              }`}
            >
              <div className="font-medium">{t("adminConfig.createVideo")}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {t("adminConfig.createVideoHelp")}
              </div>
            </button>
          </div>
        </CollapsibleConfigSection>

        <CollapsibleConfigSection
          title={t("adminConfig.siteConfig")}
          isOpen={expandedSections.site}
          onToggle={() => toggleSection("site")}
          summary={`${t("adminConfig.showUserMasterPrompts")}: ${
            showUserMasterPrompts ? t("common.yes") : t("common.no")
          }`}
        >
          <label className="block text-sm">
            <span className="font-medium">
              {t("adminConfig.showUserMasterPrompts")}
            </span>
            <select
              value={showUserMasterPrompts ? "yes" : "no"}
              onChange={(event) =>
                setShowUserMasterPrompts(event.target.value === "yes")
              }
              className="mt-2 h-10 w-full rounded-md border border-border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-sky-200"
            >
              <option value="no">{t("common.no")}</option>
              <option value="yes">{t("common.yes")}</option>
            </select>
          </label>
          <p className="mt-3 text-sm text-muted-foreground">
            {t("adminConfig.showUserMasterPromptsHelp")}
          </p>
        </CollapsibleConfigSection>

        <CollapsibleConfigSection
          title={t("adminConfig.promptProvider")}
          isOpen={expandedSections.prompt}
          onToggle={() => toggleSection("prompt")}
          summary={`${normalizeProvider(promptProvider)} / ${promptModel}`}
          meta={
            <Badge variant={keyStatusVariant(promptKeyStatus)}>
              {keyStatusLabel(promptKeyStatus, t)}
            </Badge>
          }
        >
          <div className="space-y-4">
            <TextField
              label={t("adminConfig.provider")}
              value={promptProvider}
              onChange={setPromptProvider}
              placeholder="chatgpt"
            />
            <SuggestionChips
              options={providerSuggestions}
              onSelect={(value) => setPromptProvider(value)}
            />
            <TextField
              label={t("adminConfig.model")}
              value={promptModel}
              onChange={setPromptModel}
              placeholder="gpt-5.5"
            />
            <SuggestionChips
              options={promptModelSuggestions}
              onSelect={(value) => setPromptModel(value)}
            />
            <p className="text-sm text-muted-foreground">
              {t("adminConfig.promptProviderHelp")}
            </p>
            <ProviderKeyBox
              apiKey={promptApiKey}
              isTesting={testingTarget === "prompt"}
              message={promptKeyMessage}
              onApiKeyChange={setPromptApiKey}
              onTest={() => void testProvider("prompt")}
              status={promptKeyStatus}
              t={t}
            />
          </div>
        </CollapsibleConfigSection>

        <CollapsibleConfigSection
          title={t("adminConfig.videoProvider")}
          isOpen={expandedSections.video}
          onToggle={() => toggleSection("video")}
          summary={`${normalizeProvider(videoProvider)} / ${videoModel}`}
          meta={
            <Badge variant={keyStatusVariant(videoKeyStatus)}>
              {keyStatusLabel(videoKeyStatus, t)}
            </Badge>
          }
        >
          <div className="space-y-4">
            <TextField
              label={t("adminConfig.provider")}
              value={videoProvider}
              onChange={setVideoProvider}
              placeholder="veo"
            />
            <SuggestionChips
              options={providerSuggestions}
              onSelect={(value) => setVideoProvider(value)}
            />
            <TextField
              label={t("adminConfig.model")}
              value={videoModel}
              onChange={setVideoModel}
              placeholder="veo-default"
            />
            <SuggestionChips
              options={videoModelSuggestions}
              onSelect={(value) => setVideoModel(value)}
            />
            <ProviderKeyBox
              apiKey={videoApiKey}
              isTesting={testingTarget === "video"}
              message={videoKeyMessage}
              onApiKeyChange={setVideoApiKey}
              onTest={() => void testProvider("video")}
              status={videoKeyStatus}
              t={t}
            />
          </div>
        </CollapsibleConfigSection>
      </div>

      <p className="text-sm text-muted-foreground">{t("adminConfig.chatGptApiNote")}</p>

      {renderSaveControls()}
      {errorMessage ? <p className="text-right text-sm text-red-600">{errorMessage}</p> : null}
    </div>
  );
}

function CollapsibleConfigSection({
  children,
  isOpen,
  meta,
  onToggle,
  summary,
  title,
}: {
  children: ReactNode;
  isOpen: boolean;
  meta?: ReactNode;
  onToggle: () => void;
  summary?: string;
  title: string;
}) {
  return (
    <section className="rounded-lg border border-border bg-white shadow-sm">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left outline-none transition hover:bg-muted/60 focus:ring-2 focus:ring-sky-200"
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <span className="flex min-w-0 items-center gap-2">
          {isOpen ? (
            <ChevronDown size={18} className="shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight size={18} className="shrink-0 text-muted-foreground" />
          )}
          <span className="min-w-0">
            <span className="block font-semibold text-foreground">{title}</span>
            {summary ? (
              <span className="mt-1 block truncate text-sm text-muted-foreground">
                {summary}
              </span>
            ) : null}
          </span>
        </span>
        {meta ? <span className="shrink-0">{meta}</span> : null}
      </button>
      {isOpen ? <div className="border-t border-border p-4">{children}</div> : null}
    </section>
  );
}

function ProviderKeyBox({
  apiKey,
  isTesting,
  message,
  onApiKeyChange,
  onTest,
  status,
  t,
}: {
  apiKey: string;
  isTesting: boolean;
  message: string;
  onApiKeyChange: (value: string) => void;
  onTest: () => void;
  status: ProviderKeyStatus;
  t: ReturnType<typeof useI18n>["t"];
}) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <KeyRound size={15} />
          {t("adminConfig.apiKey")}
        </div>
        <Badge variant={keyStatusVariant(status)}>
          {keyStatusLabel(status, t)}
        </Badge>
      </div>
      <input
        type="password"
        value={apiKey}
        onChange={(event) => onApiKeyChange(event.target.value)}
        placeholder={t("adminConfig.apiKeyPlaceholder")}
        autoComplete="off"
        className="h-10 w-full rounded-md border border-border px-3 text-sm outline-none focus:ring-2 focus:ring-sky-200"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          className="gap-2"
          disabled={isTesting}
          onClick={onTest}
          variant="secondary"
        >
          {isTesting ? <Loader2 size={15} className="animate-spin" /> : <TestTube2 size={15} />}
          {t("adminConfig.testConnect")}
        </Button>
      </div>
      {message ? <p className="mt-2 text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}

function SuggestionChips({
  options,
  onSelect,
}: {
  options: string[];
  onSelect: (value: string) => void;
}) {
  if (options.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-wrap gap-2" aria-label="Suggestions">
      {options.map((option) => (
        <button
          type="button"
          key={option}
          onClick={() => onSelect(option)}
          className="h-8 rounded-md border border-border px-2 text-xs font-medium text-muted-foreground transition hover:border-sky-300 hover:text-foreground"
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-10 w-full rounded-md border border-border px-3 text-sm outline-none focus:ring-2 focus:ring-sky-200"
      />
    </label>
  );
}
