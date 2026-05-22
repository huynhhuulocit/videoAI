import { renderMasterPromptEditorPage } from "../../../shot-prompt/master-prompt-page";

type NewShotsMasterPromptPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSearchValue(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function NewShotsMasterPromptPage({ searchParams }: NewShotsMasterPromptPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  return renderMasterPromptEditorPage("shots", undefined, getSearchValue(resolvedSearchParams, "source"));
}
