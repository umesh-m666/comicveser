import type { Metadata } from "next";
import Link from "next/link";
import StaticPage from "@/components/StaticPage";
import { ComicVerseLogo } from "@/components/ComicVerseLogo";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "About" };

export default function About() {
  return (
    <StaticPage title={`About ${SITE.name}`}>
      <div className="mb-6 flex items-center gap-4 rounded-xl border border-white/10 bg-[#2F2250] p-5">
        <ComicVerseLogo className="h-16 w-auto shrink-0" />
        <p className="!m-0 text-sm text-[#e9d5ff]">
          {SITE.name} is a modern manga, manhwa, manhua, and webtoon reading platform built for fast chapter updates and seamless reading across all devices.
        </p>
      </div>
      <p>
        {SITE.name} is a place to read manga, manhwa, manhua, and webtoons. Every series on the site is either original work published by its creator or licensed for distribution here.
      </p>
      <h2>For readers</h2>
      <p>
        Bookmark series, pick up where you left off on any device, rate and review what you read, and get a notification when a bookmarked series has a new chapter.{" "}
        <Link href="/browse">Browse the catalog</Link>.
      </p>
      <h2>For creators</h2>
      <p>
        If you own the rights to your work, you can apply to publish it. Every submission, and the rights information that comes with it, is reviewed before it goes live.{" "}
        <Link href="/creator/dashboard">Open the creator portal</Link>.
      </p>
      <h2>Rights holders</h2>
      <p>
        If you believe something on the site infringes your rights, see our{" "}
        <Link href="/copyright-policy">copyright policy</Link>.
      </p>
    </StaticPage>
  );
}
