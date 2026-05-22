import { redirect } from "next/navigation";
import { I18nText } from "../../../../components/i18n/i18n-text";
import { ProjectWorkspace } from "../../../../components/project/project-workspace";
import { DashboardShell } from "../../../../components/shell/dashboard-shell";
import { auth } from "../../../../lib/auth/auth";
import { getProject } from "../../../../lib/api/client";

type OneClickWizardPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function OneClickWizardPage({
  params,
}: OneClickWizardPageProps) {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }

  const { projectId } = await params;
  const project = await getProject(projectId);
  if (!project) {
    redirect("/one-click");
  }
  if (project.flowType !== "script") {
    redirect(`/projects/${project.id}`);
  }

  return (
    <DashboardShell
      role="user"
      title={project.name}
      description={<I18nText id="oneClick.wizardDescription" />}
      backHref="/one-click"
    >
      <ProjectWorkspace
        projectId={project.id}
        projectName={project.name}
        projectDescription={project.description ?? null}
        flowType="script"
        workspaceMode="one-click"
        savedTemplateSelection={project.templateSelection ?? null}
        savedAttributeSelections={project.attributeSelections ?? null}
        defaultPrompt=""
        defaultProductUrl=""
      />
    </DashboardShell>
  );
}
