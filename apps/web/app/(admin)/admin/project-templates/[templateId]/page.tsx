import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AdminProjectTemplateWorkflow } from "../../../../../components/admin/project-template-manager";
import { DashboardShell } from "../../../../../components/shell/dashboard-shell";
import { auth } from "../../../../../lib/auth/auth";

type AdminProjectTemplateEditPageProps = {
  params: Promise<{ templateId: string }>;
};

export default async function AdminProjectTemplateEditPage({
  params,
}: AdminProjectTemplateEditPageProps) {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }
  if (session.user.role !== "admin") {
    redirect("/dashboard");
  }
  const { templateId } = await params;

  return (
    <DashboardShell
      role="admin"
      title="Project Template"
      description="Edit workflow steps and selected master prompts for this template."
      backHref="/admin/project-templates"
    >
      <Suspense fallback={null}>
        <AdminProjectTemplateWorkflow templateId={templateId} />
      </Suspense>
    </DashboardShell>
  );
}
