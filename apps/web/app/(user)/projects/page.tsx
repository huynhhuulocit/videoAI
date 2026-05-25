import { CirclePlus } from "lucide-react";
import { redirect } from "next/navigation";
import { DashboardShell } from "../../../components/shell/dashboard-shell";
import { I18nText } from "../../../components/i18n/i18n-text";
import { LinkButton } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { ProjectsTable } from "../../../components/project/projects-table";
import { UserProjectTemplatesList } from "../../../components/project/user-project-templates-list";
import { auth } from "../../../lib/auth/auth";
import { getRoleLandingPath } from "../../../lib/auth/credentials";
import { getProjects, getUserProjectTemplates } from "../../../lib/api/client";

export default async function ProjectsPage() {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }
  if (session.user.role === "admin") {
    redirect(getRoleLandingPath(session.user.role));
  }

  const [projects, userProjectTemplates] = await Promise.all([
    getProjects(),
    getUserProjectTemplates(),
  ]);

  return (
    <DashboardShell
      role="user"
      title={<I18nText id="projects.title" />}
      description={<I18nText id="projects.description" />}
      backHref="/dashboard"
    >
      <div className="mb-5 flex justify-end">
        <LinkButton href="/projects/new" className="gap-2">
          <CirclePlus size={16} />
          <I18nText id="dashboard.createProject" />
        </LinkButton>
      </div>
      <div className="mb-5">
        <Card title="Custom Templates">
          <p className="mb-4 text-sm text-muted-foreground">
            Manage your saved Custom Templates here. Project creation can select
            a template without clone actions.
          </p>
          <UserProjectTemplatesList initialTemplates={userProjectTemplates} />
        </Card>
      </div>
      <Card title={<I18nText id="projects.listTitle" />}>
        {projects.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-muted p-6 text-sm text-muted-foreground">
            <p>
              <I18nText id="projects.empty" />
            </p>
            <LinkButton href="/projects/new" className="mt-4">
              <I18nText id="dashboard.createProject" />
            </LinkButton>
          </div>
        ) : (
          <ProjectsTable initialProjects={projects} />
        )}
      </Card>
    </DashboardShell>
  );
}
