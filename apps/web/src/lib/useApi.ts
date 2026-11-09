"use client";
import { useEffect, useState } from "react";
import { ApiError, api } from "./api";

export function useLoad<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null); const [error, setError] = useState<ApiError | null>(null); const [n, setN] = useState(0);
  useEffect(() => {
    if (!path) return; let live = true; setError(null);
    api<T>(path, { credentials: "include", cache: "no-store" }).then((d) => live && setData(d)).catch((e) => live && setError(e));
    return () => { live = false; };
  }, [path, n]);
  return { data, error, loading: !data && !error, reload: () => setN((x) => x + 1) };
}
export const act = <T = void>(path: string, method: string, json?: unknown) => api<T>(path, { method, json, credentials: "include" });
export const errMsg = (e: unknown) => (e instanceof ApiError ? (e.details?.length ? e.details.join(" ") : e.message) : "Something went wrong.");
