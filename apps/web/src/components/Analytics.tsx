"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getConsent, track } from "@/lib/analytics";

export default function Analytics() {
  const path = usePathname();
  const [choice, setChoice] = useState<string | null | undefined>(undefined);
  useEffect(() => setChoice(getConsent()), []);
  useEffect(() => { if (choice === "granted" && !path.startsWith("/admin")) track({ type: "PAGE_VIEW", path }); }, [path, choice]);
  const decide = (v: "granted" | "denied") => { try { localStorage.setItem("cv:consent", v); } catch {} setChoice(v); };
  if (choice !== null) return null;
  return (
    <div role="dialog" aria-label="Analytics consent" className="fixed inset-x-3 bottom-20 z-40 mx-auto max-w-xl rounded-xl border border-line bg-surface p-4 text-sm shadow-lg md:bottom-4">
      <p>Help us improve ComicVerse? With your OK we count page visits, comic and chapter views and searches. We don't store your IP address or use advertising cookies. If you're logged in, activity is linked to your account to count active readers.</p>
      <div className="mt-3 flex gap-2">
        <button onClick={() => decide("granted")} className="rounded-md bg-primary px-3 py-1.5 font-semibold">Accept</button>
        <button onClick={() => decide("denied")} className="rounded-md border border-line px-3 py-1.5 hover:bg-card">No thanks</button>
      </div>
    </div>
  );
}
