import { redirect } from "next/navigation";
import { I18nText } from "../../../../components/i18n/i18n-text";
import { DashboardShell } from "../../../../components/shell/dashboard-shell";
import { TemplateManager } from "../../../../components/template/template-manager";
import { auth } from "../../../../lib/auth/auth";

export default async function NewScenarioPage() {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }

  return (
    <DashboardShell
      role="user"
      title={<I18nText id="template.newTitle" />}
      description={<I18nText id="template.editorDescription" />}
      backHref="/templates"
    >
      <TemplateManager mode="create" />
    </DashboardShell>
  );
}
