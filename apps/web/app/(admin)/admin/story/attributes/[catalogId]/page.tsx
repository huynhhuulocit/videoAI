import { renderAttributeCatalogEditorPage } from "../../../attribute-catalog-page";

type StoryAttributeCatalogPageProps = {
  params: Promise<{ catalogId: string }>;
};

export default async function StoryAttributeCatalogPage({ params }: StoryAttributeCatalogPageProps) {
  const { catalogId } = await params;
  return renderAttributeCatalogEditorPage("story", catalogId);
}
