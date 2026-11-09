import EditComicClient from "./EditComicClient";

export function generateStaticParams() {
  return [{ id: "1" }];
}

export default function Page({ params }: { params: { id: string } }) {
  return <EditComicClient params={params} />;
}
