"use client";

import type {
  CreateProjectRequest,
  Project,
  ProjectFlow,
  ProjectTemplate,
  ProjectTemplateStepKey,
} from "@videoai/contracts";
import { PROJECT_TEMPLATE_STEP_ORDER } from "@videoai/contracts";
import type { LucideIcon } from "lucide-react";
import { FileText, Link2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useI18n } from "../i18n/language-provider";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { TextareaWithCounter } from "../ui/textarea-with-counter";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? "";

type ApiSuccess<T> = {
  data: T;
};

const flowOptions: Array<{
  value: ProjectFlow;
  titleKey: "flow.script" | "flow.product";
  descriptionKey: "projectCreate.scriptDescription" | "projectCreate.productDescription";
  icon: LucideIcon;
}> = [
  {
    value: "script",
    titleKey: "flow.script",
    descriptionKey: "projectCreate.scriptDescription",
    icon: FileText
  },
  {
    value: "product",
    titleKey: "flow.product",
    descriptionKey: "projectCreate.productDescription",
    icon: Link2
  }
];

const stepLabels = {
  story: "Story",
  scenario: "Scenario",
  shots: "Shots",
  shot: "Shot",
} satisfies Record<ProjectTemplateStepKey, string>;

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
  const response = await fetch(`${apiBaseUrl}/api/v1${path}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  return unwrap<T>((await response.json()) as ApiSuccess<T>);
}

function stepsLabel(finalStep: ProjectTemplateStepKey) {
  const index = PROJECT_TEMPLATE_STEP_ORDER.indexOf(finalStep);
  return PROJECT_TEMPLATE_STEP_ORDER.slice(index)
    .map((step) => stepLabels[step])
    .join(" -> ");
}

export function CreateProjectForm() {
  const router = useRouter();
  const { t } = useI18n();
  const [name, setName] = useState(() => t("projectCreate.defaultName"));
  const [description, setDescription] = useState(() => t("projectCreate.defaultDescription"));
  const [flowType, setFlowType] = useState<ProjectFlow>("product");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [adminTemplates, setAdminTemplates] = useState<ProjectTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);

  async function loadTemplates() {
    setIsLoadingTemplates(true);
    try {
      const loadedAdminTemplates = await apiGet<ProjectTemplate[]>("/project-templates");
      setAdminTemplates(loadedAdminTemplates);
      setSelectedTemplateId((current) =>
        current && loadedAdminTemplates.some((template) => template.id === current)
          ? current
          : "",
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Cannot load Project Templates.");
    } finally {
      setIsLoadingTemplates(false);
    }
  }

  useEffect(() => {
    void loadTemplates();
  }, []);

  async function createProject() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage(t("projectCreate.errorName"));
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    const body: CreateProjectRequest = {
      name: trimmedName,
      flowType: selectedTemplateId ? "script" : flowType
    };
    const trimmedDescription = description.trim();
    if (trimmedDescription) {
      body.description = trimmedDescription;
    }
    if (selectedTemplateId) {
      body.projectTemplateId = selectedTemplateId;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/projects`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-request-id": `web-${Date.now()}`
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const payload = (await response.json()) as ApiSuccess<Project>;
      router.push(`/projects/${payload.data.id}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("projectCreate.errorSubmit"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
      <Card title={t("projectCreate.cardInfo")}>
        <div className="space-y-4">
          <label className="block text-sm">
            <span className="font-medium">{t("projectCreate.name")}</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-2 h-10 w-full rounded-md border border-border px-3 text-sm outline-none focus:ring-2 focus:ring-sky-200"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">{t("projectCreate.descriptionField")}</span>
            <TextareaWithCounter
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="mt-2 w-full rounded-md border border-border p-3 text-sm outline-none focus:ring-2 focus:ring-sky-200"
            />
          </label>
          {errorMessage ? (
            <div className="rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}
        </div>
      </Card>

      <div className="grid gap-5">
      <Card title={t("projectCreate.cardFlow")}>
        <div className="grid gap-3 md:grid-cols-2">
          {flowOptions.map((option) => {
            const Icon = option.icon;
            const selected = !selectedTemplateId && option.value === flowType;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setSelectedTemplateId("");
                  setFlowType(option.value);
                }}
                className={`rounded-md border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-sky-200 ${
                  selected ? "border-sky-300 bg-sky-50" : "border-border bg-white hover:bg-muted"
                }`}
              >
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-white text-sky-700 shadow-sm">
                  <Icon size={18} />
                </div>
                <div className="font-semibold text-foreground">{t(option.titleKey)}</div>
                <div className="mt-2 text-sm text-muted-foreground">{t(option.descriptionKey)}</div>
              </button>
            );
          })}
        </div>

        <div className="mt-5 border-t border-border pt-5">
          <div className="text-sm font-semibold text-foreground">
            Project templates
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            Choose a template to start with its saved workflow snapshot.
            Custom Template edit and delete actions are managed from the
            Projects list.
          </div>

          {isLoadingTemplates ? (
            <div className="mt-3 rounded-md bg-muted p-3 text-sm text-muted-foreground">
              Loading templates...
            </div>
          ) : (
            <div className="mt-3 space-y-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Admin templates
                </div>
                <div className="mt-2 grid gap-2">
                  {adminTemplates.length === 0 ? (
                    <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                      No Admin Project Templates are available.
                    </div>
                  ) : (
                    adminTemplates.map((template) => {
                      const selected =
                        selectedTemplateId === template.id;
                      return (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => {
                          setSelectedTemplateId(template.id);
                          setFlowType("script");
                        }}
                        className={`rounded-md border p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-sky-200 ${
                          selected
                            ? "border-sky-300 bg-sky-50"
                            : "border-border bg-white hover:bg-muted"
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-foreground">
                            {template.name}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {stepsLabel(template.finalStep)}
                          </div>
                        </div>
                      </button>
                    );
                    })
                  )}
                </div>
              </div>
              {selectedTemplateId ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="px-0"
                  onClick={() => setSelectedTemplateId("")}
                >
                  Create without template
                </Button>
              ) : null}
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-end">
          <Button
            type="button"
            className="gap-2 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            onClick={() => void createProject()}
          >
            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : null}
            {t("projectCreate.create")}
          </Button>
        </div>
      </Card>
      </div>
    </div>
  );
}
