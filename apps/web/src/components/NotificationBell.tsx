"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "./AuthProvider";

/** Bell with the live unread count. Reloads whenever the signed-in user changes or notifications are marked read. */
export default function NotificationBell() {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!user) { setUnread(0); return; }
    let live = true;
    const load = () => api<{ unread: number }>("/user/notifications", { credentials: "include" }).then((n) => live && setUnread(n.unread)).catch(() => {});
    load();
    window.addEventListener("cv:notifications", load);
    return () => { live = false; window.removeEventListener("cv:notifications", load); };
  }, [user]);
  return (
    <Link href="/profile/notifications" className="cv-iconbtn" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}>
      <Bell size={18} aria-hidden />
      {unread > 0 && <span className="cv-badge" aria-hidden>{unread > 99 ? "99+" : unread}</span>}
    </Link>
  );
}
