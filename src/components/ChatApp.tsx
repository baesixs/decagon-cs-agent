"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { traceEvent, type TraceEvent } from "@/lib/agent/trace";
import { TracePanel } from "./TracePanel";
import { VoiceControls } from "./VoiceControls";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  channel: "text" | "voice";
};

const DEMO = {
  email: "ava@example.com",
  mismatchEmail: "sam@example.com",
  orders: [
    { id: "BK-1001", note: "Delivered · still in return window" },
    { id: "BK-1002", note: "Delivered · return window expired" },
    { id: "BK-1003", note: "Shipped · in transit" },
  ],
};

const PROMPTS = [
  {
    label: "Where is my order?",
    text: "Where is my order?",
  },
  {
    label: "Start a return",
    text: "I'd like to return something I ordered.",
  },
  {
    label: "Track a shipment",
    text: "Has my package shipped yet?",
  },
  {
    label: "Reset my password",
    text: "I forgot my password — how do I reset it?",
  },
];

export function ChatApp() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [traces, setTraces] = useState<TraceEvent[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [traceOpen, setTraceOpen] = useState(false);
  const [previousResponseId, setPreviousResponseId] = useState<string | null>(
    null,
  );
  const transcriptRef = useRef<HTMLDivElement>(null);

  const appendTraces = (events: TraceEvent[]) => {
    setTraces((prev) => [...prev, ...events]);
  };

  useEffect(() => {
    const el = transcriptRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

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
          text: data.reply ?? data.error ?? `Request failed (${res.status}).`,
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

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(draft);
    }
  };

  return (
    <div className="relative flex h-dvh min-h-0 flex-col overflow-hidden bg-[var(--bg)]">
      <header className="z-20 flex shrink-0 items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--ink)] text-[13px] font-medium text-[var(--accent-text)]">
            B
          </span>
          <div>
            <p className="text-[15px] font-medium leading-none tracking-tight">
              Bookly Care
            </p>
            <p className="mt-0.5 text-[12px] text-[var(--muted)]">
              Customer support
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setTraceOpen((o) => !o)}
          aria-pressed={traceOpen}
          className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition ${
            traceOpen
              ? "border-[var(--ink)] bg-[var(--ink)] text-white"
              : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--ink)]/30"
          }`}
        >
          Details
          {traces.length > 0 ? (
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                traceOpen ? "bg-white/20" : "bg-[var(--bg)] text-[var(--muted)]"
              }`}
            >
              {traces.length}
            </span>
          ) : (
            <span className="hidden text-[11px] font-normal text-[var(--muted)] sm:inline">
              for reviewers
            </span>
          )}
        </button>
      </header>

      <div className="shrink-0 border-y border-[var(--line)] bg-[var(--surface)] px-4 py-2.5 sm:px-6">
        <div className="mx-auto flex max-w-[720px] flex-col gap-1.5 text-[12.5px] sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-1">
          <span className="font-medium text-[var(--muted)]">Demo</span>
          <CopyValue label="Email" value={DEMO.email} />
          {DEMO.orders.map((o) => (
            <span key={o.id} className="flex min-w-0 items-baseline gap-1.5">
              <CopyValue value={o.id} />
              <span className="truncate text-[var(--muted)]">{o.note}</span>
            </span>
          ))}
          <span className="text-[var(--muted)]">
            Identity check: {DEMO.mismatchEmail} on {DEMO.orders[0].id}
          </span>
        </div>
      </div>

      <div
        ref={transcriptRef}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        <div className="mx-auto flex min-h-full w-full max-w-[720px] flex-col px-4 pb-4 sm:px-6">
          {messages.length === 0 ? (
            <div className="flex flex-1 flex-col justify-center py-10">
              <h1 className="text-[28px] font-medium tracking-tight text-[var(--ink)]">
                How can we help?
              </h1>
              <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-[var(--muted)]">
                Ask about an order, a return, shipping, or your account. The
                demo customer and order ids stay pinned above so you can type
                them in.
              </p>
              <dl className="mt-5 grid gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-[13px] sm:grid-cols-2">
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
                    Customer
                  </dt>
                  <dd className="mt-0.5 font-medium">{DEMO.email}</dd>
                </div>
                {DEMO.orders.map((o) => (
                  <div key={o.id}>
                    <dt className="font-medium">{o.id}</dt>
                    <dd className="text-[var(--muted)]">{o.note}</dd>
                  </div>
                ))}
                <div className="sm:col-span-2">
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
                    Wrong email
                  </dt>
                  <dd className="mt-0.5 text-[var(--muted)]">
                    {DEMO.mismatchEmail} on {DEMO.orders[0].id} → identity
                    mismatch
                  </dd>
                </div>
              </dl>
              <div className="mt-8 grid gap-2 sm:grid-cols-2">
                {PROMPTS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => void send(p.text)}
                    className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3.5 text-left text-[14px] text-[var(--ink)] shadow-[0_1px_0_rgba(20,19,17,0.04)] hover:border-[var(--ink)]/20"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <ol className="flex flex-col gap-6 py-6">
              {messages.map((msg) => (
                <li
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] text-[15.5px] leading-[1.55] ${
                      msg.role === "user"
                        ? "rounded-[22px] bg-[var(--user)] px-4 py-2.5 text-white"
                        : "text-[var(--ink)]"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <p className="mb-1.5 text-[11px] font-medium text-[var(--muted)]">
                        Bookly
                        {msg.channel === "voice" ? " · voice" : ""}
                      </p>
                    ) : null}
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  </div>
                </li>
              ))}
              {busy ? (
                <li className="text-[13px] text-[var(--muted)]">Bookly is typing…</li>
              ) : null}
            </ol>
          )}
        </div>
      </div>

      <div className="shrink-0 px-4 pb-5 pt-1 sm:px-6">
        <div className="mx-auto mb-2.5 flex w-full max-w-[720px] gap-2 overflow-x-auto pb-0.5">
          {PROMPTS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => void send(p.text)}
              className="shrink-0 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[12.5px] text-[var(--ink)] hover:border-[var(--ink)]/25"
            >
              {p.label}
            </button>
          ))}
        </div>
        <form
          onSubmit={onSubmit}
          className="mx-auto w-full max-w-[720px] rounded-[28px] border border-[var(--line)] bg-[var(--surface)] shadow-[0_8px_30px_rgba(20,19,17,0.06)]"
        >
          <label className="sr-only" htmlFor="draft">
            Message
          </label>
          <textarea
            id="draft"
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Message Bookly…"
            className="max-h-40 w-full resize-none bg-transparent px-5 pt-4 text-[15.5px] leading-6 text-[var(--ink)] outline-none placeholder:text-[var(--muted)]"
          />
          <div className="flex items-center justify-between gap-2 px-2 pb-2 pt-1">
            <VoiceControls
              onUserTranscript={(text) => {
                setMessages((m) => [
                  ...m,
                  {
                    id: crypto.randomUUID(),
                    role: "user",
                    text,
                    channel: "voice",
                  },
                ]);
                appendTraces([
                  traceEvent("user", "customer message", {
                    channel: "voice",
                    text,
                  }),
                ]);
              }}
              onAssistantTranscript={(text) => {
                setMessages((m) => [
                  ...m,
                  {
                    id: crypto.randomUUID(),
                    role: "assistant",
                    text,
                    channel: "voice",
                  },
                ]);
                appendTraces([
                  traceEvent("reply", "assistant message", { channel: "voice", reply: text }),
                ]);
              }}
              onTraces={appendTraces}
            />
            <button
              type="submit"
              disabled={busy || !draft.trim()}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-text)] disabled:opacity-30"
              aria-label="Send"
            >
              <SendIcon />
            </button>
          </div>
        </form>
        <p className="mx-auto mt-2 max-w-[720px] px-2 text-center text-[11px] text-[var(--muted)]">
          Enter to send · Shift+Enter for a new line
        </p>
      </div>

      {traceOpen ? (
        <>
          <button
            type="button"
            aria-label="Dismiss details"
            className="absolute inset-0 z-30 bg-[var(--ink)]/20"
            onClick={() => setTraceOpen(false)}
          />
          <div className="absolute inset-y-0 right-0 z-40 w-full max-w-md shadow-2xl">
            <TracePanel events={traces} onClose={() => setTraceOpen(false)} />
          </div>
        </>
      ) : null}
    </div>
  );
}

function CopyValue({ label, value }: { label?: string; value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      title={`Copy ${value}`}
      onClick={() => {
        void navigator.clipboard.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      }}
      className="font-medium text-[var(--ink)] hover:underline"
    >
      {label ? `${label} ` : null}
      <span className="font-mono text-[12px]">{copied ? "copied" : value}</span>
    </button>
  );
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
