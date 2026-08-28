import { NextResponse } from "next/server";
import { handlePasswordReset } from "@/lib/mock/commerce";

export async function POST(req: Request) {
  const body = (await req.json()) as { email?: string };
  const result = handlePasswordReset({ email: body.email ?? "" });
  return NextResponse.json(result.body, { status: result.status });
}
