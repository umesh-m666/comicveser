import SourceTitleReviewClient from "./SourceTitleReviewClient";

export function generateStaticParams() {
  return [{ sourceId: "default", externalId: "default" }];
}

export default function Page() {
  // SourceTitleReviewClient reads the route params itself via useParams().
  return <SourceTitleReviewClient />;
}
