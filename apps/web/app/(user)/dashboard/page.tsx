import { Activity, CirclePlus, Video } from "lucide-react";
import { redirect } from "next/navigation";
import { DashboardShell } from "../../../components/shell/dashboard-shell";
import { I18nText } from "../../../components/i18n/i18n-text";
import { Badge } from "../../../components/ui/badge";
import { LinkButton } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { auth } from "../../../lib/auth/auth";
import { getRoleLandingPath } from "../../../lib/auth/credentials";
import { getProjects } from "../../../lib/api/client";

function projectFlowLabel(project: Awaited<ReturnType<typeof getProjects>>[number]) {
  return project.projectTemplateSnapshot?.name ?? null;
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }
  if (session.user.role === "admin") {
    redirect(getRoleLandingPath(session.user.role));
  }

  const projects = await getProjects();

  return (
    <DashboardShell
      role="user"
      title={<I18nText id="dashboard.title" />}
      description={<I18nText id="dashboard.description" />}
      backHref="/"
    >
      <div className="mb-5 flex justify-end">
        <LinkButton href="/projects/new" className="gap-2">
          <CirclePlus size={16} />
          <I18nText id="dashboard.createProject" />
        </LinkButton>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              <I18nText id="dashboard.projects" />
            </span>
            <Activity size={18} className="text-sky-600" />
          </div>
          <p className="mt-3 text-3xl font-semibold">{projects.length}</p>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              <I18nText id="dashboard.videos" />
            </span>
            <Video size={18} className="text-sky-600" />
          </div>
          <p className="mt-3 text-3xl font-semibold">1</p>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              <I18nText id="dashboard.failedJobs" />
            </span>
            <Activity size={18} className="text-emerald-600" />
          </div>
          <p className="mt-3 text-3xl font-semibold">0</p>
        </Card>
      </div>
      <Card title={<I18nText id="dashboard.recentProjects" />} className="mt-5">
        <div className="overflow-hidden rounded-md border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">
                  <I18nText id="dashboard.project" />
                </th>
                <th className="px-4 py-3 font-medium">
                  <I18nText id="dashboard.flow" />
                </th>
                <th className="px-4 py-3 font-medium">
                  <I18nText id="dashboard.status" />
                </th>
                <th className="px-4 py-3 font-medium">
                  <I18nText id="dashboard.updated" />
                </th>
                <th className="px-4 py-3 font-medium">
                  <I18nText id="dashboard.action" />
                </th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <div className="font-medium">{project.name}</div>
                    <div className="text-muted-foreground">{project.description}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="info">
                      {projectFlowLabel(project) ?? (
                        <I18nText
                          id={
                            project.flowType === "script"
                              ? "flow.script"
                              : "flow.product"
                          }
                        />
                      )}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="success">
                      {project.status === "active" ? <I18nText id="common.statusActive" /> : project.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(project.updatedAt).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <LinkButton href={`/projects/${project.id}`} variant="secondary">
                      <I18nText id="common.open" />
                    </LinkButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </DashboardShell>
  );
}
