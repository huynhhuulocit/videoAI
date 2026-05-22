import { renderMasterPromptEditorPage } from "../../../shot-prompt/master-prompt-page";

type StoryMasterPromptEditorPageProps = {
  params: Promise<{ promptId: string }>;
};

export default async function StoryMasterPromptEditorPage({ params }: StoryMasterPromptEditorPageProps) {
  const { promptId } = await params;
  return renderMasterPromptEditorPage("scripts", promptId);
}
