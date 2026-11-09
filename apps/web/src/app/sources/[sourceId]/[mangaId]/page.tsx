import SourceMangaClient from "./SourceMangaClient";

export function generateStaticParams() {
  return [{ sourceId: "default", mangaId: "default" }];
}

export default function Page({ params }: { params: { sourceId: string; mangaId: string } }) {
  return <SourceMangaClient params={params} />;
}
