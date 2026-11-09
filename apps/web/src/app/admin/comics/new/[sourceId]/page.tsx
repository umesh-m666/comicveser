import SourceCatalogClient from "./SourceCatalogClient";

export function generateStaticParams() {
  return [{ sourceId: "default" }];
}

export default function Page({ params }: { params: { sourceId: string } }) {
  return <SourceCatalogClient params={params} />;
}
