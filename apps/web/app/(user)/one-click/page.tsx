import { redirect } from "next/navigation";
import { I18nText } from "../../../components/i18n/i18n-text";
import { OneClickStartForm } from "../../../components/one-click/one-click-start-form";
import { DashboardShell } from "../../../components/shell/dashboard-shell";
import { auth } from "../../../lib/auth/auth";

export default async function OneClickPage() {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }

  return (
    <DashboardShell
      role="user"
      title={<I18nText id="oneClick.title" />}
      description={<I18nText id="oneClick.description" />}
      backHref="/dashboard"
    >
      <OneClickStartForm />
    </DashboardShell>
  );
}
