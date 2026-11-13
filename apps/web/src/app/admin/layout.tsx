"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  BookOpen,
  ExternalLink,
  Flag,
  Globe,
  Layers,
  LayoutDashboard,
  Megaphone,
  ScrollText,
  Settings,
  Tags,
  UserCog,
  Users,
} from "lucide-react";
import { api } from "@/lib/api";

// The shared top bar (Header from "@/components/Nav") is already rendered once
// for every page by the root layout (src/app/layout.tsx). Rendering it here as
// well would create a second top bar, so this layout only owns the sidebar.
const NAV: { label: string; href: string; Icon: typeof LayoutDashboard }[] = [
  { label: "Dashboard", href: "/admin", Icon: LayoutDashboard },
  { label: "Comics", href: "/admin/comics", Icon: BookOpen },
  { label: "Chapters", href: "/admin/chapters", Icon: Layers },
  { label: "Genres", href: "/admin/genres", Icon: Tags },
  { label: "Sources", href: "/admin/sources", Icon: Globe },
  { label: "Creators", href: "/admin/creators", Icon: Users },
  { label: "Reviews & reports", href: "/admin/reviews", Icon: Flag },
  { label: "Analytics", href: "/admin/analytics", Icon: BarChart3 },
  { label: "Users", href: "/admin/users", Icon: UserCog },
  { label: "Announcements", href: "/admin/announcements", Icon: Megaphone },
  { label: "Audit logs", href: "/admin/audit-logs", Icon: ScrollText },
];

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
  const isActive = (href: string) => (href === "/admin" ? path === href : path === href || path.startsWith(`${href}/`));
  const linkCls = (active: boolean) =>
    `flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm transition ${
      active
        ? "bg-[#9333EA]/15 font-semibold text-[#C084FC]"
        : "text-[#A8A1B5] hover:bg-[#211B2D] hover:text-white"
    }`;
  return (
    <div className="grid gap-5 md:grid-cols-[232px_1fr]">
      <nav aria-label="Admin" className="cv-panel flex gap-1 overflow-x-auto rounded-2xl border border-[#322A42] bg-[#17141F] p-2 shadow-[0_16px_40px_rgba(0,0,0,0.35)] md:sticky md:top-24 md:flex-col md:self-start">
        {NAV.map(({ label, href, Icon }) => (
          <Link key={href} href={href} aria-current={isActive(href) ? "page" : undefined} className={linkCls(isActive(href))}>
            <Icon size={17} aria-hidden />{label}
          </Link>
        ))}
        <div className="mx-1 my-1 hidden border-t border-[#322A42] md:block" aria-hidden />
        <Link href="/admin/settings" aria-current={isActive("/admin/settings") ? "page" : undefined} className={linkCls(isActive("/admin/settings"))}>
          <Settings size={17} aria-hidden />Settings
        </Link>
        <Link href="/" className={linkCls(false)}>
          <ExternalLink size={17} aria-hidden />View Site
        </Link>
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
