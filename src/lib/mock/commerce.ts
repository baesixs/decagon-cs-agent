/**
 * Mock commerce handlers. Used by HTTP routes.
 * createReturn calls those routes over HTTP so the trace shows a real round trip.
 */

import { getStore, itemsTotalCents } from "../store";
import type { RefundRecord, ReturnCase } from "../store/types";

export type MockApiResult = {
  ok: boolean;
  status: number;
  body: Record<string, unknown>;
};

export function handleCreateReturnCase(input: {
  orderId: string;
  email: string;
  itemIds: string[];
  reason: string;
}): MockApiResult {
  const store = getStore();
  const order = store.orders.find(
    (o) => o.id.toUpperCase() === input.orderId.toUpperCase(),
  );
  if (!order) {
    return {
      ok: false,
      status: 404,
      body: { ok: false, code: "ORDER_NOT_FOUND", message: "Unknown order." },
    };
  }
  if (order.email.toLowerCase() !== input.email.trim().toLowerCase()) {
    return {
      ok: false,
      status: 403,
      body: {
        ok: false,
        code: "IDENTITY_MISMATCH",
        message: "Email does not match order.",
      },
    };
  }
  if (!input.itemIds?.length) {
    return {
      ok: false,
      status: 400,
      body: { ok: false, code: "INVALID_ARGS", message: "itemIds required." },
    };
  }

  const existing = store.returnCases.find(
    (c) =>
      c.orderId === order.id &&
      c.itemIds.slice().sort().join() === input.itemIds.slice().sort().join(),
  );
  if (existing) {
    return {
      ok: true,
      status: 200,
      body: { ok: true, caseId: existing.id, status: "existing", case: existing },
    };
  }

  const record: ReturnCase = {
    id: `RMA-${String(store.returnCases.length + 1).padStart(4, "0")}`,
    orderId: order.id,
    itemIds: input.itemIds,
    reason: input.reason,
    createdAt: new Date().toISOString(),
  };
  store.returnCases.push(record);
  if (input.itemIds.length === order.items.length) {
    order.status = "returned";
  }

  return {
    ok: true,
    status: 201,
    body: { ok: true, caseId: record.id, status: "created", case: record },
  };
}

export function handleRefundPayment(input: {
  orderId: string;
  email: string;
  returnCaseId: string;
  amountCents: number;
}): MockApiResult {
  const store = getStore();
  const order = store.orders.find(
    (o) => o.id.toUpperCase() === input.orderId.toUpperCase(),
  );
  if (!order) {
    return {
      ok: false,
      status: 404,
      body: { ok: false, code: "ORDER_NOT_FOUND", message: "Unknown order." },
    };
  }
  if (order.email.toLowerCase() !== input.email.trim().toLowerCase()) {
    return {
      ok: false,
      status: 403,
      body: { ok: false, code: "IDENTITY_MISMATCH", message: "Email mismatch." },
    };
  }
  const rma = store.returnCases.find((c) => c.id === input.returnCaseId);
  if (!rma) {
    return {
      ok: false,
      status: 404,
      body: { ok: false, code: "RMA_NOT_FOUND", message: "Unknown return case." },
    };
  }

  const existing = store.refunds.find((r) => r.returnCaseId === rma.id);
  if (existing) {
    return {
      ok: true,
      status: 200,
      body: {
        ok: true,
        refundId: existing.id,
        status: existing.status,
        amountCents: existing.amountCents,
        idempotent: true,
      },
    };
  }

  const amount = input.amountCents || itemsTotalCents(order, rma.itemIds);
  const record: RefundRecord = {
    id: `RFN-${String(store.refunds.length + 1).padStart(4, "0")}`,
    orderId: order.id,
    returnCaseId: rma.id,
    amountCents: amount,
    status: "succeeded",
    createdAt: new Date().toISOString(),
  };
  store.refunds.push(record);
  rma.refundId = record.id;

  return {
    ok: true,
    status: 201,
    body: {
      ok: true,
      refundId: record.id,
      status: record.status,
      amountCents: record.amountCents,
    },
  };
}
