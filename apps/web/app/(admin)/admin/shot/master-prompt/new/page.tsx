import { renderMasterPromptEditorPage } from "../../../shot-prompt/master-prompt-page";

type NewShotMasterPromptPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSearchValue(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function NewShotMasterPromptPage({ searchParams }: NewShotMasterPromptPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  return renderMasterPromptEditorPage("shot", undefined, getSearchValue(resolvedSearchParams, "source"));
}
