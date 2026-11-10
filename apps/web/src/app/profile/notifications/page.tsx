import { Suspense } from "react";
import NotificationsView from "@/components/NotificationsView";
export const metadata = { title: "Messages & alerts" };
export default function Page() { return <Suspense fallback={<div className="skeleton h-40" aria-busy="true" />}><NotificationsView /></Suspense>; }
