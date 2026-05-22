import { renderMasterPromptEditorPage } from "../../../shot-prompt/master-prompt-page";

type ScenarioMasterPromptEditorPageProps = {
  params: Promise<{ promptId: string }>;
};

export default async function ScenarioMasterPromptEditorPage({ params }: ScenarioMasterPromptEditorPageProps) {
  const { promptId } = await params;
  return renderMasterPromptEditorPage("scenario", promptId);
}
