import { redirect } from "next/navigation";
import { DashboardShell } from "../../../components/shell/dashboard-shell";
import { ScriptsList } from "../../../components/shots/scripts-list";
import { I18nText } from "../../../components/i18n/i18n-text";
import { auth } from "../../../lib/auth/auth";

export default async function ShotsPage() {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }

  return (
    <DashboardShell
      role="user"
      title={<I18nText id="shots.title" />}
      description={<I18nText id="shots.description" />}
      backHref="/dashboard"
    >
      <ScriptsList />
    </DashboardShell>
  );
}
