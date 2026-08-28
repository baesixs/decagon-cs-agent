import { NextRequest, NextResponse } from "next/server";
import { executeTool } from "@/lib/agent/tools";

/**
 * Shared execute path for text (orchestrator) and voice (Realtime client).
 * Voice must not run tools only in the browser.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as { name?: string; arguments?: string };
  if (!body.name) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  const origin = req.nextUrl.origin;
  const result = await executeTool(
    body.name,
    body.arguments ?? "{}",
    origin,
  );
  return NextResponse.json(result);
}
