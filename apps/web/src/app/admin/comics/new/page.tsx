"use client";

import Link from "next/link";
import { State } from "@/components/admin/ui";
import { Badge } from "@/components/admin/ui";
import { useLoad } from "@/lib/useApi";

 type Provider = {
  id: string;
  displayName: string;
  officialUrl: string;
  attribution: string;
  enabled: boolean;
  capabilities: { search: boolean; details: boolean; chapters: boolean; pages: boolean; types: string[]; languages: string[] | null };
  notes: string[];
};

export default function NewComic() {
  const { data, error, loading } = useLoad<{ enabled: boolean; sources: Provider[] }>("/admin/sources");
  const providers = data?.sources ?? [];

  return (
    <main className="space-y-6">
      <header className="rounded-xl border border-line bg-card p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">ComicVerse administration</p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Add a comic from a provider</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          Choose a provider to search its catalogue, review title and chapter information, then approve and publish titles to ComicVerse.
        </p>
      </header>

      <State loading={loading} error={error} />
      {data && !data.enabled && (
        <p role="status" className="rounded-lg border border-line bg-card p-4 text-sm text-muted">
          External providers are disabled on the server. Enable external sources in the server configuration before using this page.
        </p>
      )}
      {data && data.enabled && providers.filter((provider) => provider.enabled).length === 0 && (
        <p role="status" className="rounded-lg border border-line bg-card p-4 text-sm text-muted">
          No providers are enabled. Enable a provider from Admin → Sources before browsing its catalogue.
        </p>
      )}

      {providers.length > 0 && (
        <section>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold">Available providers</h2>
              <p className="text-sm text-muted">Select a provider to open its dedicated catalogue page.</p>
            </div>
            <span className="text-xs text-muted">{providers.filter((provider) => provider.enabled).length} enabled</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {providers.map((provider) => (
              <article key={provider.id} className="flex min-h-48 flex-col rounded-xl border border-line bg-card p-5 transition hover:border-primary/60">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold">{provider.displayName}</h3>
                    <p className="mt-1 text-xs text-muted">{provider.id}</p>
                  </div>
                  <Badge v={provider.enabled ? "ACTIVE" : "DISABLED"} />
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-muted">{provider.attribution}</p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {provider.capabilities.types.map((type) => (
                    <span key={type} className="rounded-full border border-line px-2 py-1 text-xs text-muted">{type.toUpperCase()}</span>
                  ))}
                </div>
                <div className="mt-auto flex items-center justify-between gap-3 pt-5">
                  <a href={provider.officialUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-muted underline underline-offset-4">Provider website</a>
                  {provider.enabled ? (
                    <Link href={`/admin/comics/new/${encodeURIComponent(provider.id)}`} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold">Open provider</Link>
                  ) : (
                    <span className="rounded-md border border-line px-4 py-2 text-sm text-muted">Disabled</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
