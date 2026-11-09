import CreatorComicClient from "./CreatorComicClient";

export function generateStaticParams() {
  return [{ id: "1" }];
}

export default function Page({ params }: { params: { id: string } }) {
  return <CreatorComicClient params={params} />;
}
