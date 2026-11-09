"use client";
import { useState } from "react";
import { Badge, State, btn, btnGhost, table } from "@/components/admin/ui";
import { act, errMsg, useLoad } from "@/lib/useApi";

interface AdminSource { id: string; displayName: string; defaultName: string; enabled: boolean; officialUrl: string; capabilities: { search: boolean; details: boolean; chapters: boolean; pages: boolean; types: string[] }; notes: string[]; recentErrors: { at: string; code: string; message: string }[] }

export default function AdminSources() {
  const { data, error, loading, reload } = useLoad<{ enabled: boolean; config: { timeoutMs: number; hosts: string[] }; sources: AdminSource[] }>("/admin/sources");
  const [result, setResult] = useState<Record<string, string>>({}); const [err, setErr] = useState(""); const [busy, setBusy] = useState("");
  const run = async (key: string, fn: () => Promise<unknown>) => { setErr(""); setBusy(key); try { await fn(); reload(); } catch (e) { setErr(errMsg(e)); } finally { setBusy(""); } };

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">External sources</h1>
      <p className="mb-4 max-w-2xl text-sm text-muted">Sources are configured with environment variables on the API server (see docs/EXTERNAL-SOURCES.md). Here you can turn a source on or off, rename it, and check that it responds.</p>
      {err && <p role="alert" className="mb-2 text-danger">{err}</p>}<State loading={loading} error={error} />
      {data && !data.enabled && <p role="status" className="mb-4 rounded-lg border border-line bg-card p-4">External sources are turned off on the server (<code>SOURCES_ENABLED</code> is not <code>true</code>), so nothing is listed.</p>}
      {data && data.enabled && <p className="mb-4 text-sm text-muted">Source hosts: {data.config.hosts.join(", ")} · timeout {data.config.timeoutMs / 1000}s</p>}
      {data?.sources.map((s) => (
        <section key={s.id} className="mb-6 rounded-lg border border-line bg-card p-4">
          <div className="flex flex-wrap items-center gap-3"><h2 className="text-lg font-semibold">{s.displayName}</h2><Badge v={s.enabled ? "ACTIVE" : "SUSPENDED"} /><span className="text-xs text-muted">id: {s.id}</span></div>
          <p className="mt-1 text-sm text-muted">Supports: {[s.capabilities.search && "search", s.capabilities.details && "details", s.capabilities.chapters && "chapter lists", s.capabilities.pages && "chapter pages"].filter(Boolean).join(", ")} · types: {s.capabilities.types.join(", ")}</p>
          <ul className="mt-1 list-disc pl-5 text-xs text-muted">{s.notes.map((n) => <li key={n}>{n}</li>)}</ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <button disabled={busy === s.id + "t"} className={btn} onClick={() => run(s.id + "t", async () => { const r = await act<{ ok: boolean; latencyMs: number; message?: string }>(`/admin/sources/${s.id}/test`, "POST"); setResult((x) => ({ ...x, [s.id]: r.ok ? `Reachable (${r.latencyMs} ms)` : `Not reachable: ${r.message ?? "unknown problem"}` })); })}>Test connectivity</button>
            <button className={btnGhost} onClick={() => run(s.id + "e", () => act(`/admin/sources/${s.id}`, "PUT", { enabled: !s.enabled }))}>{s.enabled ? "Disable" : "Enable"}</button>
            <button className={btnGhost} onClick={() => { const n = prompt("Display name", s.displayName)?.trim(); if (n && n !== s.displayName) run(s.id + "n", () => act(`/admin/sources/${s.id}`, "PUT", { displayName: n })); }}>Rename</button>
            <a className={btnGhost} href={s.officialUrl} target="_blank" rel="noopener noreferrer">Open site</a>
          </div>
          {result[s.id] && <p role="status" className="mt-2 text-sm">{result[s.id]}</p>}
          <h3 className="mb-1 mt-4 text-sm font-semibold">Recent errors</h3>
          {s.recentErrors.length === 0 ? <p className="text-sm text-muted">None since the API last started.</p> : (
            <table className={table}><thead><tr><th>When</th><th>Code</th><th>Message</th></tr></thead><tbody>{s.recentErrors.map((e, i) => <tr key={i}><td className="whitespace-nowrap">{new Date(e.at).toLocaleString("en-IN")}</td><td>{e.code}</td><td>{e.message}</td></tr>)}</tbody></table>)}
        </section>))}
    </div>
  );
}
