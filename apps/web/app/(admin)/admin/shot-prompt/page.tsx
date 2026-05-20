import { redirect } from "next/navigation";
import { ShotPromptForm } from "../../../../components/admin/shot-prompt-form";
import { I18nText } from "../../../../components/i18n/i18n-text";
import { DashboardShell } from "../../../../components/shell/dashboard-shell";
import { auth } from "../../../../lib/auth/auth";
import { getShotPromptConfig } from "../../../../lib/api/client";

export default async function ShotPromptPage() {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }
  if (session.user.role !== "admin") {
    redirect("/dashboard");
  }

  const config = await getShotPromptConfig();

  return (
    <DashboardShell
      role="admin"
      title={<I18nText id="adminMasterPrompt.title" />}
      description={<I18nText id="adminMasterPrompt.description" />}
      backHref="/admin/ai-config"
    >
      <ShotPromptForm config={config} />
    </DashboardShell>
  );
}
