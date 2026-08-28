/**
 * APPLICATION ORCHESTRATION — not an agent graph.
 * One tool: requestPasswordReset. Bookly code hits the mock identity API.
 * Response never reveals whether the email is registered.
 */

import { traceEvent, type TraceEvent } from "../agent/trace";

export async function requestPasswordReset(
  email: string,
  origin: string,
): Promise<{
  ok: boolean;
  resetRequestId?: string;
  message?: string;
  error?: { code: string; message: string };
  traces: TraceEvent[];
}> {
  const traces: TraceEvent[] = [
    traceEvent("app", "requestPasswordReset: start", { email }),
  ];

  const res = await fetch(`${origin}/api/mock/identity/password-reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const json = (await res.json()) as Record<string, unknown>;
  traces.push(
    traceEvent("http", "POST /api/mock/identity/password-reset", {
      status: res.status,
      body: json,
    }),
  );

  if (!json.ok) {
    return {
      ok: false,
      error: {
        code: String(json.code ?? "RESET_FAILED"),
        message: String(json.message ?? "Could not send a reset email."),
      },
      traces,
    };
  }

  return {
    ok: true,
    resetRequestId: String(json.resetRequestId),
    message: String(json.message),
    traces,
  };
}
