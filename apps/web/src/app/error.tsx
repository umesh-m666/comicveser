"use client";
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="py-24 text-center">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="mt-2 text-muted">{error.message.includes("reach") ? error.message : "We couldn't load this page. Try again in a moment."}</p>
      <button onClick={reset} className="mt-6 rounded-md bg-primary px-4 py-2 font-semibold">Try again</button>
    </div>
  );
}
