export default function Loading() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6" aria-busy="true" aria-label="Loading">
      {Array.from({ length: 12 }).map((_, i) => <div key={i} className="skeleton aspect-[2/3]" />)}
    </div>
  );
}
