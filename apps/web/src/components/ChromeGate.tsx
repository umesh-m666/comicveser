"use client";
import { usePathname } from "next/navigation";
import PageTransition from "./PageTransition";

/** Chapter reader routes render with no site chrome at all: just the artwork and the reader's own overlay. */
export const isReaderPath = (path: string | null) =>
  !!path && (/^\/comics\/[^/]+\/chapter\/[^/]+/.test(path) || /^\/sources\/[^/]+\/[^/]+\/read\/[^/]+/.test(path));

/** Home and Comic Detail pages render their own full-bleed hero banners before their inner .wrap container. */
export const isFullBleedPath = (path: string | null) =>
  path === "/" || (!!path && /^\/comics\/[^/]+$/.test(path));

export default function ChromeGate({
  header,
  footer,
  bottomNav,
  children,
}: {
  header: React.ReactNode;
  footer: React.ReactNode;
  bottomNav: React.ReactNode;
  children: React.ReactNode;
}) {
  const path = usePathname();
  if (isReaderPath(path)) return <>{children}</>;
  const fullBleed = isFullBleedPath(path);
  return (
    <>
      {header}
      <main className={fullBleed ? "" : "wrap py-6"}>
        <PageTransition>{children}</PageTransition>
      </main>
      {footer}
      {bottomNav}
    </>
  );
}
