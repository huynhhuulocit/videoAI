import { redirect } from "next/navigation";
import { CreateProjectForm } from "../../../../components/project/create-project-form";
import { I18nText } from "../../../../components/i18n/i18n-text";
import { DashboardShell } from "../../../../components/shell/dashboard-shell";
import { auth } from "../../../../lib/auth/auth";

export default async function NewProjectPage() {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }

  return (
    <DashboardShell
      role="user"
      title={<I18nText id="projectCreate.title" />}
      description={<I18nText id="projectCreate.description" />}
      backHref="/projects"
    >
      <CreateProjectForm />
    </DashboardShell>
  );
}
