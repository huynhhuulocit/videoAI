import { redirect } from "next/navigation";
import { I18nText } from "../../../../components/i18n/i18n-text";
import { DashboardShell } from "../../../../components/shell/dashboard-shell";
import { ShotsManager } from "../../../../components/shots/shots-manager";
import { auth } from "../../../../lib/auth/auth";

export default async function NewScriptPage() {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }

  return (
    <DashboardShell
      role="user"
      title={<I18nText id="shots.newTitle" />}
      description={<I18nText id="shots.editorDescription" />}
      backHref="/shots"
    >
      <ShotsManager mode="create" />
    </DashboardShell>
  );
}
