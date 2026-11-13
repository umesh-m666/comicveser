"use client";
import { useRef } from "react";
import { usePathname } from "next/navigation";
import { tabIndex } from "@/lib/nav";

/**
 * Fade + slide-in for every route change. Moving between two bottom-bar destinations slides in from the side the new tab
 * sits on; everything else slides up. CSS only (see .cv-page), so it respects prefers-reduced-motion.
 */
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const state = useRef<{ path: string; dir: "up" | "left" | "right" }>({ path, dir: "up" });
  if (state.current.path !== path) {
    const from = tabIndex(state.current.path), to = tabIndex(path);
    state.current = { path, dir: from >= 0 && to >= 0 && from !== to ? (to > from ? "right" : "left") : "up" };
  }
  return <div key={path} data-dir={state.current.dir} className="cv-page">{children}</div>;
}
