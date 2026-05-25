"use client";

import type { ApiSuccess, Project } from "@videoai/contracts";
import { Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { useI18n } from "../i18n/language-provider";
import { Badge } from "../ui/badge";
import { Button, LinkButton } from "../ui/button";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? "";

type ProjectsTableProps = {
  initialProjects: Project[];
};

function projectFlowLabel(project: Project, defaultLabel: string) {
  return project.projectTemplateSnapshot?.name ?? defaultLabel;
}

export function ProjectsTable({ initialProjects }: ProjectsTableProps) {
  const { t } = useI18n();
  const [projects, setProjects] = useState(initialProjects);
  const [deletingProjectId, setDeletingProjectId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function deleteProject(project: Project) {
    const confirmed = window.confirm(
      t("projects.deleteConfirm", { name: project.name }),
    );
    if (!confirmed) {
      return;
    }

    setDeletingProjectId(project.id);
    setErrorMessage("");

    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/projects/${project.id}`, {
        method: "DELETE",
        headers: { "x-request-id": `web-${Date.now()}` },
      });

      if (!response.ok) {
        throw new Error(t("projects.deleteFailed"));
      }

      const payload = (await response.json()) as ApiSuccess<{ deleted: boolean }>;
      if (!payload.data.deleted) {
        throw new Error(t("projects.deleteFailed"));
      }

      setProjects((current) =>
        current.filter((currentProject) => currentProject.id !== project.id),
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t("projects.deleteFailed"),
      );
    } finally {
      setDeletingProjectId("");
    }
  }

  if (projects.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-muted p-6 text-sm text-muted-foreground">
        {t("projects.empty")}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {errorMessage ? (
        <div className="rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}
      <div className="overflow-hidden rounded-md border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">{t("dashboard.project")}</th>
              <th className="px-4 py-3 font-medium">{t("dashboard.flow")}</th>
              <th className="px-4 py-3 font-medium">{t("dashboard.status")}</th>
              <th className="px-4 py-3 font-medium">{t("dashboard.updated")}</th>
              <th className="px-4 py-3 font-medium">{t("dashboard.action")}</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project.id} className="border-t border-border">
                <td className="px-4 py-3">
                  <div className="font-medium">{project.name}</div>
                  {project.description ? (
                    <div className="text-muted-foreground">
                      {project.description}
                    </div>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  <Badge variant="info">
                    {projectFlowLabel(
                      project,
                      t(
                        project.flowType === "script"
                          ? "flow.script"
                          : "flow.product",
                      ),
                    )}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge variant="success">
                    {project.status === "active"
                      ? t("common.statusActive")
                      : project.status}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(project.updatedAt).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <LinkButton
                      href={`/projects/${project.id}`}
                      variant="secondary"
                    >
                      {t("common.open")}
                    </LinkButton>
                    <Button
                      type="button"
                      variant="destructive"
                      className="gap-2 px-3"
                      disabled={deletingProjectId === project.id}
                      onClick={() => void deleteProject(project)}
                      aria-label={t("projects.delete")}
                      title={t("projects.delete")}
                    >
                      {deletingProjectId === project.id ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Trash2 size={16} />
                      )}
                      {t("common.delete")}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
