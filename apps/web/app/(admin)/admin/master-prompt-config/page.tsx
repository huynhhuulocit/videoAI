import { redirect } from "next/navigation";
import { MasterPromptConfigManager } from "../../../../components/admin/master-prompt-config-manager";
import { DashboardShell } from "../../../../components/shell/dashboard-shell";
import { auth } from "../../../../lib/auth/auth";

export default async function MasterPromptConfigPage() {
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
      title="Master Prompt Config"
      description="Admin-only attributes that can be selected by Story, Scenario, and Shots master prompts."
      backHref="/admin/ai-config"
    >
      <MasterPromptConfigManager />
    </DashboardShell>
  );
}
