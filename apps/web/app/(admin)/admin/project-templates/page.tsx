import { redirect } from "next/navigation";
import { AdminProjectTemplateList } from "../../../../components/admin/project-template-manager";
import { DashboardShell } from "../../../../components/shell/dashboard-shell";
import { auth } from "../../../../lib/auth/auth";

export default async function AdminProjectTemplatesPage() {
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
      title="Project Template"
      description="Manage reusable project workflow snapshots for users to clone."
      backHref="/admin/ai-config"
    >
      <AdminProjectTemplateList />
    </DashboardShell>
  );
}

