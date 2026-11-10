"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import SourceTitleReview from "@/components/admin/SourceTitleReview";
import { State } from "@/components/admin/ui";
import { useLoad } from "@/lib/useApi";

type Provider = { id: string; displayName: string; enabled: boolean };

export default function SourceTitleReviewPage(props?: { params?: { sourceId?: string; externalId?: string } }) {
  const routeParams = useParams<{ sourceId: string; externalId: string }>();
  const params = props?.params ?? routeParams;
  const sourceId = String(params.sourceId ?? "");
  const externalId = String(params.externalId ?? "");
  const { data, error, loading } = useLoad<{ enabled: boolean; sources: Provider[] }>("/admin/sources");
  const provider = data?.sources.find((item) => item.id === sourceId);

  return (
    <main className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
        <Link href="/admin/comics/new" className="hover:text-primary">Providers</Link>
        <span>/</span>
        <Link href={`/admin/comics/new/${encodeURIComponent(sourceId)}`} className="hover:text-primary">{provider?.displayName ?? sourceId}</Link>
        <span>/</span>
        <span className="text-foreground">Title review</span>
      </div>
      <State loading={loading} error={error} />
      {provider && <SourceTitleReview sourceId={sourceId} sourceName={provider.displayName} externalId={externalId} enabled={provider.enabled && !!data?.enabled} />}
      {data && !provider && <p role="alert" className="rounded-lg border border-line p-5 text-sm">The requested provider was not found.</p>}
    </main>
  );
}