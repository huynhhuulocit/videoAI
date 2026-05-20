import { redirect } from "next/navigation";
import { I18nText } from "../../../../components/i18n/i18n-text";
import { DashboardShell } from "../../../../components/shell/dashboard-shell";
import { ShotsManager } from "../../../../components/shots/shots-manager";
import { auth } from "../../../../lib/auth/auth";

type ScriptEditPageProps = {
  params: Promise<{ shotPlanId: string }>;
};

export default async function ScriptEditPage({ params }: ScriptEditPageProps) {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }

  const { shotPlanId } = await params;

  return (
    <DashboardShell
      role="user"
      title={<I18nText id="shots.editTitle" />}
      description={<I18nText id="shots.editorDescription" />}
      backHref="/shots"
    >
      <ShotsManager mode="edit" shotPlanId={shotPlanId} />
    </DashboardShell>
  );
}
