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
  capabilities: {
    types: string[];
    languages: string[] | null;
    search: boolean;
    details: boolean;
    chapters: boolean;
    pages: boolean;
  };
  notes: string[];
};

export default function ProviderCatalogPage(props?: { params?: { sourceId?: string } }) {
  const routeParams = useParams<{ sourceId: string }>();
  const params = props?.params ?? routeParams;
  const sourceId = String(params.sourceId ?? "");
  const { data, error, loading } = useLoad<{ enabled: boolean; sources: Provider[] }>(
    "/admin/sources",
  );
  const provider = data?.sources.find((item) => item.id === sourceId);

  return (
    <div className="space-y-4">
      <Link href="/admin/comics/new" className="rowbtn">
        ← All providers
      </Link>
      <State loading={loading} error={error} />

      {data && !provider && (
        <p role="alert" className="a-panel text-sm">
          The requested provider was not found.
        </p>
      )}

      {provider && (
        <>
          <header className="a-panel" data-layer="Provider Catalogue">
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: ".14em",
                color: "var(--purple-2)",
                marginBottom: 5,
              }}
            >
              PROVIDER CATALOGUE
            </div>
            <h1 style={{ fontSize: 21, fontWeight: 700, margin: "0 0 4px", color: "#fff" }}>
              {provider.displayName}
            </h1>
            <div className="psub" style={{ lineHeight: 1.6, marginBottom: 10 }}>
              Search titles, browse all matches returned by the provider, filter by type or review state, and inspect a title on its own page.
              <br />
              <a
                href={provider.officialUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--purple-2)", textDecoration: "underline" }}
              >
                Open provider website ↗
              </a>
            </div>
            <div className="prov-types">
              {provider.capabilities.types.map((type) => (
                <span key={type}>{type.toUpperCase()}</span>
              ))}
              {provider.capabilities.languages?.map((language) => (
                <span key={language}>{language.toUpperCase()}</span>
              ))}
            </div>
          </header>

          {!provider.enabled || !data?.enabled ? (
            <p role="status" className="a-panel text-sm text-muted">
              This provider is currently disabled. Enable it in Admin → Sources before searching its catalogue.
            </p>
          ) : (
            <SourceCatalog
              sourceId={provider.id}
              sourceName={provider.displayName}
              types={provider.capabilities.types}
              enabled={Boolean(provider.enabled && data?.enabled)}
            />
          )}
        </>
      )}
    </div>
  );
}