"use client";
import { usePathname } from "next/navigation";
import PageTransition from "./PageTransition";

/** Chapter reader routes render with no site chrome at all: just the artwork and the reader's own overlay. */
export const isReaderPath = (path: string | null) =>
  !!path && (/^\/comics\/[^/]+\/chapter\/[^/]+/.test(path) || /^\/sources\/[^/]+\/[^/]+\/read\/[^/]+/.test(path));

export default function ChromeGate({ header, footer, bottomNav, children }: { header: React.ReactNode; footer: React.ReactNode; bottomNav: React.ReactNode; children: React.ReactNode }) {
  const path = usePathname();
  if (isReaderPath(path)) return <>{children}</>;
  return (
    <>
      {header}
      <main className="mx-auto max-w-7xl px-4 py-6 md:py-8"><PageTransition>{children}</PageTransition></main>
      {footer}
      {bottomNav}
    </>
  );
}
