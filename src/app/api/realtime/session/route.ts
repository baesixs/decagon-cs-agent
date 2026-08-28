import { NextResponse } from "next/server";
import { AGENT_INSTRUCTIONS } from "@/lib/agent/instructions";
import { realtimeToolSchemas } from "@/lib/agent/tools";

const REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL ?? "gpt-realtime";
const VOICE = process.env.OPENAI_REALTIME_VOICE ?? "alloy";

/**
 * Mint an ephemeral Realtime client secret (ek_...).
 * Browser then POSTs SDP to /v1/realtime/calls with that secret.
 */
export async function POST() {
  const key = process.env.OPENAI_API_KEY;
  if (!key || key.length < 40 || key.includes("sk-...")) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY missing in .env.local" },
      { status: 500 },
    );
  }

  const res = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      session: {
        type: "realtime",
        model: REALTIME_MODEL,
        instructions: AGENT_INSTRUCTIONS,
        tools: realtimeToolSchemas(),
        tool_choice: "auto",
        audio: {
          input: {
            transcription: { model: "whisper-1" },
          },
          output: { voice: VOICE },
        },
      },
    }),
  });

  const data = (await res.json()) as {
    value?: string;
    client_secret?: { value?: string } | string;
    error?: { message?: string };
  };

  const clientSecret =
    data.value ??
    (typeof data.client_secret === "string"
      ? data.client_secret
      : data.client_secret?.value);

  if (!res.ok || !clientSecret) {
    return NextResponse.json(
      {
        error:
          data.error?.message ??
          "Failed to create Realtime client secret",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    clientSecret,
    model: REALTIME_MODEL,
  });
}
