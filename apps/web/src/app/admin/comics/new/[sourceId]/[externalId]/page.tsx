import SourceTitleReviewClient from "./SourceTitleReviewClient";

export function generateStaticParams() {
  return [{ sourceId: "default", externalId: "default" }];
}

export default function Page({ params }: { params: { sourceId: string; externalId: string } }) {
  return <SourceTitleReviewClient params={params} />;
}
