"use client";

import { FormEvent, useState } from "react";
import type { TraceEvent } from "@/lib/agent/trace";
import { TracePanel } from "./TracePanel";
import { VoiceControls } from "./VoiceControls";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  channel: "text" | "voice";
};

const PROMPTS = [
  {
    label: "Order status",
    text: "Hi — my email is ava@example.com. What's the status of order BK-1001?",
  },
  {
    label: "Eligible return",
    text: "ava@example.com — I'd like to return BK-1001 please.",
  },
  {
    label: "Window expired",
    text: "Can I return BK-1002? Email ava@example.com",
  },
  {
    label: "Wrong email",
    text: "Show me order BK-1001 for sam@example.com",
  },
  {
    label: "Unknown order",
    text: "What's on order BK-9999? I'm ava@example.com",
  },
  {
    label: "Shipping",
    text: "Where is my package for BK-1003? ava@example.com",
  },
  {
    label: "Password",
    text: "I forgot my Bookly password, how do I reset it?",
  },
];

export function ChatApp() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [traces, setTraces] = useState<TraceEvent[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [previousResponseId, setPreviousResponseId] = useState<string | null>(
    null,
  );

  const appendTraces = (events: TraceEvent[]) => {
    setTraces((prev) => [...prev, ...events]);
  };

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setDraft("");
    setMessages((m) => [
      ...m,
      { id: crypto.randomUUID(), role: "user", text: trimmed, channel: "text" },
    ]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          previousResponseId,
        }),
      });
      const data = (await res.json()) as {
        reply?: string;
        previousResponseId?: string | null;
        traces?: TraceEvent[];
        error?: string;
      };
      if (data.traces) appendTraces(data.traces);
      setPreviousResponseId(data.previousResponseId ?? previousResponseId);
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: data.reply ?? data.error ?? "No reply.",
          channel: "text",
        },
      ]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: err instanceof Error ? err.message : "Request failed",
          channel: "text",
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send(draft);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-[var(--rule)] px-6 py-5">
        <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-4">
          <div>
            <p className="sans text-[11px] uppercase tracking-[0.22em] text-[var(--accent)]">
              Bookly Care · POC
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">
              Conversational where we can. Deterministic where it matters.
            </h1>
            <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-[var(--muted)]">
              Five tools. The model decides if you want a return. Bookly code
              creates the RMA and calls the mock payment API.
            </p>
          </div>
          <VoiceControls
            onUserTranscript={(text) =>
              setMessages((m) => [
                ...m,
                {
                  id: crypto.randomUUID(),
                  role: "user",
                  text,
                  channel: "voice",
                },
              ])
            }
            onAssistantTranscript={(text) =>
              setMessages((m) => [
                ...m,
                {
                  id: crypto.randomUUID(),
                  role: "assistant",
                  text,
                  channel: "voice",
                },
              ])
            }
            onTraces={appendTraces}
          />
        </div>
      </header>

      <div className="mx-auto grid min-h-0 w-full max-w-7xl flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(280px,380px)]">
        <main className="flex min-h-[70vh] flex-col">
          <div className="sans border-b border-[var(--rule)] px-6 py-3">
            <p className="text-[11px] uppercase tracking-wider text-[var(--muted)]">
              Try these
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {PROMPTS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => void send(p.text)}
                  className="rounded-full border border-[var(--rule)] bg-[var(--panel)] px-3 py-1 text-xs text-[var(--ink)] hover:border-[var(--ink)]"
                >
                  {p.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-[var(--muted)]">
              Demo: BK-1001 + ava@example.com (eligible, immediate refund) ·
              BK-1002 expired · BK-1003 in transit
            </p>
          </div>

          <ul className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-6">
            {messages.length === 0 ? (
              <li className="text-[var(--muted)]">
                Ask about an order, a return, shipping, or a password reset.
              </li>
            ) : (
              messages.map((msg) => (
                <li
                  key={msg.id}
                  className={
                    msg.role === "user" ? "ml-8 text-right" : "mr-8 text-left"
                  }
                >
                  <p className="sans text-[10px] uppercase tracking-wider text-[var(--muted)]">
                    {msg.role} · {msg.channel}
                  </p>
                  <p
                    className={`mt-1 inline-block rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${
                      msg.role === "user"
                        ? "bg-[var(--ink)] text-[var(--paper)]"
                        : "bg-[var(--panel)] ring-1 ring-[var(--rule)]"
                    }`}
                  >
                    {msg.text}
                  </p>
                </li>
              ))
            )}
            {busy ? (
              <li className="sans text-xs text-[var(--muted)]">Thinking…</li>
            ) : null}
          </ul>

          <form
            onSubmit={onSubmit}
            className="border-t border-[var(--rule)] bg-[var(--panel)] px-6 py-4"
          >
            <label className="sans sr-only" htmlFor="draft">
              Message
            </label>
            <div className="flex gap-3">
              <input
                id="draft"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Type a message…"
                className="sans min-w-0 flex-1 rounded-full border border-[var(--rule)] bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--ink)]"
              />
              <button
                type="submit"
                disabled={busy}
                className="sans rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </form>
        </main>
        <div className="hidden min-h-[70vh] lg:block">
          <TracePanel events={traces} />
        </div>
      </div>
      <div className="h-80 lg:hidden">
        <TracePanel events={traces} />
      </div>
    </div>
  );
}
