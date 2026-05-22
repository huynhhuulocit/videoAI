import { MasterPromptTypeSchema } from "@videoai/contracts";
import { redirect } from "next/navigation";

type ShotPromptPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const routesByType = {
  scripts: "/admin/story/master-prompt",
  scenario: "/admin/scenario/master-prompt",
  shots: "/admin/shots/master-prompt",
} as const;

function getSearchValue(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function ShotPromptPage({ searchParams }: ShotPromptPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const parsedType = MasterPromptTypeSchema.safeParse(getSearchValue(resolvedSearchParams, "type"));

  redirect(routesByType[parsedType.success ? parsedType.data : "scripts"]);
}
