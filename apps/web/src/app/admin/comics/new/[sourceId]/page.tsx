import SourceCatalogClient from "./SourceCatalogClient";

export function generateStaticParams() {
  return [{ sourceId: "default" }];
}

export default function Page() {
  // SourceCatalogClient reads the route params itself via useParams().
  return <SourceCatalogClient />;
}
