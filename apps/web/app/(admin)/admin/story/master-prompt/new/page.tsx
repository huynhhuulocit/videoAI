import { renderMasterPromptEditorPage } from "../../../shot-prompt/master-prompt-page";

type NewStoryMasterPromptPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSearchValue(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function NewStoryMasterPromptPage({ searchParams }: NewStoryMasterPromptPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  return renderMasterPromptEditorPage("scripts", undefined, getSearchValue(resolvedSearchParams, "source"));
}
