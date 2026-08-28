export type TraceKind =
  | "user"
  | "turn"
  | "llm"
  | "tool_call"
  | "guardrail"
  | "http"
  | "app"
  | "reply";

export type TraceEvent = {
  id: string;
  at: string;
  kind: TraceKind;
  title: string;
  /** Nested Bookly steps (Returns API, Payment API) live here — not extra LLM tools. */
  detail?: unknown;
};

export function traceEvent(
  kind: TraceKind,
  title: string,
  detail?: unknown,
): TraceEvent {
  return {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    kind,
    title,
    detail,
  };
}
