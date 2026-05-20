import { redirect } from "next/navigation";
import { AiConfigForm } from "../../../../components/admin/ai-config-form";
import { DashboardShell } from "../../../../components/shell/dashboard-shell";
import { I18nText } from "../../../../components/i18n/i18n-text";
import { auth } from "../../../../lib/auth/auth";
import { getAiConfig } from "../../../../lib/api/client";

export default async function AiConfigPage() {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }
  if (session.user.role !== "admin") {
    redirect("/dashboard");
  }

  const config = await getAiConfig();

  return (
    <DashboardShell
      role="admin"
      title={<I18nText id="adminConfig.title" />}
      description={<I18nText id="adminConfig.description" />}
      backHref="/"
    >
      <AiConfigForm config={config} />
    </DashboardShell>
  );
}
