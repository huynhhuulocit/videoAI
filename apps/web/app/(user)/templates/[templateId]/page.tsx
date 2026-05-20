import { redirect } from "next/navigation";
import { I18nText } from "../../../../components/i18n/i18n-text";
import { DashboardShell } from "../../../../components/shell/dashboard-shell";
import { TemplateManager } from "../../../../components/template/template-manager";
import { auth } from "../../../../lib/auth/auth";

type ScenarioEditPageProps = {
  params: Promise<{ templateId: string }>;
};

export default async function ScenarioEditPage({ params }: ScenarioEditPageProps) {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }

  const { templateId } = await params;

  return (
    <DashboardShell
      role="user"
      title={<I18nText id="template.editTitle" />}
      description={<I18nText id="template.editorDescription" />}
      backHref="/templates"
    >
      <TemplateManager mode="edit" templateId={templateId} />
    </DashboardShell>
  );
}
