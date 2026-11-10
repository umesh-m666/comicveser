import { RefObject, useEffect } from "react";

/** Calls `close` on an outside press or Escape while `open`. Used by every popup menu. */
export function useDismiss(ref: RefObject<HTMLElement>, open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const press = (e: MouseEvent | TouchEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("mousedown", press);
    document.addEventListener("touchstart", press, { passive: true });
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", press); document.removeEventListener("touchstart", press); document.removeEventListener("keydown", key); };
  }, [open, ref, close]);
}
