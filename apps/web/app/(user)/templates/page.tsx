import { redirect } from "next/navigation";
import { DashboardShell } from "../../../components/shell/dashboard-shell";
import { ScenarioList } from "../../../components/template/scenario-list";
import { I18nText } from "../../../components/i18n/i18n-text";
import { auth } from "../../../lib/auth/auth";

export default async function TemplatesPage() {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }

  return (
    <DashboardShell
      role="user"
      title={<I18nText id="template.title" />}
      description={<I18nText id="template.description" />}
      backHref="/dashboard"
    >
      <ScenarioList />
    </DashboardShell>
  );
}
