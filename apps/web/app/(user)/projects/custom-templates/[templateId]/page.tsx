import { redirect } from "next/navigation";
import { CustomTemplateEditor } from "../../../../../components/project/custom-template-editor";
import { DashboardShell } from "../../../../../components/shell/dashboard-shell";
import { auth } from "../../../../../lib/auth/auth";

type CustomTemplatePageProps = {
  params: Promise<{ templateId: string }>;
};

export default async function CustomTemplatePage({
  params,
}: CustomTemplatePageProps) {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }
  const { templateId } = await params;

  return (
    <DashboardShell
      role="user"
      title="Custom Template"
      description="Edit your template prompt and attribute snapshots."
      backHref="/projects/new"
    >
      <CustomTemplateEditor templateId={templateId} />
    </DashboardShell>
  );
}

