import { redirect } from "next/navigation";
import { DashboardShell } from "../../../../components/shell/dashboard-shell";
import { ProjectWorkspace } from "../../../../components/project/project-workspace";
import { I18nText } from "../../../../components/i18n/i18n-text";
import { auth } from "../../../../lib/auth/auth";
import { getProject } from "../../../../lib/api/client";

type ProjectPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectPage({ params }: ProjectPageProps) {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }

  const { projectId } = await params;
  const project = await getProject(projectId);

  return (
    <DashboardShell
      role="user"
      title={project?.name ?? <I18nText id="projectDetail.fallbackTitle" />}
      description={<I18nText id="projectDetail.description" />}
      backHref="/projects"
    >
      <ProjectWorkspace
        projectId={project?.id ?? projectId}
        flowType={project?.flowType ?? "product"}
        savedTemplateSelection={project?.templateSelection ?? null}
        defaultPrompt=""
        defaultProductUrl="https://shopee.vn/Kinh-ram-phan-cuc-nam-VEITHDIA-2462-gong-vuong-co-dien-i.75453101.1255972028"
      />
    </DashboardShell>
  );
}
