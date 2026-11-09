import Link from "next/link";
export default function NotFound() {
  return (
    <div className="py-24 text-center">
      <h1 className="text-2xl font-bold">We couldn't find that page</h1>
      <p className="mt-2 text-muted">The comic or chapter may have been moved or unpublished.</p>
      <Link href="/browse" className="mt-6 inline-block rounded-md bg-primary px-4 py-2 font-semibold">Browse comics</Link>
    </div>
  );
}
