"use client";

import Link from "next/link";
import { State } from "@/components/admin/ui";
import { useLoad } from "@/lib/useApi";

type Provider = {
  id: string;
  displayName: string;
  officialUrl: string;
  attribution: string;
  enabled: boolean;
  capabilities: {
    search: boolean;
    details: boolean;
    chapters: boolean;
    pages: boolean;
    types: string[];
    languages: string[] | null;
  };
  notes: string[];
};

/**
 * Asura Admin Add Comic Page (#frame-admin-comics -> Add Comic / Provider Flow):
 * Displays external provider cards (.prov-grid, .prov-card, .pc-top, .prov-active, .prov-types, .prov-open)
 * without manual comic creation.
 */
export default function NewComic() {
  const { data, error, loading } = useLoad<{ enabled: boolean; sources: Provider[] }>(
    "/admin/sources",
  );
  const providers = data?.sources ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/admin/comics" className="rowbtn">
          ← Back to Comics
        </Link>
      </div>

      <div
        className="a-panel"
        data-layer="Add Comic From Provider"
        style={{
          background: "linear-gradient(160deg,rgba(147,51,234,.17),var(--panel) 55%)",
        }}
      >
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: ".14em",
            color: "var(--purple-2)",
            marginBottom: 6,
          }}
        >
          COMICVERSE ADMINISTRATION
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 4px", color: "#fff" }}>
          Add a comic from a provider
        </h1>
        <div className="psub" style={{ maxWidth: 640, lineHeight: 1.6, marginBottom: 0 }}>
          Choose a provider to search its catalogue, review title and chapter information, then approve and publish titles to ComicVerse.
        </div>
      </div>

      <State loading={loading} error={error} />

      {data && !data.enabled && (
        <div role="status" className="a-panel text-sm text-muted">
          External providers are disabled on the server. Enable external sources in the server configuration before using provider import.
        </div>
      )}

      {providers.length > 0 && (
        <section>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 10,
              margin: "2px 0 12px",
              flexWrap: "wrap",
            }}
            data-layer="Providers Heading"
          >
            <h2 style={{ fontFamily: "Poppins,sans-serif", fontSize: 16, margin: 0, color: "#fff" }}>
              Available providers
            </h2>
            <span style={{ color: "var(--muted)", fontSize: 12 }}>
              Select a provider to open its dedicated catalogue page.
            </span>
            <span style={{ marginLeft: "auto", color: "var(--muted)", fontSize: 12 }}>
              {providers.filter((p) => p.enabled).length} enabled
            </span>
          </div>

          <div className="prov-grid" data-layer="Provider Cards" style={{ marginBottom: 18 }}>
            {providers.map((provider, idx) => (
              <article
                key={provider.id}
                className={`prov-card${idx === 0 ? " sel" : ""}`}
                data-prov={provider.displayName}
              >
                <div className="pc-top">
                  <h4>{provider.displayName}</h4>
                  <span className="prov-active">
                    {provider.enabled ? "ACTIVE" : "DISABLED"}
                  </span>
                </div>
                <div className="pc-slug">{provider.id}</div>
                <p>{provider.attribution}</p>
                <div className="prov-types">
                  {provider.capabilities.types.map((type) => (
                    <span key={type}>{type.toUpperCase()}</span>
                  ))}
                </div>
                <div className="pc-foot">
                  <a
                    href={provider.officialUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="pc-web"
                  >
                    Provider website
                  </a>
                  {provider.enabled ? (
                    <Link
                      href={`/admin/comics/new/${encodeURIComponent(provider.id)}`}
                      className="prov-open"
                    >
                      Open provider
                    </Link>
                  ) : (
                    <span className="rowbtn opacity-50">Disabled</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
