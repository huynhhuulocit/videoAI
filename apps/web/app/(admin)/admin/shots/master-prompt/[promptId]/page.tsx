import { renderMasterPromptEditorPage } from "../../../shot-prompt/master-prompt-page";

type ShotsMasterPromptEditorPageProps = {
  params: Promise<{ promptId: string }>;
};

export default async function ShotsMasterPromptEditorPage({ params }: ShotsMasterPromptEditorPageProps) {
  const { promptId } = await params;
  return renderMasterPromptEditorPage("shots", promptId);
}
