"use client";
import Link from "next/link";
import { useState } from "react";
import ProfileNav from "@/components/ProfileNav";
import { ApiError } from "@/lib/api";
import { State } from "@/components/admin/ui";
import { act, useLoad } from "@/lib/useApi";

export default function Notifications() {
  const { data, error, loading, reload } = useLoad<{ unread: number; prefs: { newChapter: boolean }; items: { id: string; title: string; body: string; href: string | null; readAt: string | null; createdAt: string }[] }>("/user/notifications");
  const [msg, setMsg] = useState("");
  if (error instanceof ApiError && error.status === 401) return <p>Please <Link href="/login" className="text-primary">log in</Link> to see your notifications.</p>;
  return (
    <div>
      <ProfileNav active="/profile/notifications" />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h1 className="text-2xl font-bold">Notifications</h1>
        {data && data.unread > 0 && <button className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-card" onClick={async () => { await act("/user/notifications/read", "POST", {}); reload(); window.dispatchEvent(new Event("cv:notifications")); }}>Mark all as read</button>}</div>
      <State loading={loading} error={error} />
      {data && (<>
        <label className="mb-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={data.prefs.newChapter} onChange={async (e) => { await act("/user/notification-settings", "PUT", { newChapter: e.target.checked }); setMsg("Saved."); reload(); }} />
          Notify me when a bookmarked comic gets a new chapter</label>{msg && <p role="status" className="mb-2 text-sm text-success">{msg}</p>}
        {data.items.length === 0 ? <p className="text-muted">You're all caught up. Bookmark a comic to hear about new chapters.</p> : (
          <ul className="space-y-2">{data.items.map((n) => (
            <li key={n.id} className={`rounded-lg border p-3 ${n.readAt ? "border-line bg-card" : "border-primary bg-card"}`}>
              <p className="font-medium">{n.href ? <Link href={n.href} onClick={() => act("/user/notifications/read", "POST", { ids: [n.id] }).then(() => window.dispatchEvent(new Event("cv:notifications")))} className="hover:text-primary">{n.title}</Link> : n.title}</p>
              <p className="text-sm text-muted">{n.body} · {new Date(n.createdAt).toLocaleDateString("en-IN")}</p></li>))}</ul>)}
      </>)}
    </div>
  );
}
