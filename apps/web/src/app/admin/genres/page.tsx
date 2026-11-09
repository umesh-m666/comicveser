"use client";
import { useState } from "react";
import { State, btn, btnDanger, btnGhost, input, table } from "@/components/admin/ui";
import { act, errMsg, useLoad } from "@/lib/useApi";

export default function AdminGenres() {
  const { data, error, loading, reload } = useLoad<{ id: string; name: string; _count: { comics: number } }[]>("/genres");
  const [err, setErr] = useState("");
  const run = async (fn: () => Promise<unknown>) => { setErr(""); try { await fn(); reload(); } catch (e) { setErr(errMsg(e)); } };
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Genres</h1>
      <form className="mb-4 flex max-w-sm gap-2" onSubmit={(e) => { e.preventDefault(); const f = e.currentTarget; const name = String(new FormData(f).get("name")).trim(); if (name) run(async () => { await act("/admin/genres", "POST", { name }); f.reset(); }); }}>
        <input name="name" placeholder="New genre" maxLength={60} className={input} aria-label="New genre name" /><button className={btn}>Add</button>
      </form>
      {err && <p role="alert" className="mb-2 text-danger">{err}</p>}<State loading={loading} error={error} />
      {data && <table className={table}><thead><tr><th>Name</th><th>Comics</th><th /></tr></thead><tbody>{data.map((g) => (
        <tr key={g.id}><td>{g.name}</td><td>{g._count.comics}</td><td className="flex justify-end gap-2">
          <button className={btnGhost} onClick={() => { const n = prompt("Rename genre", g.name)?.trim(); if (n && n !== g.name) run(() => act(`/admin/genres/${g.id}`, "PUT", { name: n })); }}>Rename</button>
          <button className={btnDanger} onClick={() => confirm(`Delete "${g.name}"? It will be removed from ${g._count.comics} comic(s).`) && run(() => act(`/admin/genres/${g.id}`, "DELETE"))}>Delete</button></td></tr>))}</tbody></table>}
    </div>
  );
}
