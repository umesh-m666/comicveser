import Link from "next/link";

export default function SourcesPage() {
  return (
    <section className="mx-auto max-w-2xl rounded-xl border border-line bg-card p-8 text-center">
      <h1 className="text-2xl font-extrabold">External title catalog</h1>
      <p className="mt-3 text-sm text-muted">
        External titles are reviewed by ComicVerse administrators before publication. Approved titles appear in Discover and Search.
      </p>
      <Link href="/browse" className="mt-5 inline-block rounded-md border border-line px-4 py-2 text-sm font-semibold hover:bg-surface">
        Browse published comics
      </Link>
    </section>
  );
}
