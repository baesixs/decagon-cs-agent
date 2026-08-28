/**
 * DETERMINISTIC eligibility. Shared by checkReturnEligibility (read) and createReturn (re-check).
 */

import {
  requireCustomerMatch,
  requireItemsOnOrder,
  requireOrderExists,
  requireReturnWindow,
  type GuardrailFailure,
} from "../guardrails";
import { getStore } from "../store";
import type { Order } from "../store/types";
import { traceEvent, type TraceEvent } from "../agent/trace";

export type EligibilityOk = {
  eligible: true;
  orderId: string;
  email: string;
  itemIds: string[];
  windowDays: number;
  deliveredAt: string;
};

export type EligibilityResult =
  | { ok: true; value: EligibilityOk; traces: TraceEvent[] }
  | { ok: false; error: GuardrailFailure; traces: TraceEvent[] };

function fail(
  error: GuardrailFailure,
  traces: TraceEvent[],
): EligibilityResult {
  traces.push(
    traceEvent("guardrail", `blocked: ${error.code}`, error),
  );
  return { ok: false, error, traces };
}

export function evaluateReturnEligibility(args: {
  orderId: string;
  email: string;
  itemIds?: string[];
}): EligibilityResult {
  const traces: TraceEvent[] = [];
  const exists = requireOrderExists(args.orderId);
  if (!exists.ok) return fail(exists, traces);
  traces.push(
    traceEvent("guardrail", "requireOrderExists: pass", { orderId: exists.value.id }),
  );

  const match = requireCustomerMatch(exists.value, args.email);
  if (!match.ok) return fail(match, traces);
  traces.push(
    traceEvent("guardrail", "requireCustomerMatch: pass", { email: args.email }),
  );

  const window = requireReturnWindow(match.value);
  if (!window.ok) return fail(window, traces);
  traces.push(
    traceEvent("guardrail", "requireReturnWindow: pass", {
      deliveredAt: match.value.deliveredAt,
      windowDays: getStore().returnWindowDays,
    }),
  );

  const order: Order = window.value;
  const itemIds =
    args.itemIds && args.itemIds.length
      ? args.itemIds
      : order.items.map((i) => i.id);

  const items = requireItemsOnOrder(order, itemIds);
  if (!items.ok) return fail(items, traces);

  const already = getStore().returnCases.filter((c) => c.orderId === order.id);
  const returnedItems = new Set(already.flatMap((c) => c.itemIds));
  const conflict = itemIds.filter((id) => returnedItems.has(id));
  if (conflict.length) {
    return fail(
      {
        ok: false,
        code: "ALREADY_RETURNED",
        message: `Item(s) ${conflict.join(", ")} already have a return case.`,
      },
      traces,
    );
  }

  traces.push(
    traceEvent("guardrail", "eligibility: eligible", { itemIds }),
  );

  return {
    ok: true,
    traces,
    value: {
      eligible: true,
      orderId: order.id,
      email: order.email,
      itemIds,
      windowDays: getStore().returnWindowDays,
      deliveredAt: order.deliveredAt as string,
    },
  };
}
