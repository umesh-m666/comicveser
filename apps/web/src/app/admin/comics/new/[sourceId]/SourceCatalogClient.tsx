"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import SourceCatalog from "@/components/admin/SourceCatalog";
import { State } from "@/components/admin/ui";
import { useLoad } from "@/lib/useApi";

type Provider = {
  id: string;
  displayName: string;
  officialUrl: string;
  enabled: boolean;
  capabilities: { types: string[]; languages: string[] | null; search: boolean; details: boolean; chapters: boolean; pages: boolean };
  notes: string[];
};

export default function ProviderCatalogPage() {
  const params = useParams<{ sourceId: string }>();
  const sourceId = String(params.sourceId ?? "");
  const { data, error, loading } = useLoad<{ enabled: boolean; sources: Provider[] }>("/admin/sources");
  const provider = data?.sources.find((item) => item.id === sourceId);

  return (
    <main className="space-y-5">
      <Link href="/admin/comics/new" className="inline-flex items-center gap-2 text-sm text-muted hover:text-primary">← All providers</Link>
      <State loading={loading} error={error} />
      {data && !provider && <p role="alert" className="rounded-lg border border-line p-5 text-sm">The requested provider was not found.</p>}
      {provider && (
        <>
          <header className="rounded-xl border border-line bg-card p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Provider catalogue</p>
                <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{provider.displayName}</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">Search titles, browse all matches returned by the provider, filter by type or review state, and inspect a title on its own page.</p>
              </div>
              <a href={provider.officialUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline underline-offset-4">Open provider website ↗</a>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {provider.capabilities.types.map((type) => <span key={type} className="rounded-full border border-line px-3 py-1 text-xs text-muted">{type.toUpperCase()}</span>)}
              {provider.capabilities.languages?.map((language) => <span key={language} className="rounded-full border border-line px-3 py-1 text-xs text-muted">{language.toUpperCase()}</span>)}
            </div>
          </header>
          {!provider.enabled || !data?.enabled ? (
            <p role="status" className="rounded-lg border border-line bg-card p-5 text-sm text-muted">This provider is currently disabled. Enable it in Admin → Sources before searching its catalogue.</p>
          ) : (
            <SourceCatalog sourceId={provider.id} sourceName={provider.displayName} types={provider.capabilities.types} enabled={Boolean(provider.enabled && data?.enabled)} />
          )}
        </>
      )}
    </main>
  );
}