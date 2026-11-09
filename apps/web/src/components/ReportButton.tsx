"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Flag } from "lucide-react";
import { ApiError, api } from "@/lib/api";

export default function ReportButton({ comicId }: { comicId: string }) {
  const router = useRouter(); const [msg, setMsg] = useState("");
  async function report() {
    const reason = prompt("What's the problem with this comic? (for example copyright, or inappropriate content)")?.trim();
    if (!reason) return;
    if (reason.length < 5) return setMsg("Please give a little more detail.");
    try { await api("/reports", { method: "POST", json: { targetType: "COMIC", targetId: comicId, reason }, credentials: "include" }); setMsg("Thanks, we'll review it."); }
    catch (e) { if (e instanceof ApiError && e.status === 401) router.push("/login"); else setMsg("Couldn't send your report. Try again."); }
  }
  return (
    <span><button onClick={report} className="flex items-center gap-2 rounded-md border border-line px-4 py-2.5 font-semibold hover:bg-card"><Flag size={16} aria-hidden />Report</button>
      {msg && <span role="status" className="ml-2 text-sm text-muted">{msg}</span>}</span>
  );
}
