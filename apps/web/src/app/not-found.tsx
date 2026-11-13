import Link from "next/link";
import { ComicVerseLogo } from "@/components/ComicVerseLogo";

export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <div className="mx-auto mb-5 inline-flex items-center justify-center rounded-2xl border border-white/15 bg-[#2F2250] px-6 py-4 shadow-lg">
        <ComicVerseLogo className="h-16 w-auto" />
      </div>
      <h1 className="text-2xl font-bold">We couldn&apos;t find that page</h1>
      <p className="mt-2 text-muted">The comic or chapter may have been moved or unpublished.</p>
      <Link href="/browse" className="mt-6 inline-block rounded-md bg-primary px-4 py-2 font-semibold text-white">
        Browse comics
      </Link>
    </div>
  );
}
