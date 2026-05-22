import { renderMasterPromptEditorPage } from "../../../shot-prompt/master-prompt-page";

type NewScenarioMasterPromptPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSearchValue(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function NewScenarioMasterPromptPage({ searchParams }: NewScenarioMasterPromptPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  return renderMasterPromptEditorPage("scenario", undefined, getSearchValue(resolvedSearchParams, "source"));
}
