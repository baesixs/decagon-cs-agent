"use client";

import { useEffect, useRef } from "react";
import type { TraceEvent } from "@/lib/agent/trace";

export function TracePanel({
  events,
  onClose,
}: {
  events: TraceEvent[];
  onClose: () => void;
}) {
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [events]);

  return (
    <aside className="flex h-full min-h-0 w-full flex-col bg-[var(--trace)] text-[#efe8dc]">
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#c4b8a4]">
            Details
          </p>
          <p className="mt-1 text-[12px] leading-snug text-[#9a8f80]">
            For reviewers: tools, guardrails, and mock API calls for this
            session.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full px-2 py-1 text-sm text-[#9a8f80] hover:text-white"
          aria-label="Close details"
        >
          Close
        </button>
      </div>
      <ol
        ref={listRef}
        className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4 text-xs"
      >
        {events.length === 0 ? (
          <li className="px-1 py-8 text-center text-[#9a8f80]">
            Nothing yet. Send a message and this fills in.
          </li>
        ) : (
          events.map((ev) => (
            <li
              key={ev.id}
              className="rounded-xl border border-white/8 bg-white/5 p-3"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium text-[#e0b089]">{ev.kind}</span>
                <time className="text-[10px] text-[#8a8074]">
                  {ev.at.slice(11, 19)}
                </time>
              </div>
              <p className="mt-1 text-[#f3eee6]">{ev.title}</p>
              {ev.detail !== undefined ? (
                <pre className="mt-2 max-h-36 overflow-auto whitespace-pre-wrap break-all text-[10px] leading-relaxed text-[#c9bfb0]">
                  {typeof ev.detail === "string"
                    ? ev.detail
                    : JSON.stringify(ev.detail, null, 2)}
                </pre>
              ) : null}
            </li>
          ))
        )}
      </ol>
    </aside>
  );
}
