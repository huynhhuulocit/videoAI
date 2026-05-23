import { renderAttributeCatalogEditorPage } from "../../../attribute-catalog-page";

type ShotAttributeCatalogPageProps = {
  params: Promise<{ catalogId: string }>;
};

export default async function ShotAttributeCatalogPage({ params }: ShotAttributeCatalogPageProps) {
  const { catalogId } = await params;
  return renderAttributeCatalogEditorPage("shot", catalogId);
}
