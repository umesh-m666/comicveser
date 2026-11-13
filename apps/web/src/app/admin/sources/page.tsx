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
  capabilities: {
    search: boolean;
    details: boolean;
    chapters: boolean;
    pages: boolean;
    types: string[];
  };
  notes: string[];
  recentErrors: { at: string; code: string; message: string }[];
}

type AlertFilter = "all" | "published" | "failed" | "weebcentral" | "asurascans";

/**
 * Asura Admin Sources Page (#frame-admin-sources):
 * .a-top header, 3-card .stat-grid, Automatic Chapter Synchronization & Admin Alerts panel,
 * and source cards (.a-panel).
 */
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
  const activeCount = (data?.sources ?? []).filter((s) => s.enabled).length;
  const totalErrors = (data?.sources ?? []).reduce((acc, s) => acc + s.recentErrors.length, 0);

  return (
    <div>
      <div className="a-top" data-layer="Admin Topbar">
        <div>
          <h1>Sources</h1>
          <div className="sub">
            Where chapters come from — sync status for WeebCentral, AsuraScans &amp; ComicK.
          </div>
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
          style={{ marginLeft: "auto" }}
        >
          {busy === "sync-all"
            ? "Synchronizing All Comics…"
            : "Sync & Repair All Published Comics Now"}
        </button>
      </div>

      <div
        className="stat-grid"
        data-layer="Stat Cards"
        style={{ gridTemplateColumns: "repeat(3, 1fr)" }}
      >
        <div className="stat">
          <div className="k">Active Sources</div>
          <div className="v">{activeCount}</div>
          <div className="d up">All feeds reporting</div>
        </div>
        <div className="stat">
          <div className="k">Sync Alerts</div>
          <div className="v">{adminNotifs.data?.total ?? 0}</div>
          <div className="d up">Auto-sync &amp; publish log</div>
        </div>
        <div className="stat">
          <div className="k">Recent Errors</div>
          <div className="v">{totalErrors}</div>
          <div className={`d ${totalErrors > 0 ? "down" : "up"}`}>
            {totalErrors > 0 ? "Inspect provider logs" : "0 upstream timeouts"}
          </div>
        </div>
      </div>

      {syncMsg && (
        <div role="status" className="svc-alert mb-4" style={{ borderColor: "var(--purple-2)" }}>
          {syncMsg}
        </div>
      )}
      {err && (
        <p role="alert" className="mb-3 text-danger">
          {err}
        </p>
      )}
      <State loading={loading} error={error} />

      {/* Automatic Background Synchronization Status & Filters */}
      <section className="a-panel" data-layer="Automatic Synchronization">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h3>Automatic Chapter Synchronization &amp; Admin Alerts</h3>
            {syncStatus?.config && (
              <div className="psub" style={{ marginBottom: 0 }}>
                Auto-Sync: <strong>{syncStatus.config.enabled ? "Enabled" : "Disabled"}</strong> · Polling every{" "}
                <strong>{syncStatus.config.intervalMinutes} min</strong> · Batch size:{" "}
                <strong>{syncStatus.config.batchSize} comics</strong>
              </div>
            )}
          </div>
          <div
            className="flex flex-wrap gap-1.5"
            role="group"
            aria-label="Filter synchronization alerts"
          >
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
                className={`chip${alertFilter === k ? " on" : ""}`}
                style={{ padding: "4px 11px", fontSize: 11.5 }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {(adminNotifs.data?.items ?? []).length === 0 ? (
          <p className="text-xs text-muted m-0">
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
                  className="svc-alert flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`tag ${isFailed ? "red" : "green"}`}>
                        {isFailed ? "Failed" : "Published"}
                      </span>
                      {m.providerName && <span className="tag purple">{m.providerName}</span>}
                      <strong className="text-white">{item.title}</strong>
                    </div>
                    <p style={{ color: "var(--muted)", margin: 0 }}>{item.body}</p>
                  </div>
                  <div className="flex items-center gap-3 font-semibold">
                    {item.href && (
                      <Link href={item.href} className="rowbtn">
                        Open Chapter →
                      </Link>
                    )}
                    {m.sourceUrl && (
                      <a
                        href={m.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rowbtn"
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

        {(syncStatus?.conflicts?.length ?? 0) > 0 && (
          <div className="space-y-2 pt-3">
            <div className="svc-sub" style={{ color: "var(--amber)" }}>
              Chapter Number Conflicts Requiring Admin Review ({syncStatus!.conflicts.length})
            </div>
            {syncStatus!.conflicts.map((c: any, idx: number) => (
              <div key={idx} className="svc-alert">
                <p className="font-semibold text-white m-0">
                  {c.comicTitle} ({c.sourceId}) — Current Ch. {c.currentNumber} → Target Ch.{" "}
                  {c.targetNumber}
                </p>
                <p style={{ color: "var(--muted)", margin: "2px 0 6px" }}>{c.reason}</p>
                <Link
                  href={`/admin/chapters?comicId=${encodeURIComponent(c.comicId)}`}
                  className="rowbtn"
                >
                  Resolve in Chapter Manager →
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      {data && !data.enabled && (
        <div role="status" className="a-panel">
          External sources are turned off on the server (<code>SOURCES_ENABLED</code> is not{" "}
          <code>true</code>), so nothing is listed.
        </div>
      )}

      {data?.sources.map((s) => (
        <section key={s.id} className="a-panel">
          <div className="flex flex-wrap items-center gap-3">
            <h3>{s.displayName}</h3>
            <Badge v={s.enabled ? "ACTIVE" : "SUSPENDED"} />
            <span className="text-xs text-muted">id: {s.id}</span>
          </div>
          <p className="psub" style={{ marginTop: 4, marginBottom: 8 }}>
            Supports:{" "}
            {[
              s.capabilities.search && "search",
              s.capabilities.details && "details",
              s.capabilities.chapters && "chapter lists",
              s.capabilities.pages && "chapter pages",
            ]
              .filter(Boolean)
              .join(", ")}{" "}
            · types: {s.capabilities.types.join(", ")}
          </p>
          <ul className="mb-3 list-disc pl-5 text-xs text-muted">
            {s.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
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
                    [s.id]: r.ok
                      ? `Reachable (${r.latencyMs} ms)`
                      : `Not reachable: ${r.message ?? "unknown problem"}`,
                  }));
                })
              }
            >
              Test connectivity
            </button>
            <button
              type="button"
              className={btnGhost}
              onClick={() =>
                run(s.id + "e", () => act(`/admin/sources/${s.id}`, "PUT", { enabled: !s.enabled }))
              }
            >
              {s.enabled ? "Disable" : "Enable"}
            </button>
            <button
              type="button"
              className={btnGhost}
              onClick={() => {
                const n = prompt("Display name", s.displayName)?.trim();
                if (n && n !== s.displayName)
                  run(s.id + "n", () =>
                    act(`/admin/sources/${s.id}`, "PUT", { displayName: n }),
                  );
              }}
            >
              Rename
            </button>
            <a
              className={btnGhost}
              href={s.officialUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open site ↗
            </a>
          </div>
          {result[s.id] && (
            <p role="status" className="mt-2 text-sm text-white">
              {result[s.id]}
            </p>
          )}
          <div className="svc-sub">Recent errors</div>
          {s.recentErrors.length === 0 ? (
            <p className="text-xs text-muted m-0">None since the API last started.</p>
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
                    <td className="whitespace-nowrap">
                      {new Date(e.at).toLocaleString("en-IN")}
                    </td>
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
