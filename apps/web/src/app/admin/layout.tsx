"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { loginUrl } from "@/lib/auth-redirect";

const NAV = [["Dashboard", "/admin"], ["Comics", "/admin/comics"], ["Chapters", "/admin/chapters"], ["Genres", "/admin/genres"], ["Sources", "/admin/sources"], ["Creators", "/admin/creators"], ["Reviews & reports", "/admin/reviews"], ["Analytics", "/admin/analytics"], ["Users", "/admin/users"], ["Announcements", "/admin/announcements"], ["Audit logs", "/admin/audit-logs"]];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { status, isAdmin, expired } = useAuth();
  useEffect(() => { if (status === "anonymous") router.replace(loginUrl(path, expired)); }, [status, expired, path, router]);
  // The role shown here only decides what to render; every /admin API call is authorised again by the backend.
  if (status === "loading" || status === "anonymous") return <div className="skeleton h-40" aria-busy="true" />;
  if (status === "error") return <p role="alert" className="text-danger">Can't reach the server to check your session. Refresh the page to try again.</p>;
  if (!isAdmin) return <div role="alert" className="mx-auto max-w-md py-8 text-center"><h1 className="text-xl font-bold">Admin access required</h1><p className="mt-2 text-sm text-muted">Your account doesn't have permission to open the Admin Panel.</p><Link href="/account" className="mt-4 inline-block text-primary">Back to my account</Link></div>;
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
