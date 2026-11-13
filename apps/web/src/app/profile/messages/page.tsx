"use client";
import { useState } from "react";
import { Inbox, MessageSquare, Search } from "lucide-react";
import ProfileNav from "@/components/ProfileNav";

/**
 * Messages inbox shell.
 *
 * There is no messages route or endpoint anywhere in the codebase (no
 * /user/messages API, no messages controller, no thread data), so this page
 * honestly renders an empty inbox instead of fabricating threads. When a
 * messages backend exists, the thread list below is where it plugs in.
 */
export default function Messages() {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  // No threads: no messages endpoint exists yet.
  const threads: { id: string; name: string; snippet: string; time: string; unread: boolean }[] = [];
  const visible = threads.filter((t) => t.name.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="space-y-5">
      <ProfileNav active="/profile/messages" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
          <MessageSquare size={22} className="text-[#C084FC]" aria-hidden /> Messages
        </h1>
        <button
          type="button"
          disabled
          title="Messaging isn't available yet"
          className="rounded-lg bg-[#9333EA] px-3 py-2 text-sm font-semibold text-white opacity-50"
        >
          New message
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-[320px_1fr]">
        {/* Thread list */}
        <section aria-label="Message threads" className="overflow-hidden rounded-xl border border-[#322A42] bg-[#17141F]">
          <div className="border-b border-[#322A42] p-3">
            <label className="flex items-center gap-2 rounded-lg border border-[#322A42] bg-[#211B2D] px-3 py-2">
              <Search size={15} className="shrink-0 text-[#A8A1B5]" aria-hidden />
              <span className="sr-only">Search messages</span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search messages"
                className="w-full border-0 bg-transparent p-0 text-sm text-white placeholder:text-[#A8A1B5] focus:outline-none"
              />
            </label>
          </div>
          {visible.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-12 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#211B2D] text-[#C084FC]">
                <Inbox size={22} aria-hidden />
              </span>
              <p className="mt-3 font-semibold text-white">No messages yet</p>
              <p className="mt-1 text-sm text-[#A8A1B5]">
                When someone messages you, their threads will show up here.
              </p>
            </div>
          ) : (
            <ul>
              {visible.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(t.id)}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[#211B2D] ${
                      selected === t.id ? "bg-[#211B2D]" : ""
                    }`}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#9333EA] to-[#C084FC] font-bold text-white">
                      {t.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate font-semibold text-white">{t.name}</span>
                        <span className="shrink-0 text-xs text-[#A8A1B5]">{t.time}</span>
                      </span>
                      <span className="block truncate text-sm text-[#A8A1B5]">{t.snippet}</span>
                    </span>
                    {t.unread && <span aria-label="Unread" className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#9333EA]" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Detail pane */}
        <section aria-label="Message detail" className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-[#322A42] bg-[#17141F] px-4 py-12 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#211B2D] text-[#C084FC]">
            <MessageSquare size={26} aria-hidden />
          </span>
          <p className="mt-4 font-semibold text-white">Select a thread to read it</p>
          <p className="mt-1 max-w-sm text-sm text-[#A8A1B5]">
            There are no message threads yet — ComicVerse doesn&apos;t have a messages service connected, so
            there&apos;s nothing to show here.
          </p>
        </section>
      </div>
    </div>
  );
}
