import type { MasterPromptType } from "@videoai/contracts";
import { redirect } from "next/navigation";
import {
  MasterPromptEditor,
  MasterPromptList,
} from "../../../../components/admin/shot-prompt-form";
import { I18nText } from "../../../../components/i18n/i18n-text";
import { DashboardShell } from "../../../../components/shell/dashboard-shell";
import { getShotPromptConfig } from "../../../../lib/api/client";
import { auth } from "../../../../lib/auth/auth";

async function requireAdmin() {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }
  if (session.user.role !== "admin") {
    redirect("/dashboard");
  }
}

export async function renderMasterPromptPage(type: MasterPromptType) {
  await requireAdmin();

  const config = await getShotPromptConfig();

  return (
    <DashboardShell
      role="admin"
      title={<I18nText id="adminMasterPrompt.title" />}
      description={<I18nText id="adminMasterPrompt.description" />}
      backHref="/admin/ai-config"
    >
      <MasterPromptList config={config} type={type} />
    </DashboardShell>
  );
}

export async function renderMasterPromptEditorPage(
  type: MasterPromptType,
  promptId?: string,
  source?: string,
) {
  await requireAdmin();

  const config = await getShotPromptConfig();

  return (
    <DashboardShell
      role="admin"
      title={<I18nText id="adminMasterPrompt.title" />}
      description={<I18nText id="adminMasterPrompt.description" />}
      backHref={`/admin/${type === "scripts" ? "story" : type}/master-prompt`}
    >
      <MasterPromptEditor config={config} type={type} promptId={promptId} source={source} />
    </DashboardShell>
  );
}
