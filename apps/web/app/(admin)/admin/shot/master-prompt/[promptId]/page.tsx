import { renderMasterPromptEditorPage } from "../../../shot-prompt/master-prompt-page";

type ShotMasterPromptEditorPageProps = {
  params: Promise<{ promptId: string }>;
};

export default async function ShotMasterPromptEditorPage({ params }: ShotMasterPromptEditorPageProps) {
  const { promptId } = await params;
  return renderMasterPromptEditorPage("shot", promptId);
}
