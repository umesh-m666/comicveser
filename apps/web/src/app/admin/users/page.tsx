"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Pager, State, btnDanger, btnGhost, input, table } from "@/components/admin/ui";
import { act, errMsg, useLoad } from "@/lib/useApi";

export default function AdminUsers({ searchParams }: { searchParams: { q?: string; page?: string } }) {
  const router = useRouter(); const [err, setErr] = useState("");
  const sp = new URLSearchParams(Object.entries(searchParams).filter(([, v]) => v) as [string, string][]);
  const { data, error, loading, reload } = useLoad<{ items: any[]; page: number; pages: number }>(`/admin/users?${sp}`);
  const toggle = async (u: any) => { setErr(""); try { await act(`/admin/users/${u.id}/status`, "PUT", { status: u.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" }); reload(); } catch (e) { setErr(errMsg(e)); } };
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Users</h1>
      <form className="mb-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); router.push(`/admin/users?q=${encodeURIComponent(String(new FormData(e.currentTarget).get("q") ?? ""))}`); }}>
        <input name="q" defaultValue={searchParams.q} placeholder="Search username or email" className={input} aria-label="Search users" /><button className={btnGhost}>Search</button>
      </form>
      {err && <p role="alert" className="mb-2 text-danger">{err}</p>}<State loading={loading} error={error} />
      {data && <div className="overflow-x-auto"><table className={table}><thead><tr><th>Username</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th /></tr></thead>
        <tbody>{data.items.map((u) => (<tr key={u.id}><td className="font-medium">{u.username}</td><td>{u.email}{!u.emailVerifiedAt && <span className="ml-1 text-xs text-muted">(unverified)</span>}</td><td>{u.role}</td><td><Badge v={u.status} /></td>
          <td>{new Date(u.createdAt).toLocaleDateString("en-IN")}</td>
          <td className="text-right"><button className={u.status === "ACTIVE" ? btnDanger : btnGhost} onClick={() => (u.status !== "ACTIVE" || confirm(`Suspend ${u.username}? They will be signed out.`)) && toggle(u)}>{u.status === "ACTIVE" ? "Suspend" : "Restore"}</button></td></tr>))}</tbody></table></div>}
      {data && <Pager page={data.page} pages={data.pages} href={(p) => `/admin/users?${new URLSearchParams({ ...Object.fromEntries(sp), page: String(p) })}`} />}
    </div>
  );
}
