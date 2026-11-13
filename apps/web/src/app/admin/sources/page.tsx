"use client";
import Link from "next/link";
import { useState } from "react";
import { Badge, State, btn, btnGhost, table } from "@/components/admin/ui";
import { act, errMsg, useLoad } from "@/lib/useApi";

interface AdminSource {
  id: string;
  displayName: string;
  defaultName: string;
  enabled: boolean;
  officialUrl: string;
  capabilities: { search: boolean; details: boolean; chapters: boolean; pages: boolean; types: string[] };
  notes: string[];
  recentErrors: { at: string; code: string; message: string }[];
}

type AlertFilter = "all" | "published" | "failed" | "weebcentral" | "asurascans";

export default function AdminSources() {
  const { data, error, loading, reload } = useLoad<{
    enabled: boolean;
    config: { timeoutMs: number; hosts: string[] };
    sources: AdminSource[];
  }>("/admin/sources");

  const [alertFilter, setAlertFilter] = useState<AlertFilter>("all");
  const adminNotifs = useLoad<{
    total: number;
    items: any[];
    syncStatus?: {
      config: { enabled: boolean; intervalMinutes: number; batchSize: number };
      recentRuns: any[];
      conflicts: any[];
      failedImports: any[];
    };
  }>(`/admin/notifications?filter=${alertFilter}`);

  const [result, setResult] = useState<Record<string, string>>({});
  const [syncMsg, setSyncMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setErr("");
    setBusy(key);
    try {
      await fn();
      reload();
      adminNotifs.reload();
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy("");
    }
  };

  const syncStatus = adminNotifs.data?.syncStatus;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">External Sources &amp; Automatic Synchronization</h1>
          <p className="mt-1 max-w-2xl text-sm text-[#A8A1B5]">
            Manage WeebCentral and AsuraScans integrations, monitor automatic background chapter detection, repair existing published comics, and inspect admin publication alerts.
          </p>
        </div>
        <button
          type="button"
          disabled={busy === "sync-all"}
          onClick={() =>
            run("sync-all", async () => {
              const r = await act<{
                checkedComics: number;
                repairedChapters: number;
                publishedChapters: number;
                failedChapters: number;
                conflicts: number;
              }>("/admin/sources/sync", "POST", {});
              setSyncMsg(
                `Synchronized ${r.checkedComics} comic(s): repaired ${r.repairedChapters} existing chapter(s), auto-published ${r.publishedChapters} new chapter(s), ${r.failedChapters} failed, ${r.conflicts} conflict(s).`,
              );
            })
          }
          className={btn}
        >
          {busy === "sync-all" ? "Synchronizing All Comics…" : "Sync & Repair All Published Comics Now"}
        </button>
      </div>

      {syncMsg && (
        <div role="status" className="rounded-xl border border-[#A855F7]/50 bg-[#211B2D] p-4 text-sm text-white">
          {syncMsg}
        </div>
      )}
      {err && (
        <p role="alert" className="text-danger">
          {err}
        </p>
      )}
      <State loading={loading} error={error} />

      {/* Automatic Background Synchronization Status & Filters */}
      <section className="rounded-xl border border-line bg-[#211B2D] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white">Automatic Chapter Synchronization &amp; Admin Alerts</h2>
            {syncStatus?.config && (
              <p className="text-xs text-[#A8A1B5]">
                Auto-Sync: <strong>{syncStatus.config.enabled ? "Enabled" : "Disabled"}</strong> · Polling every{" "}
                <strong>{syncStatus.config.intervalMinutes} min</strong> · Batch size:{" "}
                <strong>{syncStatus.config.batchSize} comics</strong>
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter synchronization alerts">
            {(
              [
                ["all", "All"],
                ["published", "Published"],
                ["failed", "Failed"],
                ["weebcentral", "WeebCentral"],
                ["asurascans", "AsuraScans"],
              ] as [AlertFilter, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setAlertFilter(k)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  alertFilter === k
                    ? "bg-[#9333EA] text-white"
                    : "bg-[#100E16] text-[#A8A1B5] hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {(adminNotifs.data?.items ?? []).length === 0 ? (
          <p className="rounded-lg border border-line bg-[#100E16] p-4 text-xs text-[#A8A1B5]">
            No synchronization alerts recorded for filter &ldquo;{alertFilter}&rdquo;.
          </p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {adminNotifs.data?.items.map((item: any) => {
              const m = item.meta ?? {};
              const isFailed = m.status === "FAILED" || item.title?.includes("failed");
              return (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-[#100E16] p-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                          isFailed ? "bg-rose-500/20 text-rose-300" : "bg-emerald-500/20 text-emerald-300"
                        }`}
                      >
                        {isFailed ? "Failed" : "Published"}
                      </span>
                      {m.providerName && (
                        <span className="rounded bg-[#211B2D] px-2 py-0.5 font-semibold text-[#A855F7]">
                          {m.providerName}
                        </span>
                      )}
                      <span className="font-bold text-white">{item.title}</span>
                    </div>
                    <p className="text-[#A8A1B5]">{item.body}</p>
                  </div>
                  <div className="flex items-center gap-3 font-semibold">
                    {item.href && (
                      <Link href={item.href} className="text-[#A855F7] hover:underline">
                        Open Chapter →
                      </Link>
                    )}
                    {m.sourceUrl && (
                      <a
                        href={m.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#A8A1B5] hover:text-white"
                      >
                        Source ↗
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Conflicts & Failed Chapter Imports */}
        {(syncStatus?.conflicts?.length ?? 0) > 0 && (
          <div className="space-y-2 pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400">
              Chapter Number Conflicts Requiring Admin Review ({syncStatus!.conflicts.length})
            </h3>
            {syncStatus!.conflicts.map((c: any, idx: number) => (
              <div key={idx} className="rounded-lg border border-amber-500/30 bg-[#100E16] p-3 text-xs">
                <p className="font-semibold text-white">
                  {c.comicTitle} ({c.sourceId}) — Current Ch. {c.currentNumber} → Target Ch. {c.targetNumber}
                </p>
                <p className="text-[#A8A1B5]">{c.reason}</p>
                <Link
                  href={`/admin/chapters?comicId=${encodeURIComponent(c.comicId)}`}
                  className="mt-1 inline-block font-semibold text-[#A855F7] hover:underline"
                >
                  Resolve in Chapter Manager →
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      {data && !data.enabled && (
        <p role="status" className="mb-4 rounded-lg border border-line bg-card p-4">
          External sources are turned off on the server (<code>SOURCES_ENABLED</code> is not <code>true</code>), so nothing is listed.
        </p>
      )}
      {data && data.enabled && (
        <p className="text-sm text-[#A8A1B5]">
          Source hosts: {data.config.hosts.join(", ")} · timeout {data.config.timeoutMs / 1000}s
        </p>
      )}
      {data?.sources.map((s) => (
        <section key={s.id} className="rounded-xl border border-line bg-[#211B2D] p-5">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold text-white">{s.displayName}</h2>
            <Badge v={s.enabled ? "ACTIVE" : "SUSPENDED"} />
            <span className="text-xs text-[#A8A1B5]">id: {s.id}</span>
          </div>
          <p className="mt-1 text-sm text-[#A8A1B5]">
            Supports: {[
              s.capabilities.search && "search",
              s.capabilities.details && "details",
              s.capabilities.chapters && "chapter lists",
              s.capabilities.pages && "chapter pages",
            ]
              .filter(Boolean)
              .join(", ")}{" "}
            · types: {s.capabilities.types.join(", ")}
          </p>
          <ul className="mt-1 list-disc pl-5 text-xs text-[#A8A1B5]">
            {s.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              disabled={busy === s.id + "t"}
              className={btn}
              onClick={() =>
                run(s.id + "t", async () => {
                  const r = await act<{ ok: boolean; latencyMs: number; message?: string }>(
                    `/admin/sources/${s.id}/test`,
                    "POST",
                  );
                  setResult((x) => ({
                    ...x,
                    [s.id]: r.ok ? `Reachable (${r.latencyMs} ms)` : `Not reachable: ${r.message ?? "unknown problem"}`,
                  }));
                })
              }
            >
              Test connectivity
            </button>
            <button
              className={btnGhost}
              onClick={() => run(s.id + "e", () => act(`/admin/sources/${s.id}`, "PUT", { enabled: !s.enabled }))}
            >
              {s.enabled ? "Disable" : "Enable"}
            </button>
            <button
              className={btnGhost}
              onClick={() => {
                const n = prompt("Display name", s.displayName)?.trim();
                if (n && n !== s.displayName)
                  run(s.id + "n", () => act(`/admin/sources/${s.id}`, "PUT", { displayName: n }));
              }}
            >
              Rename
            </button>
            <a className={btnGhost} href={s.officialUrl} target="_blank" rel="noopener noreferrer">
              Open site
            </a>
          </div>
          {result[s.id] && <p role="status" className="mt-2 text-sm text-white">{result[s.id]}</p>}
          <h3 className="mb-1 mt-4 text-sm font-semibold text-white">Recent errors</h3>
          {s.recentErrors.length === 0 ? (
            <p className="text-sm text-[#A8A1B5]">None since the API last started.</p>
          ) : (
            <table className={table}>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Code</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {s.recentErrors.map((e, i) => (
                  <tr key={i}>
                    <td className="whitespace-nowrap">{new Date(e.at).toLocaleString("en-IN")}</td>
                    <td>{e.code}</td>
                    <td>{e.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ))}
    </div>
  );
}
