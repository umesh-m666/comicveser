import type { Metadata } from "next";
import Link from "next/link";
import StaticPage from "@/components/StaticPage";
import { SITE } from "@/lib/site";
export const metadata: Metadata = { title: "About" };
export default function About() {
  return (
    <StaticPage title={`About ${SITE.name}`}>
      <p>{SITE.name} is a place to read manga, manhwa, manhua, webtoons and novels. Every series on the site is either original work published by its creator or licensed for distribution here.</p>
      <h2>For readers</h2>
      <p>Bookmark series, pick up where you left off on any device, rate and review what you read, and get a notification when a bookmarked series has a new chapter. <Link href="/browse">Browse the catalog</Link>.</p>
      <h2>For creators</h2>
      <p>If you own the rights to your work, you can apply to publish it. Every submission, and the rights information that comes with it, is reviewed before it goes live. <Link href="/creator/dashboard">Open the creator portal</Link>.</p>
      <h2>Rights holders</h2>
      <p>If you believe something on the site infringes your rights, see our <Link href="/copyright-policy">copyright policy</Link>.</p>
    </StaticPage>
  );
}
