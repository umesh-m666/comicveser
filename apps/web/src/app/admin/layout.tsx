"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const NAV = [["Dashboard", "/admin"], ["Comics", "/admin/comics"], ["Chapters", "/admin/chapters"], ["Genres", "/admin/genres"], ["Sources", "/admin/sources"], ["Creators", "/admin/creators"], ["Reviews & reports", "/admin/reviews"], ["Analytics", "/admin/analytics"], ["Users", "/admin/users"], ["Announcements", "/admin/announcements"], ["Audit logs", "/admin/audit-logs"]];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [st, setSt] = useState<"loading" | "anon" | "denied" | "ok">("loading");
  useEffect(() => {
    api<{ role: string }>("/auth/me", { credentials: "include" })
      .then((u) => setSt(u.role === "ADMIN" ? "ok" : "denied")).catch(() => setSt("anon"));
  }, []);
  if (st === "loading") return <div className="skeleton h-40" aria-busy="true" />;
  if (st === "anon") return <p>Please <Link href="/login" className="text-primary">log in</Link> with an admin account.</p>;
  if (st === "denied") return <p role="alert">Your account doesn't have admin access.</p>;
  return (
    <div className="grid gap-5 md:grid-cols-[220px_1fr]">
      <nav aria-label="Admin" className="cv-panel flex gap-1 overflow-x-auto p-2 md:sticky md:top-24 md:flex-col md:self-start">
        {NAV.map(([l, h]) => (
          <Link key={h} href={h} className={`whitespace-nowrap rounded-lg px-3 py-2.5 text-sm transition ${(h === "/admin" ? path === h : path.startsWith(h)) ? "bg-card font-semibold text-primary" : "text-muted hover:bg-card hover:text-fg"}`}>{l}</Link>
        ))}
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
