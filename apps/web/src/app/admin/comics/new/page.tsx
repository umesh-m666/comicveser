"use client";

import Link from "next/link";
import { useState } from "react";
import ComicForm from "@/components/admin/ComicForm";
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
 * Asura Admin Add Comic Page (#frame-admin-comics -> Add Comic / Provider Flow + Manual ComicForm):
 * Matches the Figma provider cards (.prov-grid, .prov-card, .pc-top, .prov-active, .prov-types, .prov-open)
 * AND includes the manual ComicForm so both provider catalogue import and direct comic creation work seamlessly.
 */
export default function NewComic() {
  const { data, error, loading } = useLoad<{ enabled: boolean; sources: Provider[] }>(
    "/admin/sources",
  );
  const [showManual, setShowManual] = useState(false);
  const providers = data?.sources ?? [];

  return (
<<<<<<< HEAD
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/admin/comics" className="rowbtn">
          ← Back to Comics
        </Link>
        <button
          type="button"
          onClick={() => setShowManual((v) => !v)}
          className="rowbtn"
        >
          {showManual ? "Hide manual form" : "＋ Create comic manually"}
        </button>
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
=======
    <main className="space-y-6">
      <header className="rounded-2xl border border-[#322A42] bg-[#17141F] p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#C084FC]">ComicVerse administration</p>
        <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">Add a comic from a provider</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#A8A1B5]">
>>>>>>> 44714f483b778704646c40bf4db1fe37e116786e
          Choose a provider to search its catalogue, review title and chapter information, then approve and publish titles to ComicVerse.
        </div>
      </div>

      <State loading={loading} error={error} />

      {data && !data.enabled && (
<<<<<<< HEAD
        <div role="status" className="a-panel text-sm text-muted">
          External providers are disabled on the server. Enable external sources in the server configuration before using provider import, or create a comic manually below.
        </div>
=======
        <p role="status" className="rounded-lg border border-[#322A42] bg-[#17141F] p-4 text-sm text-[#A8A1B5]">
          External providers are disabled on the server. Enable external sources in the server configuration before using this page.
        </p>
      )}
      {data && data.enabled && providers.filter((provider) => provider.enabled).length === 0 && (
        <p role="status" className="rounded-lg border border-[#322A42] bg-[#17141F] p-4 text-sm text-[#A8A1B5]">
          No providers are enabled. Enable a provider from Admin → Sources before browsing its catalogue.
        </p>
>>>>>>> 44714f483b778704646c40bf4db1fe37e116786e
      )}

      {providers.length > 0 && (
        <section>
<<<<<<< HEAD
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
=======
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-white">Available providers</h2>
              <p className="text-sm text-[#A8A1B5]">Select a provider to open its dedicated catalogue page.</p>
            </div>
            <span className="text-xs text-[#A8A1B5]">{providers.filter((provider) => provider.enabled).length} enabled</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {providers.map((provider) => (
              <article key={provider.id} className="flex min-h-48 flex-col rounded-2xl border border-[#322A42] bg-[#17141F] p-5 transition hover:border-[#9333EA]/60">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-white">{provider.displayName}</h3>
                    <p className="mt-1 text-xs text-[#A8A1B5]">{provider.id}</p>
                  </div>
                  <Badge v={provider.enabled ? "ACTIVE" : "DISABLED"} />
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-[#A8A1B5]">{provider.attribution}</p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {provider.capabilities.types.map((type) => (
                    <span key={type} className="rounded-full border border-[#322A42] px-2 py-1 text-xs text-[#A8A1B5]">{type.toUpperCase()}</span>
                  ))}
                </div>
                <div className="mt-auto flex items-center justify-between gap-3 pt-5">
                  <a href={provider.officialUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[#A8A1B5] underline underline-offset-4">Provider website</a>
                  {provider.enabled ? (
                    <Link href={`/admin/comics/new/${encodeURIComponent(provider.id)}`} className="rounded-lg bg-[#9333EA] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110">Open provider</Link>
                  ) : (
                    <span className="rounded-lg border border-[#322A42] px-4 py-2 text-sm text-[#A8A1B5]">Disabled</span>
>>>>>>> 44714f483b778704646c40bf4db1fe37e116786e
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Manual Comic Creation Form (always accessible for manual / e2e creation) */}
      <div className="a-panel" data-layer="Add Comic Form">
        <h3>Add a new comic manually</h3>
        <div className="psub">
          No provider? Enter the title details yourself to create a draft or published comic directly.
        </div>
        <ComicForm mode="admin" />
      </div>
    </div>
  );
}
