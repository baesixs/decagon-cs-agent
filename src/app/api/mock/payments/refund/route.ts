import { NextResponse } from "next/server";
import { handleRefundPayment } from "@/lib/mock/commerce";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    orderId?: string;
    email?: string;
    returnCaseId?: string;
    amountCents?: number;
  };
  const result = handleRefundPayment({
    orderId: body.orderId ?? "",
    email: body.email ?? "",
    returnCaseId: body.returnCaseId ?? "",
    amountCents: body.amountCents ?? 0,
  });
  return NextResponse.json(result.body, { status: result.status });
}
