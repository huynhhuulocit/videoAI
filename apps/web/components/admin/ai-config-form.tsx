"use client";

import { useMemo, useState } from "react";
import type { AiConfig, ContentMode } from "@videoai/contracts";
import { KeyRound, Loader2, Save, TestTube2 } from "lucide-react";
import { useI18n } from "../i18n/language-provider";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? "";

type ApiSuccess<T> = {
  data: T;
};

type KeyTarget = "prompt" | "video";
type ProviderKeyStatus = AiConfig["videoKeyStatus"];
type ProviderKeyResponse = {
  provider: string;
  keyStatus: ProviderKeyStatus;
};

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
  const [contentMode, setContentMode] = useState<ContentMode>(config.contentMode);
  const [promptProvider, setPromptProvider] = useState(config.promptProvider);
  const [promptModel, setPromptModel] = useState(config.promptModel);
  const [promptApiKey, setPromptApiKey] = useState("");
  const [promptKeyStatus, setPromptKeyStatus] = useState(config.promptKeyStatus);
  const [videoProvider, setVideoProvider] = useState(config.videoProvider);
  const [videoModel, setVideoModel] = useState(config.videoModel);
  const [videoApiKey, setVideoApiKey] = useState("");
  const [videoKeyStatus, setVideoKeyStatus] = useState(config.videoKeyStatus);
  const [updatedAt, setUpdatedAt] = useState(config.updatedAt);
  const [isSaving, setIsSaving] = useState(false);
  const [savingKeyTarget, setSavingKeyTarget] = useState<KeyTarget | null>(null);
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

    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/admin/ai-config`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          "x-request-id": `web-${Date.now()}`,
        },
        body: JSON.stringify({
          contentMode,
          promptProvider: normalizeProvider(promptProvider),
          promptModel: promptModel.trim(),
          videoProvider: normalizeProvider(videoProvider),
          videoModel: videoModel.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as ApiSuccess<AiConfig>;
      setContentMode(payload.data.contentMode);
      setPromptProvider(payload.data.promptProvider);
      setPromptModel(payload.data.promptModel);
      setPromptKeyStatus(payload.data.promptKeyStatus);
      setVideoProvider(payload.data.videoProvider);
      setVideoModel(payload.data.videoModel);
      setVideoKeyStatus(payload.data.videoKeyStatus);
      setUpdatedAt(payload.data.updatedAt);
      setStatusMessage(t("adminConfig.saved"));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t("adminConfig.saveFailed"),
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function saveProviderKey(target: KeyTarget) {
    const provider = target === "prompt" ? promptProvider : videoProvider;
    const apiKey = target === "prompt" ? promptApiKey : videoApiKey;
    const setMessage = target === "prompt" ? setPromptKeyMessage : setVideoKeyMessage;

    if (!provider.trim() || !apiKey.trim()) {
      setMessage(t("adminConfig.keyRequired"));
      return;
    }

    setSavingKeyTarget(target);
    setMessage("");
    setErrorMessage("");

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/v1/admin/ai-config/provider-keys/${encodeURIComponent(
          normalizeProvider(provider),
        )}`,
        {
          method: "PUT",
          headers: {
            "content-type": "application/json",
            "x-request-id": `web-${Date.now()}`,
          },
          body: JSON.stringify({ apiKey: apiKey.trim() }),
        },
      );

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as ApiSuccess<ProviderKeyResponse>;
      if (target === "prompt") {
        setPromptProvider(payload.data.provider);
        setPromptKeyStatus(payload.data.keyStatus);
        setPromptApiKey("");
      } else {
        setVideoProvider(payload.data.provider);
        setVideoKeyStatus(payload.data.keyStatus);
        setVideoApiKey("");
      }
      setMessage(t("adminConfig.keySaved"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("adminConfig.keySaveFailed"));
    } finally {
      setSavingKeyTarget(null);
    }
  }

  async function testProvider(target: KeyTarget) {
    const provider = target === "prompt" ? promptProvider : videoProvider;
    const model = target === "prompt" ? promptModel : videoModel;
    const apiKey = target === "prompt" ? promptApiKey : videoApiKey;
    const setMessage = target === "prompt" ? setPromptKeyMessage : setVideoKeyMessage;

    if (!provider.trim() || !model.trim()) {
      setMessage(t("adminConfig.providerModelRequired"));
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
      setMessage(
        `${payload.data.status === "success" ? t("adminConfig.testSuccess") : t("adminConfig.testFailed")}: ${
          payload.data.message
        }`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("adminConfig.testFailed"));
    } finally {
      setTestingTarget(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-3">
        <Card title={t("adminConfig.contentMode")}>
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
        </Card>

        <Card title={t("adminConfig.promptProvider")}>
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
              isSavingKey={savingKeyTarget === "prompt"}
              isTesting={testingTarget === "prompt"}
              message={promptKeyMessage}
              onApiKeyChange={setPromptApiKey}
              onSaveKey={() => void saveProviderKey("prompt")}
              onTest={() => void testProvider("prompt")}
              status={promptKeyStatus}
              t={t}
            />
          </div>
        </Card>

        <Card title={t("adminConfig.videoProvider")}>
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
              isSavingKey={savingKeyTarget === "video"}
              isTesting={testingTarget === "video"}
              message={videoKeyMessage}
              onApiKeyChange={setVideoApiKey}
              onSaveKey={() => void saveProviderKey("video")}
              onTest={() => void testProvider("video")}
              status={videoKeyStatus}
              t={t}
            />
          </div>
        </Card>
      </div>

      <p className="text-sm text-muted-foreground">{t("adminConfig.chatGptApiNote")}</p>

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
      {errorMessage ? <p className="text-right text-sm text-red-600">{errorMessage}</p> : null}
    </div>
  );
}

function ProviderKeyBox({
  apiKey,
  isSavingKey,
  isTesting,
  message,
  onApiKeyChange,
  onSaveKey,
  onTest,
  status,
  t,
}: {
  apiKey: string;
  isSavingKey: boolean;
  isTesting: boolean;
  message: string;
  onApiKeyChange: (value: string) => void;
  onSaveKey: () => void;
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
          disabled={isSavingKey}
          onClick={onSaveKey}
          variant="secondary"
        >
          {isSavingKey ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
          {t("adminConfig.saveKey")}
        </Button>
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
