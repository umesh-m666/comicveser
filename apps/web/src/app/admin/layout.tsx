"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { ComicVerseLogo, ComicVerseMark } from "@/components/ComicVerseLogo";
import { loginUrl } from "@/lib/auth-redirect";

const NAV = [
  ["Dashboard", "/admin"],
  ["Comics", "/admin/comics"],
  ["Chapters", "/admin/chapters"],
  ["Genres", "/admin/genres"],
  ["Sources", "/admin/sources"],
  ["Creators", "/admin/creators"],
  ["Reviews & reports", "/admin/reviews"],
  ["Analytics", "/admin/analytics"],
  ["Users", "/admin/users"],
  ["Announcements", "/admin/announcements"],
  ["Audit logs", "/admin/audit-logs"],
] as const;

/**
 * Asura Admin Layout (#frame-admin-* & #frame-mobile-admin):
 * Floating left sidebar card (.a-side) with ComicVerse SVG brand header, .a-nav links + .foot admin badge,
 * and .a-main content area with horizontal .a-tabs pill bar.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { user, status, isAdmin, expired } = useAuth();

  useEffect(() => {
    if (status === "anonymous") router.replace(loginUrl(path, expired));
  }, [status, expired, path, router]);

  if (status === "loading" || status === "anonymous") {
    return <div className="skeleton h-40" aria-busy="true" />;
  }
  if (status === "error") {
    return (
      <p role="alert" className="text-danger">
        Can&apos;t reach the server to check your session. Refresh the page to try again.
      </p>
    );
  }
  if (!isAdmin) {
    return (
      <div role="alert" className="panel mx-auto max-w-md py-8 text-center">
        <div className="mx-auto mb-3 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[#2F2250] p-2.5 border border-white/15">
          <ComicVerseLogo className="h-full w-full" />
        </div>
        <h1 className="text-xl font-bold text-white">Admin access required</h1>
        <p className="mt-2 text-sm text-muted">
          Your account doesn&apos;t have permission to open the Admin Panel.
        </p>
        <Link href="/account" className="pillbtn mt-4 inline-flex !ml-0">
          Back to my account
        </Link>
      </div>
    );
  }

  const isRouteActive = (href: string) =>
    href === "/admin" ? path === "/admin" : path.startsWith(href);

  return (
    <div className="admin">
      <aside className="a-side" data-layer="Admin Sidebar">
        <Link
          href="/admin"
          className="mb-3 flex items-center gap-2.5 rounded-lg border border-white/10 bg-[#2F2250] px-3 py-2.5 text-white no-underline"
        >
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1d1030] p-1 border border-white/25">
            <ComicVerseMark className="h-full w-full" />
          </span>
          <span className="min-w-0 leading-tight">
            <strong className="block truncate text-sm font-extrabold text-white">
              Comic<span className="text-[#C0BBF3]">Verse</span>
            </strong>
            <span className="pm-badge !mt-0.5 !px-2 !py-0 text-[10px]">ADMIN</span>
          </span>
        </Link>
        <nav aria-label="Admin" className="a-nav" data-layer="Admin Navigation Bar">
          {NAV.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className={isRouteActive(href) ? "on" : undefined}
            >
              {label}
            </Link>
          ))}
          <Link href="/">View Site</Link>
        </nav>
        <div className="foot">
          <b>{user?.username ?? "Admin"} — Admin</b>
          Signed in with full access. Every change here publishes to the reader app instantly.
        </div>
      </aside>

      <div className="a-main">
        <div
          className="a-tabs"
          data-layer="Admin Page Tabs"
          role="navigation"
          aria-label="Admin pages"
        >
          {NAV.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className={isRouteActive(href) ? "on" : undefined}
            >
              {label}
            </Link>
          ))}
        </div>

        {children}
      </div>
    </div>
  );
}
