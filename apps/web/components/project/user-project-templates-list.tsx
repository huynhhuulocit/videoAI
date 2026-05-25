"use client";

import type { ApiSuccess, UserProjectTemplate } from "@videoai/contracts";
import { Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button, LinkButton } from "../ui/button";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? "";

type UserProjectTemplatesListProps = {
  initialTemplates: UserProjectTemplate[];
};

function stepsLabel(finalStep: UserProjectTemplate["finalStep"]) {
  const labels = {
    story: "Story -> Scenario -> Shots -> Shot",
    scenario: "Scenario -> Shots -> Shot",
    shots: "Shots -> Shot",
    shot: "Shot",
  };
  return labels[finalStep];
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

export function UserProjectTemplatesList({
  initialTemplates,
}: UserProjectTemplatesListProps) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [deletingTemplateId, setDeletingTemplateId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function deleteTemplate(template: UserProjectTemplate) {
    const confirmed = window.confirm(
      `Delete Custom Template "${template.name}"?`,
    );
    if (!confirmed) {
      return;
    }

    setDeletingTemplateId(template.id);
    setErrorMessage("");
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/v1/user-project-templates/${encodeURIComponent(template.id)}`,
        {
          method: "DELETE",
          headers: { "x-request-id": `web-${Date.now()}` },
        },
      );
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }
      const payload = (await response.json()) as ApiSuccess<{
        deleted: boolean;
      }>;
      if (!payload.data.deleted) {
        throw new Error("Cannot delete Custom Template.");
      }
      setTemplates((current) =>
        current.filter((item) => item.id !== template.id),
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Cannot delete Custom Template.",
      );
    } finally {
      setDeletingTemplateId("");
    }
  }

  return (
    <div className="space-y-3">
      {errorMessage ? (
        <div className="rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}
      {templates.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-muted p-4 text-sm text-muted-foreground">
          No Custom Templates yet. Project creation can use Admin Project
          Templates directly.
        </div>
      ) : (
        <div className="grid gap-2">
          {templates.map((template) => (
            <div
              key={template.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3"
            >
              <div className="min-w-0">
                <div className="font-medium text-foreground">
                  {template.name}
                </div>
                {template.description ? (
                  <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {template.description}
                  </div>
                ) : null}
                <div className="mt-1 text-xs text-muted-foreground">
                  {stepsLabel(template.finalStep)}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <LinkButton
                  href={`/projects/custom-templates/${encodeURIComponent(template.id)}`}
                  variant="secondary"
                >
                  Edit
                </LinkButton>
                <Button
                  type="button"
                  variant="destructive"
                  className="gap-2"
                  disabled={deletingTemplateId === template.id}
                  onClick={() => void deleteTemplate(template)}
                >
                  {deletingTemplateId === template.id ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Trash2 size={16} />
                  )}
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
