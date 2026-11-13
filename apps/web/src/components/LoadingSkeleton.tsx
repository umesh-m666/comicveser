/** Placeholder grid matching ComicCard proportions, so layout does not jump when data arrives. */
export function CardGridSkeleton({ count = 12, className = "grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6" }: { count?: number; className?: string }) {
  return (
    <div className={className} aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}><div className="skeleton aspect-[2/3]" /><div className="skeleton mt-3 h-3.5 w-4/5" /><div className="skeleton mt-2 h-3 w-1/2" /></div>
      ))}
    </div>
  );
}
export function RowSkeleton({ count = 6 }: { count?: number }) {
  return <div className="grid gap-3 sm:grid-cols-2" aria-busy="true">{Array.from({ length: count }).map((_, i) => <div key={i} className="skeleton h-24" />)}</div>;
}
export default function LoadingSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="skeleton h-[22rem] w-full" />
      <div className="mt-10"><CardGridSkeleton count={6} /></div>
    </div>
  );
}
