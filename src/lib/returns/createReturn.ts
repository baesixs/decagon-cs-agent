/**
 * APPLICATION ORCHESTRATION — not an agent graph.
 * The LLM only called createReturn. Bookly code decides: validate → Returns API → Payment API.
 */

import { getStore, getOrderById, itemsTotalCents } from "../store";
import { evaluateReturnEligibility } from "./eligibility";
import { traceEvent, type TraceEvent } from "../agent/trace";

export type CreateReturnArgs = {
  orderId: string;
  email: string;
  itemIds: string[];
  reason: string;
};

export type CreateReturnResult = {
  ok: boolean;
  caseId?: string;
  refund?: { refundId: string; status: string; amountCents: number };
  ineligible?: { code: string; message: string };
  traces: TraceEvent[];
};

async function postMock(
  origin: string,
  path: string,
  body: unknown,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await fetch(`${origin}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as Record<string, unknown>;
  return { status: res.status, json };
}

export async function createReturn(
  args: CreateReturnArgs,
  origin: string,
): Promise<CreateReturnResult> {
  const traces: TraceEvent[] = [
    traceEvent("app", "createReturn: start application orchestration", args),
  ];

  const eligibility = evaluateReturnEligibility({
    orderId: args.orderId,
    email: args.email,
    itemIds: args.itemIds,
  });
  traces.push(...eligibility.traces);

  if (!eligibility.ok) {
    traces.push(
      traceEvent("app", "createReturn: stopped — eligibility failed", eligibility.error),
    );
    return {
      ok: false,
      ineligible: {
        code: eligibility.error.code,
        message: eligibility.error.message,
      },
      traces,
    };
  }

  const order = getOrderById(eligibility.value.orderId);
  if (!order) {
    return {
      ok: false,
      ineligible: { code: "ORDER_NOT_FOUND", message: "Order disappeared." },
      traces,
    };
  }

  const itemIds = eligibility.value.itemIds;
  const returnsRes = await postMock(origin, "/api/mock/returns", {
    orderId: order.id,
    email: args.email,
    itemIds,
    reason: args.reason,
  });
  traces.push(
    traceEvent("http", "POST /api/mock/returns", {
      status: returnsRes.status,
      body: returnsRes.json,
    }),
  );

  if (!returnsRes.json.ok) {
    return {
      ok: false,
      ineligible: {
        code: String(returnsRes.json.code ?? "RETURNS_API_ERROR"),
        message: String(returnsRes.json.message ?? "Returns API rejected the case."),
      },
      traces,
    };
  }

  const caseId = String(returnsRes.json.caseId);
  const result: CreateReturnResult = { ok: true, caseId, traces };

  if (getStore().immediateRefund) {
    const amountCents = itemsTotalCents(order, itemIds);
    const payRes = await postMock(origin, "/api/mock/payments/refund", {
      orderId: order.id,
      email: args.email,
      returnCaseId: caseId,
      amountCents,
    });
    traces.push(
      traceEvent("http", "POST /api/mock/payments/refund", {
        status: payRes.status,
        body: payRes.json,
      }),
    );
    if (payRes.json.ok) {
      result.refund = {
        refundId: String(payRes.json.refundId),
        status: String(payRes.json.status),
        amountCents: Number(payRes.json.amountCents),
      };
    }
  } else {
    traces.push(
      traceEvent("app", "skip payment — policy does not grant immediate refund"),
    );
  }

  traces.push(traceEvent("app", "createReturn: done", { caseId, refund: result.refund }));
  return result;
}
