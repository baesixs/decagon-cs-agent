import type { TraceEvent } from "@/lib/agent/trace";

export function TracePanel({ events }: { events: TraceEvent[] }) {
  return (
    <aside className="flex h-full min-h-0 flex-col border-l border-[var(--rule)] bg-[var(--trace)] text-[#efe8dc]">
      <div className="sans border-b border-white/10 px-5 py-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-[#c4b8a4]">
          Agent trace
        </p>
        <p className="mt-1 text-sm text-[#efe8dc]">
          LLM chooses among five tools. Returns → refund is Bookly code, not a
          model decision.
        </p>
      </div>
      <ol className="sans min-h-0 flex-1 space-y-3 overflow-y-auto p-4 text-xs">
        {events.length === 0 ? (
          <li className="text-[#9a8f80]">Waiting for a turn…</li>
        ) : (
          events.map((ev) => (
            <li
              key={ev.id}
              className="rounded-md border border-white/10 bg-white/5 p-3"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium uppercase tracking-wide text-[#e0b089]">
                  {ev.kind}
                </span>
                <time className="text-[10px] text-[#8a8074]">
                  {ev.at.slice(11, 19)}
                </time>
              </div>
              <p className="mt-1 text-[#f3eee6]">{ev.title}</p>
              {ev.detail !== undefined ? (
                <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all text-[10px] leading-relaxed text-[#c9bfb0]">
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
