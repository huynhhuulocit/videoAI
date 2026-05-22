import { renderAttributeCatalogEditorPage } from "../../../attribute-catalog-page";

type ScenarioAttributeCatalogPageProps = {
  params: Promise<{ catalogId: string }>;
};

export default async function ScenarioAttributeCatalogPage({ params }: ScenarioAttributeCatalogPageProps) {
  const { catalogId } = await params;
  return renderAttributeCatalogEditorPage("scenario", catalogId);
}
