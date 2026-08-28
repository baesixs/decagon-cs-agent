import { NextRequest, NextResponse } from "next/server";
import { runTextTurn } from "@/lib/agent/orchestrator";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    message?: string;
    previousResponseId?: string | null;
  };
  const message = body.message?.trim();
  if (!message) {
    return NextResponse.json({ error: "message required" }, { status: 400 });
  }

  const origin = req.nextUrl.origin;
  const result = await runTextTurn({
    userText: message,
    previousResponseId: body.previousResponseId,
    origin,
  });

  return NextResponse.json(result);
}
