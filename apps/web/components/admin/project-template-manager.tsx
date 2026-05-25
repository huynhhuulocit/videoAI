"use client";

import type {
  MasterPrompt,
  MasterPromptConfig,
  MasterPromptType,
  ProjectTemplate,
  ProjectTemplateStepKey,
  ProjectTemplateStepsSnapshot,
} from "@videoai/contracts";
import { PROJECT_TEMPLATE_STEP_ORDER } from "@videoai/contracts";
import { FileText, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button, LinkButton } from "../ui/button";
import { Card } from "../ui/card";

type ApiSuccess<T> = {
  data: T;
};

type DefaultSnapshotResponse = {
  finalStep: ProjectTemplateStepKey;
  steps: ProjectTemplateStepsSnapshot;
};

const stepCopy = {
  story: {
    title: "Story",
    description: "Story Content master prompt and Story Attribute snapshot.",
  },
  scenario: {
    title: "Scenario",
    description: "Scenario master prompt and Scenario Attribute snapshot.",
  },
  shots: {
    title: "Shots",
    description: "Step 3 batch shot JSON prompt and Shots Attribute snapshot.",
  },
  shot: {
    title: "Shot",
    description: "Step 4 per-shot prompt and Shot Attribute snapshot.",
  },
} satisfies Record<ProjectTemplateStepKey, { title: string; description: string }>;

const projectTemplateWorkflowDisplayOrder = [
  "shot",
  "shots",
  "scenario",
  "story",
] as const satisfies readonly ProjectTemplateStepKey[];

function stepToMasterPromptType(step: ProjectTemplateStepKey): MasterPromptType {
  return step === "story" ? "scripts" : step;
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
  return (
    payload?.error?.message ??
    payload?.message ??
    `Request failed with status ${response.status}`
  );
}

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`/api/v1${path}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  return unwrap<T>((await response.json()) as ApiSuccess<T>);
}

async function apiSend<T>(
  method: "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    method,
    ...(body === undefined
      ? {}
      : {
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  return unwrap<T>((await response.json().catch(() => ({}))) as ApiSuccess<T>);
}

function selectedStepsForFinal(finalStep: ProjectTemplateStepKey) {
  const index = PROJECT_TEMPLATE_STEP_ORDER.indexOf(finalStep);
  return PROJECT_TEMPLATE_STEP_ORDER.slice(index);
}

function templateStepsLabel(finalStep: ProjectTemplateStepKey) {
  return selectedStepsForFinal(finalStep)
    .map((step) => stepCopy[step].title)
    .join(" -> ");
}

export function AdminProjectTemplateList() {
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function loadTemplates() {
    setIsLoading(true);
    setErrorMessage("");
    try {
      setTemplates(await apiGet<ProjectTemplate[]>("/admin/project-templates"));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Cannot load Project Templates.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadTemplates();
  }, []);

  async function deleteTemplate(templateId: string) {
    setDeletingId(templateId);
    setMessage("");
    setErrorMessage("");
    try {
      await apiSend<{ deleted: boolean }>(
        "DELETE",
        `/admin/project-templates/${encodeURIComponent(templateId)}`,
      );
      setMessage("Project Template deleted.");
      await loadTemplates();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Cannot delete Project Template.",
      );
    } finally {
      setDeletingId("");
    }
  }

  return (
    <Card
      title="Project Template list"
      action={
        <LinkButton href="/admin/project-templates/new/workflow" className="gap-2">
          <Plus size={16} />
          Add new
        </LinkButton>
      }
    >
      <p className="mb-4 text-sm text-muted-foreground">
        Admin templates snapshot default prompts and attributes for selected
        workflow steps.
      </p>
      {errorMessage ? (
        <div className="mb-3 rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}
      {message ? (
        <div className="mb-3 rounded-md border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}
      {isLoading ? (
        <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
          Loading Project Templates...
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
          No Project Templates yet.
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((template) => (
            <div
              key={template.id}
              className="rounded-md border border-border bg-white p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold text-foreground">
                    {template.name}
                  </h3>
                  {template.description ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {template.description}
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs text-sky-700">
                    {templateStepsLabel(template.finalStep)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Updated {new Date(template.updatedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <LinkButton
                    href={`/admin/project-templates/${encodeURIComponent(template.id)}`}
                    variant="secondary"
                    className="gap-2"
                  >
                    <FileText size={16} />
                    Edit
                  </LinkButton>
                  <Button
                    type="button"
                    variant="destructive"
                    className="gap-2"
                    disabled={deletingId === template.id}
                    onClick={() => void deleteTemplate(template.id)}
                  >
                    {deletingId === template.id ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Trash2 size={16} />
                    )}
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export function AdminProjectTemplateWorkflow({
  templateId,
}: {
  templateId?: string;
}) {
  const router = useRouter();
  const isEdit = Boolean(templateId);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [finalStep, setFinalStep] = useState<ProjectTemplateStepKey>("shot");
  const [promptConfig, setPromptConfig] = useState<MasterPromptConfig | null>(
    null,
  );
  const [selectedPromptIds, setSelectedPromptIds] = useState<
    Partial<Record<ProjectTemplateStepKey, string>>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const selectedSteps = useMemo(() => selectedStepsForFinal(finalStep), [finalStep]);

  useEffect(() => {
    let cancelled = false;

    async function loadForm() {
      setIsLoading(true);
      setErrorMessage("");
      try {
        const config = await apiGet<MasterPromptConfig>("/admin/master-prompts");
        if (cancelled) {
          return;
        }
        const defaults: Partial<Record<ProjectTemplateStepKey, string>> = {};
        for (const step of PROJECT_TEMPLATE_STEP_ORDER) {
          const type = stepToMasterPromptType(step);
          const group = config.groups.find((item) => item.type === type);
          const savedPrompts =
            group?.prompts.filter((prompt) => !prompt.isBuiltIn) ?? [];
          const defaultPrompt =
            group?.defaultPrompt && !group.defaultPrompt.isBuiltIn
              ? group.defaultPrompt
              : null;
          if (
            defaultPrompt &&
            savedPrompts.some((prompt) => prompt.id === defaultPrompt.id)
          ) {
            defaults[step] = defaultPrompt.id;
          }
        }
        if (templateId) {
          const template = await apiGet<ProjectTemplate>(
            `/admin/project-templates/${encodeURIComponent(templateId)}`,
          );
          if (cancelled) {
            return;
          }
          const templatePromptIds: Partial<
            Record<ProjectTemplateStepKey, string>
          > = {};
          for (const step of selectedStepsForFinal(template.finalStep)) {
            const promptId = template.steps[step]?.masterPrompt.id?.trim();
            if (promptId) {
              templatePromptIds[step] = promptId;
            }
          }
          setName(template.name);
          setDescription(template.description ?? "");
          setFinalStep(template.finalStep);
          setSelectedPromptIds({ ...defaults, ...templatePromptIds });
        } else {
          setSelectedPromptIds(defaults);
        }
        setPromptConfig(config);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Cannot load master prompts.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadForm();

    return () => {
      cancelled = true;
    };
  }, [templateId]);

  function promptOptionsForStep(step: ProjectTemplateStepKey): MasterPrompt[] {
    const group = promptConfig?.groups.find(
      (item) => item.type === stepToMasterPromptType(step),
    );
    return group?.prompts.filter((prompt) => !prompt.isBuiltIn) ?? [];
  }

  function toggleStep(step: ProjectTemplateStepKey, checked: boolean) {
    const stepIndex = PROJECT_TEMPLATE_STEP_ORDER.indexOf(step);
    if (checked) {
      setFinalStep(step);
      return;
    }
    if (step === "shot") {
      setFinalStep("shot");
      return;
    }
    const nextStep = PROJECT_TEMPLATE_STEP_ORDER[stepIndex + 1] ?? "shot";
    setFinalStep(nextStep);
  }

  async function saveTemplate() {
    setIsSaving(true);
    setMessage("");
    setErrorMessage("");
    try {
      const trimmedName = name.trim();
      if (!trimmedName) {
        throw new Error("Template name is required.");
      }
      const params = new URLSearchParams({ finalStep });
      for (const step of selectedSteps) {
        const promptId = selectedPromptIds[step]?.trim();
        if (!promptId) {
          throw new Error(
            `${stepCopy[step].title} master prompt must be selected.`,
          );
        }
        params.set(`${step}MasterPromptId`, promptId);
      }
      const snapshot = await apiGet<DefaultSnapshotResponse>(
        `/admin/project-templates/default-snapshot?${params.toString()}`,
      );
      if (isEdit) {
        if (!templateId) {
          throw new Error("Project Template id is required.");
        }
        await apiSend<ProjectTemplate>(
          "PATCH",
          `/admin/project-templates/${encodeURIComponent(templateId)}`,
          {
            name: trimmedName,
            ...(description.trim() ? { description: description.trim() } : {}),
            finalStep: snapshot.finalStep,
            steps: snapshot.steps,
          },
        );
        setMessage("Project Template saved.");
      } else {
        const saved = await apiSend<ProjectTemplate>(
          "POST",
          "/admin/project-templates",
          {
            name: trimmedName,
            ...(description.trim() ? { description: description.trim() } : {}),
            finalStep: snapshot.finalStep,
            steps: snapshot.steps,
          },
        );
        setMessage("Project Template created.");
        router.replace(`/admin/project-templates/${encodeURIComponent(saved.id)}`);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Cannot save Project Template.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card title={isEdit ? "Edit Project Template" : "Select workflow"}>
      <p className="mb-4 text-sm text-muted-foreground">
        Select the final step and the saved master prompt for each selected
        step. Shot is always selected; choosing Story, Scenario, or Shots also
        includes every later step in the Story - Scenario - Shots - Shot chain.
      </p>
      <div className="mb-4 grid gap-4 md:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium">Template name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-2 h-10 w-full rounded-md border border-border px-3 text-sm outline-none focus:ring-2 focus:ring-sky-200"
            placeholder="Enter template name"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Description</span>
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="mt-2 h-10 w-full rounded-md border border-border px-3 text-sm outline-none focus:ring-2 focus:ring-sky-200"
            placeholder="Short description"
          />
        </label>
      </div>
      {errorMessage ? (
        <div className="mb-3 whitespace-pre-wrap rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}
      {message ? (
        <div className="mb-3 rounded-md border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}
      <div className="grid gap-3">
        {projectTemplateWorkflowDisplayOrder.map((step) => {
          const checked = selectedSteps.includes(step);
          const options = promptOptionsForStep(step);
          const selectedPromptId = selectedPromptIds[step] ?? "";
          return (
            <div
              key={step}
              className={`rounded-md border p-4 transition ${
                checked
                  ? "border-sky-300 bg-sky-50"
                  : "border-border bg-white hover:bg-muted"
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-border"
                  checked={checked}
                  disabled={step === "shot"}
                  onChange={(event) => toggleStep(step, event.target.checked)}
                />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-foreground">
                    {stepCopy[step].title}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {stepCopy[step].description}
                  </div>
                  <label className="mt-3 block text-sm">
                    <span className="font-medium">Master prompt</span>
                    <select
                      value={selectedPromptId}
                      disabled={!checked || isLoading}
                      onChange={(event) =>
                        setSelectedPromptIds((current) => ({
                          ...current,
                          [step]: event.target.value,
                        }))
                      }
                      className="mt-2 h-10 w-full rounded-md border border-border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-sky-200 disabled:bg-muted"
                    >
                      <option value="">
                        {isLoading ? "Loading prompts..." : "Select master prompt"}
                      </option>
                      {options.map((prompt) => (
                        <option key={prompt.id} value={prompt.id}>
                          {prompt.name}
                          {prompt.isDefault ? " (Default)" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  {checked && !isLoading && options.length === 0 ? (
                    <p className="mt-2 text-sm text-red-700">
                      No saved active {stepCopy[step].title} master prompt. Create
                      one before creating a Project Template.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-5 flex justify-end">
        <Button
          type="button"
          className="gap-2"
          disabled={isSaving || isLoading}
          onClick={() => void saveTemplate()}
        >
          {isSaving ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Save size={16} />
          )}
          {isEdit ? "Save template" : "Create template"}
        </Button>
      </div>
    </Card>
  );
}
