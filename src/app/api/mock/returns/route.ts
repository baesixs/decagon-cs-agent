import { NextResponse } from "next/server";
import { handleCreateReturnCase } from "@/lib/mock/commerce";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    orderId?: string;
    email?: string;
    itemIds?: string[];
    reason?: string;
  };
  const result = handleCreateReturnCase({
    orderId: body.orderId ?? "",
    email: body.email ?? "",
    itemIds: body.itemIds ?? [],
    reason: body.reason ?? "",
  });
  return NextResponse.json(result.body, { status: result.status });
}
