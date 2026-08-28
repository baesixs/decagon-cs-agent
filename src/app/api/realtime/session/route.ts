import { NextResponse } from "next/server";
import { AGENT_INSTRUCTIONS } from "@/lib/agent/instructions";
import { realtimeToolSchemas } from "@/lib/agent/tools";

const REALTIME_MODEL =
  process.env.OPENAI_REALTIME_MODEL ?? "gpt-4o-realtime-preview";
const VOICE = process.env.OPENAI_REALTIME_VOICE ?? "alloy";

/**
 * Mint an ephemeral Realtime client secret. Tools still execute on our server.
 */
export async function POST() {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY missing" },
      { status: 500 },
    );
  }

  const res = await fetch("https://api.openai.com/v1/realtime/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
      "OpenAI-Beta": "realtime=v1",
    },
    body: JSON.stringify({
      model: REALTIME_MODEL,
      voice: VOICE,
      instructions: AGENT_INSTRUCTIONS,
      tools: realtimeToolSchemas(),
      tool_choice: "auto",
      input_audio_transcription: { model: "whisper-1" },
    }),
  });

  const data = (await res.json()) as {
    client_secret?: { value: string };
    error?: { message?: string };
  };

  if (!res.ok || !data.client_secret?.value) {
    return NextResponse.json(
      { error: data.error?.message ?? "Failed to create Realtime session" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    clientSecret: data.client_secret.value,
    model: REALTIME_MODEL,
  });
}
