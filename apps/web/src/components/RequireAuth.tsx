"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { loginUrl } from "@/lib/auth-redirect";

/**
 * Client-side guard for pages that need a signed-in user. It waits for the real session check before deciding,
 * so a signed-in user never sees a flash of the login page. The backend still enforces access on every API call.
 */
export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status, expired } = useAuth();
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    if (status === "anonymous") {
      const search = typeof window !== "undefined" ? window.location.search : "";
      router.replace(loginUrl(path + search, expired));
    }
  }, [status, expired, path, router]);

  if (status === "authenticated") return <>{children}</>;
  if (status === "error") return <p role="alert" className="text-danger">Can't reach the server to check your session. Check your connection and refresh the page.</p>;
  return <div className="space-y-3" aria-busy="true"><div className="skeleton h-24" /><div className="skeleton h-40" /></div>;
}
