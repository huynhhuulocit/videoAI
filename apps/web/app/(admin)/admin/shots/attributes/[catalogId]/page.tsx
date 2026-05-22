import { renderAttributeCatalogEditorPage } from "../../../attribute-catalog-page";

type ShotsAttributeCatalogPageProps = {
  params: Promise<{ catalogId: string }>;
};

export default async function ShotsAttributeCatalogPage({ params }: ShotsAttributeCatalogPageProps) {
  const { catalogId } = await params;
  return renderAttributeCatalogEditorPage("shots", catalogId);
}
