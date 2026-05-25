"use client";

import type {
  AttributeCatalogType,
  AttributeCatalogAttribute,
  AttributeSelection,
  AttributeSelectionMode,
  MasterPromptType,
  ProjectTemplateStepKey,
  ProjectTemplateStepSnapshot,
  ProjectTemplateStepsSnapshot,
  ShotPromptConfig,
  UserProjectTemplate,
} from "@videoai/contracts";
import {
  MASTER_PROMPT_PLACEHOLDERS,
  PROJECT_TEMPLATE_STEP_ORDER,
} from "@videoai/contracts";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Eye,
  FileText,
  Loader2,
  Save,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  AiDebugDialog,
  type AiDebugDialogData,
} from "../ui/ai-debug-dialog";
import { Button, LinkButton } from "../ui/button";
import { Card } from "../ui/card";
import { MasterPromptField } from "../ui/master-prompt-field";
import { TextareaWithCounter } from "../ui/textarea-with-counter";

type ApiSuccess<T> = {
  data: T;
};

type StepDraft = {
  step: ProjectTemplateStepKey;
  masterPromptId: string | null;
  masterPromptName: string;
  masterPromptContent: string;
  masterPromptOutputFormat: string;
  attributeCatalogId: string | null;
  attributeCatalogName: string;
  attributeCatalogDescription: string;
  attributeJson: string;
  attributeSelection: AttributeSelection | null;
};

type AttributeSelectionModes = Record<string, AttributeSelectionMode>;

const stepLabels = {
  story: "Story",
  scenario: "Scenario",
  shots: "Shots",
  shot: "Shot",
} satisfies Record<ProjectTemplateStepKey, string>;

const stepDescriptions = {
  story: "Step 1 Story Content prompt and Story Attribute snapshot.",
  scenario: "Step 2 Scenario prompt and Scenario Attribute snapshot.",
  shots: "Step 3 Shots JSON prompt and Shots Attribute snapshot.",
  shot: "Step 4 per-shot prompt and Shot Attribute snapshot.",
} satisfies Record<ProjectTemplateStepKey, string>;

const userSelectionMode: AttributeSelectionMode = "user_selection";

function stepToMasterPromptType(step: ProjectTemplateStepKey): MasterPromptType {
  return step === "story" ? "scripts" : step;
}

function stepToAttributeCatalogType(
  step: ProjectTemplateStepKey,
): AttributeCatalogType {
  return step;
}

function unwrap<T>(payload: ApiSuccess<T> | T): T {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as ApiSuccess<T>).data;
  }
  return payload as T;
}

async function readApiError(response: Response) {
  const payload = (await response.json().catch(() => null)) as
    | { error?: { message?: string }; message?: string }
    | null;
  return payload?.error?.message ?? payload?.message ?? `Request failed with status ${response.status}`;
}

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`/api/v1${path}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  return unwrap<T>((await response.json()) as ApiSuccess<T>);
}

async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  return unwrap<T>((await response.json()) as ApiSuccess<T>);
}

function selectedStepsForFinal(finalStep: ProjectTemplateStepKey) {
  const index = PROJECT_TEMPLATE_STEP_ORDER.indexOf(finalStep);
  return PROJECT_TEMPLATE_STEP_ORDER.slice(index);
}

function countSelectedOptions(selection: AttributeSelection | null) {
  return (
    selection?.attributes.reduce(
      (total, attribute) => total + attribute.options.length,
      0,
    ) ?? 0
  );
}

function formatAttributeJson(attributes: AttributeCatalogAttribute[]) {
  return JSON.stringify({ attributes }, null, 2);
}

function parseAttributeJson(value: string): AttributeCatalogAttribute[] {
  const parsed = JSON.parse(value) as unknown;
  const root =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  const attributesInput = Array.isArray(parsed)
    ? parsed
    : Array.isArray(root.attributes)
      ? root.attributes
      : null;
  if (!attributesInput) {
    throw new Error("Attribute JSON must contain an attributes array.");
  }
  return attributesInput.map((input, index) => {
    const attribute =
      input && typeof input === "object" && !Array.isArray(input)
        ? (input as Record<string, unknown>)
        : {};
    const id = String(attribute.id ?? "").trim();
    const name = String(attribute.name ?? "").trim();
    if (!id || !name) {
      throw new Error(`Attribute ${index + 1} requires id and name.`);
    }
    const optionsInput = Array.isArray(attribute.options) ? attribute.options : [];
    if (optionsInput.length === 0) {
      throw new Error(`Attribute "${name}" requires at least one option.`);
    }
    return {
      id,
      name,
      description: String(attribute.description ?? "").trim(),
      required: Boolean(attribute.required),
      options: optionsInput.map((optionInput, optionIndex) => {
        const option =
          optionInput &&
          typeof optionInput === "object" &&
          !Array.isArray(optionInput)
            ? (optionInput as Record<string, unknown>)
            : {};
        const optionId = String(option.id ?? "").trim();
        const optionName = String(option.name ?? "").trim();
        if (!optionId || !optionName) {
          throw new Error(
            `Option ${optionIndex + 1} in attribute "${name}" requires id and name.`,
          );
        }
        return {
          id: optionId,
          name: optionName,
          description: String(option.description ?? "").trim(),
        };
      }),
    };
  });
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

function attributeSelectionToModes(
  selection: AttributeSelection | null | undefined,
): AttributeSelectionModes {
  if (!selection) {
    return {};
  }

  return selection.attributes.reduce<AttributeSelectionModes>(
    (modes, attribute) => ({
      ...modes,
      [attribute.id]: attribute.selectionMode ?? userSelectionMode,
    }),
    {},
  );
}

function defaultOptionIdsForAttributes(attributes: AttributeCatalogAttribute[]) {
  return attributes.reduce<Record<string, string[]>>((selectedIds, attribute) => {
    const firstOption = attribute.options[0];
    selectedIds[attribute.id] = firstOption ? [firstOption.id] : [];
    return selectedIds;
  }, {});
}

function buildAttributeSelectionFromIds(input: {
  step: ProjectTemplateStepKey;
  catalogId: string | null;
  catalogName: string;
  attributes: AttributeCatalogAttribute[];
  selectedIds: Record<string, string[]>;
  selectionModes?: AttributeSelectionModes;
}): AttributeSelection {
  return {
    catalogId: input.catalogId ?? `${input.step}-template-catalog`,
    catalogName: input.catalogName,
    type: stepToAttributeCatalogType(input.step),
    attributes: input.attributes.map((attribute) => {
      const mode = input.selectionModes?.[attribute.id] ?? userSelectionMode;
      const selectedIds = input.selectedIds[attribute.id] ?? [];
      const optionIds =
        attribute.required && selectedIds.length === 0 && attribute.options[0]
          ? [attribute.options[0].id]
          : selectedIds;
      return {
        id: attribute.id,
        name: attribute.name,
        required: attribute.required,
        selectionMode: mode,
        options: attribute.options
          .filter((option) => optionIds.includes(option.id))
          .map((option) => ({
            id: option.id,
            name: option.name,
            ...(option.description ? { description: option.description } : {}),
          })),
      };
    }),
  };
}

function reconcileAttributeSelection(
  draft: StepDraft,
  attributes: AttributeCatalogAttribute[],
) {
  const hasExistingSelection = Boolean(draft.attributeSelection);
  const currentIds = hasExistingSelection
    ? attributeSelectionToOptionIds(draft.attributeSelection)
    : defaultOptionIdsForAttributes(attributes);
  const currentModes = hasExistingSelection
    ? attributeSelectionToModes(draft.attributeSelection)
    : {};
  const validOptionIds = attributes.reduce<Record<string, Set<string>>>(
    (lookup, attribute) => ({
      ...lookup,
      [attribute.id]: new Set(attribute.options.map((option) => option.id)),
    }),
    {},
  );
  const selectedIds = attributes.reduce<Record<string, string[]>>(
    (nextIds, attribute) => {
      const validIds = validOptionIds[attribute.id] ?? new Set<string>();
      const filteredIds = (currentIds[attribute.id] ?? []).filter((optionId) =>
        validIds.has(optionId),
      );
      const firstOption = attribute.options[0];
      nextIds[attribute.id] =
        !hasExistingSelection || (attribute.required && filteredIds.length === 0)
          ? firstOption
            ? [firstOption.id]
            : []
          : filteredIds;
      return nextIds;
    },
    {},
  );

  return buildAttributeSelectionFromIds({
    step: draft.step,
    catalogId: draft.attributeCatalogId,
    catalogName: draft.attributeCatalogName,
    attributes,
    selectedIds,
    selectionModes: currentModes,
  });
}

function formatAttributePrefix(prefix: string, content: string) {
  const normalizedPrefix = prefix.trim();
  return normalizedPrefix ? `${normalizedPrefix} ${content}` : content;
}

function formatAttributeSelectionCompact(
  selection: AttributeSelection | null,
  attributes: AttributeCatalogAttribute[],
  aiSelectAttributeText: string,
  userSelectAttributeText: string,
) {
  if (!selection || selection.attributes.length === 0) {
    return "";
  }

  return selection.attributes
    .map((selectedAttribute) => {
      const catalogAttribute = attributes.find(
        (attribute) => attribute.id === selectedAttribute.id,
      );
      if (!catalogAttribute) {
        return "";
      }
      const mode = selectedAttribute.selectionMode ?? userSelectionMode;
      const optionNames =
        mode === "ai_suggestion"
          ? catalogAttribute.options.map((option) => option.name)
          : selectedAttribute.options.map((option) => option.name);

      if (optionNames.length === 0) {
        return "";
      }

      const prefix =
        mode === "ai_suggestion"
          ? aiSelectAttributeText
          : userSelectAttributeText;
      return formatAttributePrefix(
        prefix,
        `${selectedAttribute.name}=${optionNames.join(",")};`,
      );
    })
    .filter(Boolean)
    .join("\n");
}

function renderPromptTemplate(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce(
    (rendered, [key, value]) => rendered.replaceAll(`{${key}}`, value),
    template,
  );
}

function draftFromStep(snapshot: ProjectTemplateStepSnapshot): StepDraft {
  const attributes = snapshot.attributeCatalog.attributes;
  const baseDraft = {
    step: snapshot.step,
    masterPromptId: snapshot.masterPrompt.id ?? null,
    masterPromptName: snapshot.masterPrompt.name,
    masterPromptContent: snapshot.masterPrompt.content,
    masterPromptOutputFormat: snapshot.masterPrompt.outputFormat,
    attributeCatalogId: snapshot.attributeCatalog.id ?? null,
    attributeCatalogName: snapshot.attributeCatalog.name,
    attributeCatalogDescription: snapshot.attributeCatalog.description ?? "",
    attributeJson: formatAttributeJson(attributes),
    attributeSelection: snapshot.attributeSelection ?? null,
  };
  return {
    ...baseDraft,
    attributeSelection: reconcileAttributeSelection(baseDraft, attributes),
  };
}

function buildStepsFromDrafts(
  finalStep: ProjectTemplateStepKey,
  drafts: Partial<Record<ProjectTemplateStepKey, StepDraft>>,
) {
  const steps: Partial<ProjectTemplateStepsSnapshot> = {};
  for (const step of selectedStepsForFinal(finalStep)) {
    const draft = drafts[step];
    if (!draft) {
      throw new Error(`Custom Template step "${step}" is missing.`);
    }
    const content = draft.masterPromptContent.trim();
    if (!content) {
      throw new Error(`${stepLabels[step]} master prompt content is required.`);
    }
    const attributes = parseAttributeJson(draft.attributeJson);
    const attributeSelection = reconcileAttributeSelection(draft, attributes);
    steps[step] = {
      step,
      masterPrompt: {
        id: draft.masterPromptId,
        name: draft.masterPromptName,
        content,
        outputFormat: draft.masterPromptOutputFormat,
      },
      attributeCatalog: {
        id: draft.attributeCatalogId,
        name: draft.attributeCatalogName,
        ...(draft.attributeCatalogDescription.trim()
          ? { description: draft.attributeCatalogDescription.trim() }
          : {}),
        attributes,
      },
      attributeSelection,
    };
  }
  return steps as ProjectTemplateStepsSnapshot;
}

export function CustomTemplateEditor({ templateId }: { templateId: string }) {
  const [template, setTemplate] = useState<UserProjectTemplate | null>(null);
  const [drafts, setDrafts] = useState<
    Partial<Record<ProjectTemplateStepKey, StepDraft>>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [rawDataModal, setRawDataModal] = useState<AiDebugDialogData | null>(
    null,
  );
  const [openSteps, setOpenSteps] = useState<Record<string, boolean>>({});
  const [openAttributes, setOpenAttributes] = useState<Record<string, boolean>>(
    {},
  );
  const [aiSelectAttributeText, setAiSelectAttributeText] = useState("");
  const [userSelectAttributeText, setUserSelectAttributeText] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadTemplate() {
      setIsLoading(true);
      setErrorMessage("");
      try {
        const [loaded, promptConfig] = await Promise.all([
          apiGet<UserProjectTemplate>(
            `/user-project-templates/${encodeURIComponent(templateId)}`,
          ),
          apiGet<ShotPromptConfig>("/admin/shot-prompt"),
        ]);
        if (cancelled) {
          return;
        }
        const nextDrafts: Partial<Record<ProjectTemplateStepKey, StepDraft>> = {};
        const nextOpenSteps: Record<string, boolean> = {};
        for (const step of selectedStepsForFinal(loaded.finalStep)) {
          const snapshot = loaded.steps[step];
          if (!snapshot) {
            throw new Error(`Custom Template step "${step}" is missing.`);
          }
          nextDrafts[step] = draftFromStep(snapshot);
          nextOpenSteps[step] = true;
        }
        setTemplate(loaded);
        setDrafts(nextDrafts);
        setOpenSteps(nextOpenSteps);
        setAiSelectAttributeText(promptConfig.aiSelectAttributeText);
        setUserSelectAttributeText(promptConfig.userSelectAttributeText);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error ? error.message : "Cannot load Custom Template.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadTemplate();
    return () => {
      cancelled = true;
    };
  }, [templateId]);

  function updateDraft(
    step: ProjectTemplateStepKey,
    updater: (draft: StepDraft) => StepDraft,
  ) {
    setDrafts((current) => {
      const existing = current[step];
      if (!existing) {
        return current;
      }
      return { ...current, [step]: updater(existing) };
    });
  }

  function updateDraftSelection(
    step: ProjectTemplateStepKey,
    updater: (
      draft: StepDraft,
      attributes: AttributeCatalogAttribute[],
      selectedIds: Record<string, string[]>,
      modes: AttributeSelectionModes,
    ) => {
      selectedIds: Record<string, string[]>;
      modes: AttributeSelectionModes;
    },
  ) {
    setErrorMessage("");
    updateDraft(step, (draft) => {
      const attributes = parseAttributeJson(draft.attributeJson);
      const currentSelection = reconcileAttributeSelection(draft, attributes);
      const result = updater(
        draft,
        attributes,
        attributeSelectionToOptionIds(currentSelection),
        attributeSelectionToModes(currentSelection),
      );
      return {
        ...draft,
        attributeSelection: buildAttributeSelectionFromIds({
          step,
          catalogId: draft.attributeCatalogId,
          catalogName: draft.attributeCatalogName,
          attributes,
          selectedIds: result.selectedIds,
          selectionModes: result.modes,
        }),
      };
    });
  }

  function buildPromptPreview(step: ProjectTemplateStepKey, draft: StepDraft) {
    const attributes = parseAttributeJson(draft.attributeJson);
    const selection = reconcileAttributeSelection(draft, attributes);
    const attributeText = formatAttributeSelectionCompact(
      selection,
      attributes,
      aiSelectAttributeText,
      userSelectAttributeText,
    );
    const attributeCatalogText = JSON.stringify(
      {
        catalogId: draft.attributeCatalogId,
        catalogName: draft.attributeCatalogName,
        attributes,
      },
      null,
      2,
    );
    return renderPromptTemplate(draft.masterPromptContent, {
      attributes: attributeCatalogText,
      storyAttributes: step === "story" ? attributeText : "",
      scenarioAttributes: step === "scenario" ? attributeText : "",
      shotsAttributes: step === "shots" ? attributeText : "",
      shotAttributes: step === "shot" ? attributeText : "",
      outputFormat: draft.masterPromptOutputFormat,
    });
  }

  function openPromptPreview(step: ProjectTemplateStepKey, draft: StepDraft) {
    try {
      setRawDataModal({
        title: `${stepLabels[step]} prompt preview`,
        help:
          "Template preview replaces template attribute placeholders and leaves project runtime placeholders unchanged.",
        value: buildPromptPreview(step, draft),
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Cannot render prompt preview.",
      );
    }
  }

  async function saveTemplate() {
    if (!template) {
      return;
    }
    setIsSaving(true);
    setMessage("");
    setErrorMessage("");
    try {
      const steps = buildStepsFromDrafts(template.finalStep, drafts);
      await apiPatch<UserProjectTemplate>(
        `/user-project-templates/${encodeURIComponent(template.id)}`,
        { steps },
      );
      setMessage("Custom Template saved.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Cannot save Custom Template.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function renderAttributePanel(step: ProjectTemplateStepKey, draft: StepDraft) {
    let attributes: AttributeCatalogAttribute[] = [];
    let selection: AttributeSelection | null = null;
    let parseError = "";

    try {
      attributes = parseAttributeJson(draft.attributeJson);
      selection = reconcileAttributeSelection(draft, attributes);
    } catch (error) {
      parseError =
        error instanceof Error ? error.message : "Attribute JSON is invalid.";
    }

    if (parseError) {
      return (
        <div className="rounded-md border border-red-100 bg-red-50 p-3 text-sm leading-6 text-red-700">
          {parseError}
        </div>
      );
    }

    const selectedIds = attributeSelectionToOptionIds(selection);
    const modes = attributeSelectionToModes(selection);
    const selectedCount = countSelectedOptions(selection);

    return (
      <div className="rounded-md border border-border bg-white">
        <div className="border-b border-border p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-foreground">
                {stepLabels[step]} Attributes
              </div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Select default options for this Custom Template. The project can
                still change them after creation.
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-sky-50 px-2 py-1 text-xs font-medium text-sky-700">
              {selectedCount} selected
            </span>
          </div>
        </div>

        <div className="grid gap-3 p-3">
          {attributes.map((attribute, attributeIndex) => {
            const attributeSelectedIds = selectedIds[attribute.id] ?? [];
            const mode = modes[attribute.id] ?? userSelectionMode;
            const isAiSuggestion = mode === "ai_suggestion";
            const collapseKey = `${step}:${attribute.id}`;
            const isOpen = openAttributes[collapseKey] ?? false;
            return (
              <div
                key={attribute.id}
                className="rounded-md border border-border p-3"
              >
                <button
                  type="button"
                  className="flex w-full items-start gap-2 text-left focus:outline-none focus:ring-2 focus:ring-sky-200"
                  onClick={() =>
                    setOpenAttributes((current) => ({
                      ...current,
                      [collapseKey]: !isOpen,
                    }))
                  }
                  aria-expanded={isOpen}
                >
                  {isOpen ? (
                    <ChevronDown
                      size={16}
                      className="mt-1 shrink-0 text-muted-foreground"
                    />
                  ) : (
                    <ChevronRight
                      size={16}
                      className="mt-1 shrink-0 text-muted-foreground"
                    />
                  )}
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm text-sky-800">
                    {attributeIndex + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="truncate font-medium">
                        {attribute.name}
                      </span>
                      {attribute.required ? (
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                          Required
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {attributeSelectedIds.length} selected
                    </span>
                  </span>
                </button>

                <label className="mt-2 inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-border"
                    checked={isAiSuggestion}
                    onChange={(event) =>
                      updateDraftSelection(
                        step,
                        (_draft, _attributes, currentIds, currentModes) => ({
                          selectedIds: currentIds,
                          modes: {
                            ...currentModes,
                            [attribute.id]: event.target.checked
                              ? "ai_suggestion"
                              : "user_selection",
                          },
                        }),
                      )
                    }
                  />
                  AI suggestion
                </label>

                {isOpen ? (
                  <>
                    {attribute.description ? (
                      <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">
                        {attribute.description}
                      </p>
                    ) : null}
                    <div className="mt-3 grid gap-2">
                      {attribute.options.map((option, optionIndex) => {
                        const checked = attributeSelectedIds.includes(option.id);
                        return (
                          <label
                            key={option.id}
                            className={`grid grid-cols-[auto_auto_1fr] items-center gap-3 rounded-md border px-3 py-2 text-sm transition ${
                              checked
                                ? "border-sky-300 bg-sky-50 text-sky-800"
                                : "border-border bg-white text-foreground"
                            } ${
                              isAiSuggestion
                                ? "cursor-not-allowed opacity-70"
                                : "cursor-pointer hover:bg-muted"
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-border"
                              checked={checked}
                              disabled={isAiSuggestion}
                              onChange={() =>
                                updateDraftSelection(
                                  step,
                                  (
                                    _draft,
                                    currentAttributes,
                                    currentIds,
                                    currentModes,
                                  ) => {
                                    const currentAttribute =
                                      currentAttributes.find(
                                        (item) => item.id === attribute.id,
                                      );
                                    const optionIds =
                                      currentIds[attribute.id] ?? [];
                                    const nextIds = optionIds.includes(option.id)
                                      ? optionIds.filter(
                                          (selectedId) =>
                                            selectedId !== option.id,
                                        )
                                      : [...optionIds, option.id];
                                    const firstOption =
                                      currentAttribute?.options[0];
                                    return {
                                      selectedIds: {
                                        ...currentIds,
                                        [attribute.id]:
                                          currentAttribute?.required &&
                                          nextIds.length === 0 &&
                                          firstOption
                                            ? [firstOption.id]
                                            : nextIds,
                                      },
                                      modes: currentModes,
                                    };
                                  },
                                )
                              }
                            />
                            <span className="shrink-0 rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                              {attributeIndex + 1}.{optionIndex + 1}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate">
                                {option.name}
                              </span>
                              {option.description ? (
                                <span className="mt-1 block whitespace-pre-wrap text-xs leading-5 text-muted-foreground">
                                  {option.description}
                                </span>
                              ) : null}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function renderStepEditor(step: ProjectTemplateStepKey, draft: StepDraft) {
    const isOpen = openSteps[step] ?? true;
    const promptType = stepToMasterPromptType(step);

    return (
      <Card key={step}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <button
            type="button"
            className="min-w-0 flex-1 text-left focus:outline-none focus:ring-2 focus:ring-sky-200"
            onClick={() =>
              setOpenSteps((current) => ({ ...current, [step]: !isOpen }))
            }
            aria-expanded={isOpen}
          >
            <div className="flex items-center gap-2 font-medium">
              {isOpen ? (
                <ChevronDown size={18} className="text-muted-foreground" />
              ) : (
                <ChevronRight size={18} className="text-muted-foreground" />
              )}
              <span>
                Step {PROJECT_TEMPLATE_STEP_ORDER.indexOf(step) + 1} ·{" "}
                {stepLabels[step]}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {stepDescriptions[step]}
            </p>
          </button>
        </div>

        {isOpen ? (
          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="min-w-0 space-y-4">
              <MasterPromptField
                id={`custom-template-${step}-master-prompt`}
                label={`${stepLabels[step]} master prompt`}
                help="This prompt is saved into the Custom Template snapshot and copied into projects created from it."
                rows={8}
                value={draft.masterPromptContent}
                onChange={(event) =>
                  updateDraft(step, (current) => ({
                    ...current,
                    masterPromptContent: event.target.value,
                  }))
                }
                placeholderSuggestions={MASTER_PROMPT_PLACEHOLDERS[promptType]}
              />

              <label className="block text-sm">
                <span className="font-medium">Output format</span>
                <TextareaWithCounter
                  rows={4}
                  value={draft.masterPromptOutputFormat}
                  onChange={(event) =>
                    updateDraft(step, (current) => ({
                      ...current,
                      masterPromptOutputFormat: event.target.value,
                    }))
                  }
                  className="mt-2 w-full rounded-md border border-border bg-white p-3 font-mono text-sm leading-6 outline-none focus:ring-2 focus:ring-sky-200"
                />
              </label>

              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  className="gap-2 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled
                  title="AI generation runs after a project is created from this Custom Template because it needs project runtime data."
                >
                  <Sparkles size={16} />
                  AI generate
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="gap-2"
                  onClick={() => openPromptPreview(step, draft)}
                >
                  <FileText size={16} />
                  Prompt
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="gap-2 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled
                  title="No AI request has run from this template editor."
                >
                  <Eye size={16} />
                  Request
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="gap-2 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled
                  title="No AI response has run from this template editor."
                >
                  <Eye size={16} />
                  Response
                </Button>
              </div>

              <details className="rounded-md border border-border bg-muted/30 p-3">
                <summary className="cursor-pointer text-sm font-semibold text-foreground">
                  Attribute snapshot JSON
                </summary>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Edit the saved Attribute catalog snapshot. The attribute panel
                  updates after the JSON is valid.
                </p>
                <TextareaWithCounter
                  rows={10}
                  value={draft.attributeJson}
                  onChange={(event) =>
                    updateDraft(step, (current) => ({
                      ...current,
                      attributeJson: event.target.value,
                    }))
                  }
                  spellCheck={false}
                  className="mt-3 w-full rounded-md border border-border bg-white p-3 font-mono text-xs leading-5 outline-none focus:ring-2 focus:ring-sky-200"
                />
              </details>
            </div>

            <aside className="min-w-0">{renderAttributePanel(step, draft)}</aside>
          </div>
        ) : null}
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
          Loading Custom Template...
        </div>
      </Card>
    );
  }

  if (!template) {
    return (
      <Card>
        <div className="rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-700">
          {errorMessage || "Custom Template is unavailable."}
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card
        title={template.name}
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="gap-2"
              disabled={isSaving}
              onClick={() => void saveTemplate()}
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save
            </Button>
            <LinkButton href="/projects/new" variant="secondary" className="gap-2">
              <ArrowLeft size={16} />
              Back
            </LinkButton>
          </div>
        }
      >
        <p className="text-sm text-muted-foreground">
          Steps:{" "}
          {selectedStepsForFinal(template.finalStep)
            .map((step) => stepLabels[step])
            .join(" -> ")}
        </p>
        {errorMessage ? (
          <div className="mt-3 whitespace-pre-wrap rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}
        {message ? (
          <div className="mt-3 rounded-md border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-700">
            {message}
          </div>
        ) : null}
      </Card>

      {selectedStepsForFinal(template.finalStep).map((step) => {
        const draft = drafts[step];
        return draft ? renderStepEditor(step, draft) : null;
      })}

      <div className="flex justify-end">
        <Button
          type="button"
          className="gap-2"
          disabled={isSaving}
          onClick={() => void saveTemplate()}
        >
          {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Save
        </Button>
      </div>
      <AiDebugDialog
        data={rawDataModal}
        closeLabel="Close"
        onClose={() => setRawDataModal(null)}
      />
    </div>
  );
}
