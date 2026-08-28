/**
 * CONVERSATIONAL loop on the OpenAI Responses API (not Chat Completions).
 * We still execute tools locally so Decagon can see every hop.
 *
 * previous_response_id chains turns. instructions are resent every call
 * (they do not persist through previous_response_id).
 */

import OpenAI from "openai";
import { AGENT_INSTRUCTIONS } from "./instructions";
import { executeTool, TOOL_DEFINITIONS } from "./tools";
import { traceEvent, type TraceEvent } from "./trace";

function getClient() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export const TEXT_MODEL = process.env.OPENAI_TEXT_MODEL ?? "gpt-4.1";

export type ChatTurnInput = {
  userText: string;
  previousResponseId?: string | null;
  origin: string;
};

export type ChatTurnResult = {
  reply: string;
  previousResponseId: string | null;
  traces: TraceEvent[];
};

function outputText(response: OpenAI.Responses.Response): string {
  if (response.output_text) return response.output_text;
  const parts: string[] = [];
  for (const item of response.output) {
    if (item.type === "message" && item.role === "assistant") {
      for (const c of item.content) {
        if (c.type === "output_text") parts.push(c.text);
      }
    }
  }
  return parts.join("\n").trim();
}

export async function runTextTurn(input: ChatTurnInput): Promise<ChatTurnResult> {
  const traces: TraceEvent[] = [
    traceEvent("user", "customer message", {
      channel: "text",
      text: input.userText,
    }),
    traceEvent("turn", "text turn", { model: TEXT_MODEL }),
  ];

  const key = process.env.OPENAI_API_KEY;
  if (!key || key.length < 40 || key.includes("sk-...")) {
    traces.push(
      traceEvent("llm", "missing OPENAI_API_KEY"),
    );
    return {
      reply:
        "This demo needs OPENAI_API_KEY in .env.local. Copy .env.example and add your key.",
      previousResponseId: input.previousResponseId ?? null,
      traces,
    };
  }

  let previousId = input.previousResponseId ?? undefined;
  let nextInput: string | OpenAI.Responses.ResponseInput = input.userText;

  try {
  for (let step = 0; step < 8; step++) {
    traces.push(
      traceEvent("llm", `responses.create (${step === 0 ? "user" : "tool results"})`, {
        previous_response_id: previousId ?? null,
        input:
          step === 0
            ? { type: "user_text", text: input.userText }
            : { type: "function_call_output", count: Array.isArray(nextInput) ? nextInput.length : 0 },
      }),
    );

    const response = await getClient().responses.create({
      model: TEXT_MODEL,
      instructions: AGENT_INSTRUCTIONS,
      tools: TOOL_DEFINITIONS,
      input: nextInput,
      previous_response_id: previousId,
      store: true,
    });

    previousId = response.id;
    const hasReasoning = response.output.some((i) => i.type === "reasoning");
    traces.push(
      traceEvent("llm", "response received", {
        responseId: response.id,
        status: response.status,
        outputTypes: response.output.map((i) => i.type),
        reasoningPresent: hasReasoning,
      }),
    );

    const calls = response.output.filter((i) => i.type === "function_call");
    if (calls.length === 0) {
      const reply = outputText(response) || "I’m here — how can Bookly help?";
      traces.push(traceEvent("reply", "assistant message", { reply }));
      return { reply, previousResponseId: response.id, traces };
    }

    const outputs: OpenAI.Responses.ResponseInputItem[] = [];
    for (const call of calls) {
      if (call.type !== "function_call") continue;
      const result = await executeTool(call.name, call.arguments, input.origin);
      traces.push(...result.traces);
      outputs.push({
        type: "function_call_output",
        call_id: call.call_id,
        output: JSON.stringify(result.output),
      });
    }
    nextInput = outputs;
  }

  traces.push(traceEvent("llm", "tool loop cap reached"));
  return {
    reply:
      "I hit an internal loop limit while using tools. Please try that request again.",
    previousResponseId: previousId ?? null,
    traces,
  };
  } catch (err) {
    const message = err instanceof Error ? err.message : "OpenAI request failed";
    traces.push(traceEvent("llm", "responses.create failed", { message }));
    return {
      reply: `I couldn't complete that turn: ${message}`,
      previousResponseId: previousId ?? null,
      traces,
    };
  }
}
