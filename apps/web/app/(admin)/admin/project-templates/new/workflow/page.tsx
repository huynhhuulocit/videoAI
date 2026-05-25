import { redirect } from "next/navigation";
import { AdminProjectTemplateWorkflow } from "../../../../../../components/admin/project-template-manager";
import { DashboardShell } from "../../../../../../components/shell/dashboard-shell";
import { auth } from "../../../../../../lib/auth/auth";

export default async function AdminProjectTemplateWorkflowPage() {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }
  if (session.user.role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <DashboardShell
      role="admin"
      title="New Project Template"
      description="Choose steps and saved master prompts before creating the template snapshot."
      backHref="/admin/project-templates"
    >
      <AdminProjectTemplateWorkflow />
    </DashboardShell>
  );
}
