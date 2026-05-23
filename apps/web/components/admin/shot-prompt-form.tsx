"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ADMIN_MASTER_PROMPT_PLACEHOLDERS,
  type AttributeCatalog,
  type AttributeCatalogAttribute,
  type AttributeCatalogConfig,
  DEFAULT_SCRIPT_GENERATION_OUTPUT_FORMAT,
  DEFAULT_SCRIPT_GENERATION_PROMPT,
  DEFAULT_SHOT_GENERATION_OUTPUT_FORMAT,
  DEFAULT_SHOT_GENERATION_PROMPT,
  DEFAULT_SINGLE_SHOT_MASTER_PROMPT,
  DEFAULT_SINGLE_SHOT_OUTPUT_FORMAT,
  DEFAULT_TEMPLATE_SELECTION_OUTPUT_FORMAT,
  DEFAULT_TEMPLATE_SELECTION_PROMPT,
  MASTER_PROMPT_ATTRIBUTES_PLACEHOLDER,
  MASTER_PROMPT_OUTPUT_FORMAT_PLACEHOLDER,
  type MasterPrompt,
  type MasterPromptAttribute,
  type MasterPromptAttributeConfig,
  type MasterPromptAttributeSelection,
  type MasterPromptConfig,
  type MasterPromptType,
} from "@videoai/contracts";
import { ArrowLeft, CheckCircle2, FileText, Info, Loader2, Pencil, Plus, Save, Star, Trash2 } from "lucide-react";
import { useI18n } from "../i18n/language-provider";
import { AiDebugDialog, type AiDebugDialogData } from "../ui/ai-debug-dialog";
import { Badge } from "../ui/badge";
import { Button, LinkButton } from "../ui/button";
import { Card } from "../ui/card";
import { FeedbackToast, useFeedbackToast } from "../ui/feedback-toast";
import { MasterPromptField } from "../ui/master-prompt-field";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? "";

type ApiSuccess<T> = {
  data: T;
};

type MasterPromptListProps = {
  config: MasterPromptConfig;
  type: MasterPromptType;
};

type MasterPromptEditorProps = MasterPromptListProps & {
  promptId?: string | undefined;
  source?: string | undefined;
};

function typeTitle(type: MasterPromptType) {
  if (type === "scenario") {
    return "Scenario";
  }
  if (type === "shots") {
    return "Shots";
  }
  if (type === "shot") {
    return "Shot";
  }
  return "Story Content";
}

function typeRouteSegment(type: MasterPromptType) {
  return type === "scripts" ? "story" : type;
}

function masterPromptListHref(type: MasterPromptType) {
  return `/admin/${typeRouteSegment(type)}/master-prompt`;
}

function masterPromptNewHref(type: MasterPromptType, source?: "built-in") {
  const href = `${masterPromptListHref(type)}/new`;
  return source ? `${href}?source=${source}` : href;
}

function masterPromptEditHref(type: MasterPromptType, prompt: MasterPrompt) {
  return prompt.isBuiltIn
    ? masterPromptNewHref(type, "built-in")
    : `${masterPromptListHref(type)}/${encodeURIComponent(prompt.id)}`;
}

function defaultPromptTemplate(type: MasterPromptType) {
  if (type === "scenario") {
    return DEFAULT_TEMPLATE_SELECTION_PROMPT;
  }
  if (type === "shots") {
    return DEFAULT_SHOT_GENERATION_PROMPT;
  }
  if (type === "shot") {
    return DEFAULT_SINGLE_SHOT_MASTER_PROMPT;
  }
  return DEFAULT_SCRIPT_GENERATION_PROMPT;
}

function defaultOutputFormatTemplate(type: MasterPromptType) {
  if (type === "scenario") {
    return DEFAULT_TEMPLATE_SELECTION_OUTPUT_FORMAT;
  }
  if (type === "shots") {
    return DEFAULT_SHOT_GENERATION_OUTPUT_FORMAT;
  }
  if (type === "shot") {
    return DEFAULT_SINGLE_SHOT_OUTPUT_FORMAT;
  }
  return DEFAULT_SCRIPT_GENERATION_OUTPUT_FORMAT;
}

function emptyAttributeSelection(): MasterPromptAttributeSelection {
  return { attributes: [] };
}

function getPromptAttributeSelection(prompt: MasterPrompt | null | undefined): MasterPromptAttributeSelection {
  return prompt?.attributeSelection ?? emptyAttributeSelection();
}

function getPromptWorkflowAttributeSelection(prompt: MasterPrompt | null | undefined): MasterPromptAttributeSelection {
  return prompt?.workflowAttributeSelection ?? emptyAttributeSelection();
}

function workflowCatalogType(type: MasterPromptType) {
  return type === "scripts" ? "story" : type;
}

function workflowAttributeTitle(type: MasterPromptType) {
  if (type === "scenario") {
    return "Scenario Attribute";
  }
  if (type === "shots") {
    return "Shots Attribute";
  }
  if (type === "shot") {
    return "Shot Attribute";
  }
  return "Story Attribute";
}

function workflowAttributePlaceholder(type: MasterPromptType) {
  if (type === "scenario") {
    return "{scenarioAttributes}";
  }
  if (type === "shots") {
    return "{shotsAttributes}";
  }
  if (type === "shot") {
    return "{shotAttributes}";
  }
  return "{storyAttributes}";
}

function getGroup(config: MasterPromptConfig, type: MasterPromptType) {
  const group = config.groups.find((candidate) => candidate.type === type);
  if (!group) {
    throw new Error(`Master prompt group "${type}" is missing.`);
  }
  return group;
}

function isSelected(
  selection: MasterPromptAttributeSelection,
  attributeId: string,
  optionId: string,
) {
  return selection.attributes.some(
    (attribute) =>
      attribute.attributeId === attributeId && attribute.optionIds.includes(optionId),
  );
}

function toggleSelection(
  selection: MasterPromptAttributeSelection,
  attributeId: string,
  optionId: string,
  checked: boolean,
): MasterPromptAttributeSelection {
  const existing = selection.attributes.find((attribute) => attribute.attributeId === attributeId);
  const otherAttributes = selection.attributes.filter((attribute) => attribute.attributeId !== attributeId);
  const nextOptionIds = checked
    ? [...new Set([...(existing?.optionIds ?? []), optionId])]
    : (existing?.optionIds ?? []).filter((candidate) => candidate !== optionId);
  return {
    attributes:
      nextOptionIds.length > 0
        ? [...otherAttributes, { attributeId, optionIds: nextOptionIds }]
        : otherAttributes,
  };
}

function selectedOptionCount(selection: MasterPromptAttributeSelection) {
  return selection.attributes.reduce((total, attribute) => total + attribute.optionIds.length, 0);
}

function normalizeSelectionForAttributes(
  selection: MasterPromptAttributeSelection,
  attributes: Array<Pick<AttributeCatalogAttribute | MasterPromptAttribute, "id" | "options">>,
): MasterPromptAttributeSelection {
  const attributesById = new Map(attributes.map((attribute) => [attribute.id, attribute]));
  return {
    attributes: selection.attributes.flatMap((selectedAttribute) => {
      const attribute = attributesById.get(selectedAttribute.attributeId);
      if (!attribute) {
        return [];
      }
      const optionIds = new Set(attribute.options.map((option) => option.id));
      const selectedOptionIds = [...new Set(selectedAttribute.optionIds)].filter((optionId) =>
        optionIds.has(optionId),
      );
      return selectedOptionIds.length > 0
        ? [{ attributeId: selectedAttribute.attributeId, optionIds: selectedOptionIds }]
        : [];
    }),
  };
}

function areSelectionsEqual(
  left: MasterPromptAttributeSelection,
  right: MasterPromptAttributeSelection,
) {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function readApiError(response: Response) {
  const payload = await response.json().catch(() => null) as
    | { error?: { message?: string }; message?: string }
    | null;
  return payload?.error?.message ?? payload?.message ?? `API request failed with status ${response.status}`;
}

function renderMasterPromptAttributePreview(
  content: string,
  selection: MasterPromptAttributeSelection,
  config: MasterPromptAttributeConfig | null,
) {
  if (!content.includes(MASTER_PROMPT_ATTRIBUTES_PLACEHOLDER)) {
    return content;
  }
  if (!config || config.attributes.length === 0) {
    throw new Error("Master Prompt Config is required before using {masterPromptAttributes}.");
  }
  const normalizedSelection = normalizeSelectionForAttributes(selection, config.attributes);
  const lines = normalizedSelection.attributes.flatMap((selectedAttribute) => {
    const attribute = config.attributes.find((candidate) => candidate.id === selectedAttribute.attributeId);
    if (!attribute) {
      throw new Error(`Master Prompt Attribute "${selectedAttribute.attributeId}" is not configured.`);
    }
    const selectedOptions = selectedAttribute.optionIds.map((optionId) => {
      const option = attribute.options.find((candidate) => candidate.id === optionId);
      if (!option) {
        throw new Error(`Master Prompt Attribute option "${optionId}" is not configured.`);
      }
      return option.name;
    });
    return selectedOptions.length > 0
      ? [`${attribute.name}: ${selectedOptions.join(", ")}`]
      : [];
  });
  if (lines.length === 0) {
    throw new Error("Master Prompt Attribute selection is required for {masterPromptAttributes}.");
  }
  return content.replaceAll(MASTER_PROMPT_ATTRIBUTES_PLACEHOLDER, lines.join("\n"));
}

function renderWorkflowAttributePreview(
  content: string,
  type: MasterPromptType,
  selection: MasterPromptAttributeSelection,
  catalog: AttributeCatalog | null,
) {
  const normalizedSelection = catalog
    ? normalizeSelectionForAttributes(selection, catalog.attributes)
    : selection;
  const hasSelectedOptions = normalizedSelection.attributes.some((attribute) => attribute.optionIds.length > 0);
  if (!hasSelectedOptions) {
    return content;
  }
  const placeholder = workflowAttributePlaceholder(type);
  if (!content.includes(placeholder)) {
    return content;
  }
  if (!catalog) {
    throw new Error(`${workflowAttributeTitle(type)} catalog is required before using ${placeholder}.`);
  }
  const lines = normalizedSelection.attributes.flatMap((selectedAttribute) => {
    const attribute = catalog.attributes.find((candidate) => candidate.id === selectedAttribute.attributeId);
    if (!attribute) {
      throw new Error(`${workflowAttributeTitle(type)} "${selectedAttribute.attributeId}" is not configured.`);
    }
    const selectedOptions = selectedAttribute.optionIds.map((optionId) => {
      const option = attribute.options.find((candidate) => candidate.id === optionId);
      if (!option) {
        throw new Error(`${workflowAttributeTitle(type)} option "${optionId}" is not configured.`);
      }
      return option.name;
    });
    return selectedOptions.length > 0
      ? [`${attribute.name}: ${selectedOptions.join(", ")}`]
      : [];
  });
  if (lines.length === 0) {
    return content;
  }
  return content.replaceAll(placeholder, lines.join("\n"));
}

function renderOutputFormatPreview(content: string, outputFormat: string) {
  if (!content.includes(MASTER_PROMPT_OUTPUT_FORMAT_PLACEHOLDER)) {
    return content;
  }
  const trimmedOutputFormat = outputFormat.trim();
  if (!trimmedOutputFormat) {
    throw new Error("Output Format is required before using {outputFormat}.");
  }
  return content.replaceAll(MASTER_PROMPT_OUTPUT_FORMAT_PLACEHOLDER, trimmedOutputFormat);
}

export function MasterPromptList({ config: initialConfig, type }: MasterPromptListProps) {
  const { t } = useI18n();
  const { clearToast, showToast, toast } = useFeedbackToast();
  const [config, setConfig] = useState(initialConfig);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [busyPromptId, setBusyPromptId] = useState("");
  const [busyPromptAction, setBusyPromptAction] = useState<"default" | "delete" | null>(null);

  const activeGroup = useMemo(() => getGroup(config, type), [config, type]);

  async function refreshConfig() {
    const response = await fetch(`${apiBaseUrl}/api/v1/admin/master-prompts`, {
      headers: { "x-request-id": `web-${Date.now()}` },
    });
    if (!response.ok) {
      throw new Error(await readApiError(response));
    }
    const payload = (await response.json()) as ApiSuccess<MasterPromptConfig>;
    setConfig(payload.data);
  }

  async function deletePrompt(prompt: MasterPrompt) {
    if (prompt.isBuiltIn) {
      return;
    }
    if (prompt.isDefault) {
      const message = t("adminMasterPrompt.deleteDefaultBlocked");
      setErrorMessage(message);
      setStatusMessage("");
      showToast({ type: "error", message });
      return;
    }
    setBusyPromptId(prompt.id);
    setBusyPromptAction("delete");
    setStatusMessage("");
    setErrorMessage("");
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/v1/admin/master-prompts/${encodeURIComponent(prompt.id)}`,
        {
          method: "DELETE",
          headers: { "x-request-id": `web-${Date.now()}` },
        },
      );
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }
      await refreshConfig();
      const message = t("adminMasterPrompt.deleted");
      setStatusMessage(message);
      showToast({ type: "success", message });
    } catch (error) {
      const message = error instanceof Error ? error.message : t("adminMasterPrompt.deleteFailed");
      setErrorMessage(message);
      showToast({ type: "error", message });
    } finally {
      setBusyPromptId("");
      setBusyPromptAction(null);
    }
  }

  async function setDefaultPrompt(prompt: MasterPrompt) {
    if (prompt.isBuiltIn || prompt.isDefault) {
      return;
    }
    setBusyPromptId(prompt.id);
    setBusyPromptAction("default");
    setStatusMessage("");
    setErrorMessage("");
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/v1/admin/master-prompts/${encodeURIComponent(prompt.id)}/default`,
        {
          method: "POST",
          headers: { "x-request-id": `web-${Date.now()}` },
        },
      );
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }
      await refreshConfig();
      const message = t("adminMasterPrompt.defaultSaved");
      setStatusMessage(message);
      showToast({ type: "success", message });
    } catch (error) {
      const message = error instanceof Error ? error.message : t("adminMasterPrompt.defaultFailed");
      setErrorMessage(message);
      showToast({ type: "error", message });
    } finally {
      setBusyPromptId("");
      setBusyPromptAction(null);
    }
  }

  return (
    <div className="space-y-5">
      <FeedbackToast toast={toast} onClose={clearToast} />
      <Card
        title={`${typeTitle(type)} ${t("adminMasterPrompt.prompts")}`}
        action={
          <LinkButton href={masterPromptNewHref(type)} variant="primary" className="h-9 gap-2 px-3">
            <Plus size={16} />
            {t("adminMasterPrompt.newPrompt")}
          </LinkButton>
        }
      >
        <div className="mb-4 text-sm text-muted-foreground">
          {t("adminMasterPrompt.listHelp")}
        </div>
        {statusMessage ? (
          <div className="mb-3">
            <Badge variant="success">
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 size={13} />
                {statusMessage}
              </span>
            </Badge>
          </div>
        ) : null}
        {errorMessage ? <p className="mb-3 text-sm text-red-600">{errorMessage}</p> : null}
        <div className="space-y-3">
          {activeGroup.prompts.map((prompt) => (
            <div
              key={prompt.id}
              className="rounded-md border border-border bg-white p-4 transition hover:bg-muted"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{prompt.name}</span>
                    {prompt.isDefault ? (
                      <Badge variant="success">{t("adminMasterPrompt.defaultBadge")}</Badge>
                    ) : null}
                    {prompt.isBuiltIn ? (
                      <Badge variant="info">{t("adminMasterPrompt.builtInBadge")}</Badge>
                    ) : null}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {prompt.isBuiltIn ? t("adminMasterPrompt.builtInReadOnly") : prompt.updatedAt}
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{prompt.content}</p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <LinkButton
                    href={masterPromptEditHref(type, prompt)}
                    variant="secondary"
                    className="h-9 gap-2 px-3"
                  >
                    <Pencil size={15} />
                    {t("adminMasterPrompt.edit")}
                  </LinkButton>
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-9 gap-2 px-3"
                    disabled={Boolean(busyPromptId) || prompt.isBuiltIn || prompt.isDefault}
                    onClick={() => void setDefaultPrompt(prompt)}
                  >
                    {busyPromptId === prompt.id && busyPromptAction === "default" ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Star size={15} />
                    )}
                    {t("adminMasterPrompt.setDefault")}
                  </Button>
                  <Button
                    type="button"
                    variant={prompt.isBuiltIn || prompt.isDefault ? "secondary" : "destructive"}
                    className="h-9 gap-2 px-3"
                    disabled={Boolean(busyPromptId) || prompt.isBuiltIn}
                    onClick={() => void deletePrompt(prompt)}
                  >
                    {busyPromptId === prompt.id && busyPromptAction === "delete" ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Trash2 size={15} />
                    )}
                    {t("adminMasterPrompt.delete")}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export function MasterPromptEditor({ config, type, promptId, source }: MasterPromptEditorProps) {
  const router = useRouter();
  const { t } = useI18n();
  const { clearToast, showToast, toast } = useFeedbackToast();
  const activeGroup = useMemo(() => getGroup(config, type), [config, type]);
  const existingPrompt = promptId
    ? activeGroup.prompts.find((prompt) => prompt.id === promptId) ?? null
    : null;
  const isMissingPrompt = Boolean(promptId && !existingPrompt);
  const sourcePrompt = !promptId && source === "built-in" && activeGroup.defaultPrompt.isBuiltIn
    ? activeGroup.defaultPrompt
    : null;
  const isCreating = !promptId || Boolean(existingPrompt?.isBuiltIn);
  const initialPrompt = existingPrompt && !existingPrompt.isBuiltIn ? existingPrompt : sourcePrompt;
  const [draftName, setDraftName] = useState(
    initialPrompt && !initialPrompt.isBuiltIn ? initialPrompt.name : `${typeTitle(type)} master prompt`,
  );
  const [draftContent, setDraftContent] = useState(initialPrompt?.content ?? defaultPromptTemplate(type));
  const [draftOutputFormat, setDraftOutputFormat] = useState(
    initialPrompt?.outputFormat ?? defaultOutputFormatTemplate(type),
  );
  const [draftAttributeSelection, setDraftAttributeSelection] = useState<MasterPromptAttributeSelection>(
    getPromptAttributeSelection(initialPrompt),
  );
  const [draftWorkflowAttributeSelection, setDraftWorkflowAttributeSelection] = useState<MasterPromptAttributeSelection>(
    getPromptWorkflowAttributeSelection(initialPrompt),
  );
  const [masterPromptAttributeConfig, setMasterPromptAttributeConfig] =
    useState<MasterPromptAttributeConfig | null>(null);
  const [workflowAttributeCatalog, setWorkflowAttributeCatalog] = useState<AttributeCatalog | null>(null);
  const [workflowAttributeError, setWorkflowAttributeError] = useState("");
  const [expandedAttributeIds, setExpandedAttributeIds] = useState<Record<string, boolean>>({});
  const [expandedOptionHelpIds, setExpandedOptionHelpIds] = useState<Record<string, boolean>>({});
  const [expandedWorkflowAttributeIds, setExpandedWorkflowAttributeIds] = useState<Record<string, boolean>>({});
  const [expandedWorkflowOptionHelpIds, setExpandedWorkflowOptionHelpIds] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSettingDefault, setIsSettingDefault] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState(
    isMissingPrompt ? "Master prompt was not found or has been archived." : "",
  );
  const [debugDialog, setDebugDialog] = useState<AiDebugDialogData | null>(null);
  const isProcessing = isSaving || isDeleting || isSettingDefault;

  useEffect(() => {
    let cancelled = false;

    async function loadMasterPromptAttributeConfig() {
      try {
        const response = await fetch(`${apiBaseUrl}/api/v1/admin/master-prompt-config`, {
          headers: { "x-request-id": `web-${Date.now()}` },
        });
        if (!response.ok) {
          throw new Error(await readApiError(response));
        }
        const payload = (await response.json()) as ApiSuccess<MasterPromptAttributeConfig>;
        if (!cancelled) {
          setMasterPromptAttributeConfig(payload.data);
        }
      } catch {
        if (!cancelled) {
          setMasterPromptAttributeConfig(null);
        }
      }
    }

    async function loadWorkflowAttributeCatalog() {
      try {
        const catalogType = workflowCatalogType(type);
        const response = await fetch(`${apiBaseUrl}/api/v1/admin/attribute-catalogs?type=${catalogType}`, {
          headers: { "x-request-id": `web-${Date.now()}` },
        });
        if (!response.ok) {
          throw new Error(await readApiError(response));
        }
        const payload = (await response.json()) as ApiSuccess<AttributeCatalogConfig>;
        if (!cancelled) {
          setWorkflowAttributeCatalog(payload.data.defaultCatalog);
          setWorkflowAttributeError("");
        }
      } catch (error) {
        if (!cancelled) {
          setWorkflowAttributeCatalog(null);
          setWorkflowAttributeError(
            error instanceof Error ? error.message : `Cannot load ${workflowAttributeTitle(type)} catalog.`,
          );
        }
      }
    }

    void loadMasterPromptAttributeConfig();
    void loadWorkflowAttributeCatalog();

    return () => {
      cancelled = true;
    };
  }, [type]);

  useEffect(() => {
    if (!masterPromptAttributeConfig) {
      return;
    }
    setDraftAttributeSelection((current) => {
      const normalized = normalizeSelectionForAttributes(
        current,
        masterPromptAttributeConfig.attributes,
      );
      return areSelectionsEqual(current, normalized) ? current : normalized;
    });
  }, [masterPromptAttributeConfig]);

  useEffect(() => {
    if (!workflowAttributeCatalog) {
      return;
    }
    setDraftWorkflowAttributeSelection((current) => {
      const normalized = normalizeSelectionForAttributes(
        current,
        workflowAttributeCatalog.attributes,
      );
      return areSelectionsEqual(current, normalized) ? current : normalized;
    });
  }, [workflowAttributeCatalog]);

  async function savePrompt() {
    if (isMissingPrompt) {
      const message = "Master prompt was not found or has been archived.";
      setStatusMessage("");
      setErrorMessage(message);
      showToast({ type: "error", message });
      return;
    }
    if (!draftName.trim() || !draftContent.trim()) {
      const message = t("adminMasterPrompt.required");
      setStatusMessage("");
      setErrorMessage(message);
      showToast({ type: "error", message });
      return;
    }

    setIsSaving(true);
    setStatusMessage("");
    setErrorMessage("");

    try {
      const attributeSelection = masterPromptAttributeConfig
        ? normalizeSelectionForAttributes(
            draftAttributeSelection,
            masterPromptAttributeConfig.attributes,
          )
        : draftAttributeSelection;
      const workflowAttributeSelection = workflowAttributeCatalog
        ? normalizeSelectionForAttributes(
            draftWorkflowAttributeSelection,
            workflowAttributeCatalog.attributes,
          )
        : draftWorkflowAttributeSelection;
      const response = await fetch(
        isCreating
          ? `${apiBaseUrl}/api/v1/admin/master-prompts`
          : `${apiBaseUrl}/api/v1/admin/master-prompts/${encodeURIComponent(existingPrompt!.id)}`,
        {
          method: isCreating ? "POST" : "PATCH",
          headers: {
            "content-type": "application/json",
            "x-request-id": `web-${Date.now()}`,
          },
          body: JSON.stringify({
            ...(isCreating ? { type } : {}),
            name: draftName,
            content: draftContent,
            outputFormat: draftOutputFormat,
            attributeSelection,
            workflowAttributeSelection,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const payload = (await response.json()) as ApiSuccess<MasterPrompt>;
      const message = t("adminMasterPrompt.saved");
      setStatusMessage(message);
      showToast({ type: "success", message });
      if (isCreating) {
        router.replace(masterPromptEditHref(type, payload.data));
      }
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : t("adminMasterPrompt.saveFailed");
      setErrorMessage(message);
      showToast({ type: "error", message });
    } finally {
      setIsSaving(false);
    }
  }

  async function deletePrompt() {
    if (!existingPrompt || existingPrompt.isBuiltIn) {
      return;
    }
    if (existingPrompt.isDefault) {
      const message = t("adminMasterPrompt.deleteDefaultBlocked");
      setErrorMessage(message);
      setStatusMessage("");
      showToast({ type: "error", message });
      return;
    }

    setIsDeleting(true);
    setStatusMessage("");
    setErrorMessage("");

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/v1/admin/master-prompts/${encodeURIComponent(existingPrompt.id)}`,
        {
          method: "DELETE",
          headers: { "x-request-id": `web-${Date.now()}` },
        },
      );

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      router.replace(masterPromptListHref(type));
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : t("adminMasterPrompt.deleteFailed");
      setErrorMessage(message);
      showToast({ type: "error", message });
    } finally {
      setIsDeleting(false);
    }
  }

  async function setDefaultPrompt() {
    if (!existingPrompt || existingPrompt.isBuiltIn || existingPrompt.isDefault) {
      return;
    }

    setIsSettingDefault(true);
    setStatusMessage("");
    setErrorMessage("");

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/v1/admin/master-prompts/${encodeURIComponent(existingPrompt.id)}/default`,
        {
          method: "POST",
          headers: { "x-request-id": `web-${Date.now()}` },
        },
      );

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const message = t("adminMasterPrompt.defaultSaved");
      setStatusMessage(message);
      showToast({ type: "success", message });
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : t("adminMasterPrompt.defaultFailed");
      setErrorMessage(message);
      showToast({ type: "error", message });
    } finally {
      setIsSettingDefault(false);
    }
  }

  function openPromptPreview() {
    setStatusMessage("");
    setErrorMessage("");
    try {
      setDebugDialog({
        title: `${typeTitle(type)} master prompt`,
        help: "Exact admin preview. {masterPromptAttributes} and {outputFormat} are rendered from this draft; user runtime placeholders stay unchanged.",
        value: renderOutputFormatPreview(
          renderWorkflowAttributePreview(
            renderMasterPromptAttributePreview(
              draftContent,
              draftAttributeSelection,
              masterPromptAttributeConfig,
            ),
            type,
            draftWorkflowAttributeSelection,
            workflowAttributeCatalog,
          ),
          draftOutputFormat,
        ),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Cannot render master prompt preview.";
      setErrorMessage(message);
      showToast({ type: "error", message });
    }
  }

  function renderSaveButton(className = "") {
    return (
      <Button
        type="button"
        className={`gap-2 ${className}`}
        disabled={isProcessing || isMissingPrompt}
        onClick={() => void savePrompt()}
      >
        {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        {t("adminMasterPrompt.save")}
      </Button>
    );
  }

  function renderEditorActions() {
    return (
      <>
        <Button type="button" variant="secondary" className="gap-2" onClick={openPromptPreview}>
          <FileText size={16} />
          Prompt
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="gap-2"
          disabled={isCreating || isSettingDefault || !existingPrompt || existingPrompt.isDefault || isMissingPrompt}
          onClick={() => void setDefaultPrompt()}
        >
          {isSettingDefault ? <Loader2 size={16} className="animate-spin" /> : <Star size={16} />}
          {t("adminMasterPrompt.setDefault")}
        </Button>
        <Button
          type="button"
          variant="destructive"
          className="gap-2"
          disabled={isCreating || isDeleting || !existingPrompt || isMissingPrompt}
          onClick={() => void deletePrompt()}
        >
          {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
          {t("adminMasterPrompt.delete")}
        </Button>
        {renderSaveButton()}
      </>
    );
  }

  return (
    <div className="space-y-5">
      <FeedbackToast toast={toast} onClose={clearToast} />
      <div className="sticky top-0 z-30 -mx-5 border-b border-border bg-background/95 px-5 py-3 backdrop-blur">
        <div className="rounded-lg border border-border bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-lg font-semibold text-foreground">
                  {isCreating ? t("adminMasterPrompt.newPrompt") : existingPrompt?.name ?? "Edit prompt"}
                </h2>
                {!isCreating && existingPrompt?.isDefault ? (
                  <Badge variant="success">{t("adminMasterPrompt.defaultBadge")}</Badge>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {typeTitle(type)} master prompt editor.
              </p>
              <label className="mt-3 block text-sm">
                <span className="sr-only">{t("adminMasterPrompt.name")}</span>
                <input
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm font-medium outline-none focus:ring-2 focus:ring-sky-200"
                  placeholder={t("adminMasterPrompt.name")}
                />
              </label>
            </div>
            <div className="flex shrink-0 flex-wrap justify-end gap-2">
              {renderEditorActions()}
              <LinkButton href={masterPromptListHref(type)} variant="secondary" className="gap-2">
                <ArrowLeft size={16} /> Back to list
              </LinkButton>
            </div>
          </div>
        </div>
      </div>
      <section className="rounded-lg border border-border bg-white p-5 shadow-sm">
        {statusMessage ? (
          <div className="rounded-md bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {statusMessage}
          </div>
        ) : null}
        {errorMessage ? (
          <div className="rounded-md bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <div className="mt-5 space-y-4">
          <MasterPromptField
            id="adminMasterPromptContent"
            label={t("adminMasterPrompt.content")}
            rows={18}
            value={draftContent}
            onChange={(event) => setDraftContent(event.target.value)}
            placeholderSuggestions={ADMIN_MASTER_PROMPT_PLACEHOLDERS[type]}
            className="min-h-[420px] resize-y"
          />
          <MasterPromptField
            id="adminMasterPromptOutputFormat"
            label={t("adminMasterPrompt.outputFormat")}
            help={t("adminMasterPrompt.outputFormatHelp")}
            rows={8}
            value={draftOutputFormat}
            onChange={(event) => setDraftOutputFormat(event.target.value)}
            className="min-h-[220px] resize-y"
          />
          <div className="rounded-lg border border-border bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Master Prompt Attribute</h3>
                <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
                  Select admin-only options for this prompt. They are inserted only when the prompt content contains {"{masterPromptAttributes}"}.
                </p>
              </div>
              <Badge variant="info">{selectedOptionCount(draftAttributeSelection)} selected</Badge>
            </div>
            {!masterPromptAttributeConfig || masterPromptAttributeConfig.attributes.length === 0 ? (
              <div className="mt-3 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                No Master Prompt Config exists yet. Open{" "}
                <a href="/admin/master-prompt-config" className="font-medium text-sky-700 underline">
                  Master Prompt Config
                </a>{" "}
                to define the admin-only attributes.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {masterPromptAttributeConfig.attributes.map((attribute, attributeIndex) => (
                  <div key={attribute.id} className="rounded-md border border-border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700">
                            {attributeIndex + 1}
                          </span>
                          <span className="font-medium text-foreground">{attribute.name}</span>
                        </div>
                      </div>
                      {attribute.description ? (
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-9 w-9 px-0"
                          aria-label={`Show ${attribute.name} helper`}
                          title={attribute.description}
                          onClick={() =>
                            setExpandedAttributeIds((current) => ({
                              ...current,
                              [attribute.id]: !current[attribute.id],
                            }))
                          }
                        >
                          <Info size={15} />
                        </Button>
                      ) : null}
                    </div>
                    {expandedAttributeIds[attribute.id] ? (
                      <div className="mt-3 rounded-md bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-800">
                        {attribute.description}
                      </div>
                    ) : null}
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      {attribute.options.map((option) => {
                        const optionHelpKey = `${attribute.id}:${option.id}`;
                        const isOptionHelpOpen = Boolean(expandedOptionHelpIds[optionHelpKey]);
                        return (
                          <div
                            key={option.id}
                            className={`rounded-md border px-3 py-2 text-sm ${
                              isSelected(draftAttributeSelection, attribute.id, option.id)
                                ? "border-sky-200 bg-sky-50"
                                : "border-border bg-white"
                            }`}
                          >
                            <div className="flex min-w-0 items-start justify-between gap-2">
                              <label className="flex min-w-0 flex-1 items-start gap-2">
                                <input
                                  type="checkbox"
                                  checked={isSelected(draftAttributeSelection, attribute.id, option.id)}
                                  onChange={(event) =>
                                    setDraftAttributeSelection((current) =>
                                      toggleSelection(current, attribute.id, option.id, event.target.checked),
                                    )
                                  }
                                  className="mt-1"
                                />
                                <span className="min-w-0 truncate font-medium text-foreground">{option.name}</span>
                              </label>
                              {option.description ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  className="h-7 w-7 shrink-0 px-0"
                                  aria-label={`Show ${option.name} helper`}
                                  title={option.description}
                                  onClick={() =>
                                    setExpandedOptionHelpIds((current) => ({
                                      ...current,
                                      [optionHelpKey]: !current[optionHelpKey],
                                    }))
                                  }
                                >
                                  <Info size={14} />
                                </Button>
                              ) : null}
                            </div>
                            {isOptionHelpOpen ? (
                              <p className="mt-2 rounded-md bg-white/70 px-2 py-1.5 text-xs leading-5 text-sky-800">
                                {option.description}
                              </p>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-lg border border-border bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">{workflowAttributeTitle(type)}</h3>
                <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
                  Select options from the active Admin {workflowAttributeTitle(type)} catalog for this prompt. The admin preview renders them only when the prompt content contains {workflowAttributePlaceholder(type)}.
                </p>
              </div>
              <Badge variant="info">{selectedOptionCount(draftWorkflowAttributeSelection)} selected</Badge>
            </div>
            {workflowAttributeError ? (
              <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {workflowAttributeError}
              </div>
            ) : null}
            {!workflowAttributeCatalog ? (
              <div className="mt-3 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                No active {workflowAttributeTitle(type)} catalog exists. Open{" "}
                <a href={`/admin/${workflowCatalogType(type)}/attributes`} className="font-medium text-sky-700 underline">
                  {workflowAttributeTitle(type)}
                </a>{" "}
                to create and set a default catalog.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <div className="rounded-md bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-800">
                  <span className="font-semibold">{workflowAttributeCatalog.name}</span>
                  {workflowAttributeCatalog.description ? ` - ${workflowAttributeCatalog.description}` : ""}
                </div>
                {workflowAttributeCatalog.attributes.map((attribute, attributeIndex) => (
                  <div key={attribute.id} className="rounded-md border border-border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700">
                            {attributeIndex + 1}
                          </span>
                          <span className="font-medium text-foreground">{attribute.name}</span>
                        </div>
                      </div>
                      {attribute.description ? (
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-9 w-9 px-0"
                          aria-label={`Show ${attribute.name} helper`}
                          title={attribute.description}
                          onClick={() =>
                            setExpandedWorkflowAttributeIds((current) => ({
                              ...current,
                              [attribute.id]: !current[attribute.id],
                            }))
                          }
                        >
                          <Info size={15} />
                        </Button>
                      ) : null}
                    </div>
                    {expandedWorkflowAttributeIds[attribute.id] ? (
                      <div className="mt-3 rounded-md bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-800">
                        {attribute.description}
                      </div>
                    ) : null}
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      {attribute.options.map((option) => {
                        const optionHelpKey = `${attribute.id}:${option.id}`;
                        const isOptionHelpOpen = Boolean(expandedWorkflowOptionHelpIds[optionHelpKey]);
                        return (
                          <div
                            key={option.id}
                            className={`rounded-md border px-3 py-2 text-sm ${
                              isSelected(draftWorkflowAttributeSelection, attribute.id, option.id)
                                ? "border-sky-200 bg-sky-50"
                                : "border-border bg-white"
                            }`}
                          >
                            <div className="flex min-w-0 items-start justify-between gap-2">
                              <label className="flex min-w-0 flex-1 items-start gap-2">
                                <input
                                  type="checkbox"
                                  checked={isSelected(draftWorkflowAttributeSelection, attribute.id, option.id)}
                                  onChange={(event) =>
                                    setDraftWorkflowAttributeSelection((current) =>
                                      toggleSelection(current, attribute.id, option.id, event.target.checked),
                                    )
                                  }
                                  className="mt-1"
                                />
                                <span className="min-w-0 truncate font-medium text-foreground">{option.name}</span>
                              </label>
                              {option.description ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  className="h-7 w-7 shrink-0 px-0"
                                  aria-label={`Show ${option.name} helper`}
                                  title={option.description}
                                  onClick={() =>
                                    setExpandedWorkflowOptionHelpIds((current) => ({
                                      ...current,
                                      [optionHelpKey]: !current[optionHelpKey],
                                    }))
                                  }
                                >
                                  <Info size={14} />
                                </Button>
                              ) : null}
                            </div>
                            {isOptionHelpOpen ? (
                              <p className="mt-2 rounded-md bg-white/70 px-2 py-1.5 text-xs leading-5 text-sky-800">
                                {option.description}
                              </p>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{t("adminMasterPrompt.freeFormHelp")}</p>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {renderEditorActions()}
      </div>

      <AiDebugDialog
        data={debugDialog}
        closeLabel="Close"
        onClose={() => setDebugDialog(null)}
      />
    </div>
  );
}
