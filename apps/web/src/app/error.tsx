"use client";
import { ComicVerseLogo } from "@/components/ComicVerseLogo";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="py-20 text-center">
      <div className="mx-auto mb-5 inline-flex items-center justify-center rounded-2xl border border-white/15 bg-[#2F2250] px-6 py-4 shadow-lg">
        <ComicVerseLogo className="h-16 w-auto" />
      </div>
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="mt-2 text-muted">
        {error.message.includes("reach") ? error.message : "We couldn't load this page. Try again in a moment."}
      </p>
      <button onClick={reset} className="mt-6 rounded-md bg-primary px-4 py-2 font-semibold text-white">
        Try again
      </button>
    </div>
  );
}
