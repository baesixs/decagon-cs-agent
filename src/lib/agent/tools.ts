/**
 * Tool catalog — five functions. Same schemas for Responses API and Realtime.
 * executeTool is the single switch both channels use.
 *
 * Conversational: which tool to call (model).
 * Deterministic: what each tool does (this file + guardrails + createReturn).
 */

import type { FunctionTool } from "openai/resources/responses/responses";
import { findOrdersByEmail, getOrderById, getPolicy } from "../store";
import type { PolicyTopic } from "../store/types";
import {
  requireCustomerMatch,
  requireOrderExists,
  type GuardrailFailure,
} from "../guardrails";
import { evaluateReturnEligibility } from "../returns/eligibility";
import { createReturn } from "../returns/createReturn";
import { traceEvent, type TraceEvent } from "./trace";

const POLICY_TOPICS: PolicyTopic[] = [
  "shipping",
  "returns",
  "password_reset",
  "general",
];

export const TOOL_DEFINITIONS: FunctionTool[] = [
  {
    type: "function",
    name: "findOrdersByEmail",
    description:
      "List orders for a customer email (ids, dates, status, item title summaries). Soft identity: only that email.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        email: { type: "string", description: "Customer email" },
      },
      required: ["email"],
    },
  },
  {
    type: "function",
    name: "getOrder",
    description:
      "Full line items, dates, and shipping for one order. Requires matching email.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        orderId: { type: "string" },
        email: { type: "string" },
      },
      required: ["orderId", "email"],
    },
  },
  {
    type: "function",
    name: "checkReturnEligibility",
    description:
      "Read-only: is this order (or item) still eligible for return? Call before asking the customer to confirm a return.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        orderId: { type: "string" },
        email: { type: "string" },
        itemId: { type: ["string", "null"], description: "Optional single item id" },
      },
      required: ["orderId", "email", "itemId"],
    },
  },
  {
    type: "function",
    name: "lookupPolicy",
    description:
      "Canned Bookly policy text. topic must be shipping, returns, password_reset, or general.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        topic: {
          type: "string",
          enum: POLICY_TOPICS,
        },
      },
      required: ["topic"],
    },
  },
  {
    type: "function",
    name: "createReturn",
    description:
      "The only write tool. After the customer confirms, create a return. Bookly code then calls Returns API and, if policy allows, Payment API. Do not call this until the customer confirms.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        orderId: { type: "string" },
        email: { type: "string" },
        itemIds: { type: "array", items: { type: "string" } },
        reason: { type: "string" },
      },
      required: ["orderId", "email", "itemIds", "reason"],
    },
  },
];

/** Realtime session tools use a slightly flatter JSON shape. */
export function realtimeToolSchemas() {
  return TOOL_DEFINITIONS.map((t) => ({
    type: "function" as const,
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }));
}

export type ToolExecuteResult = {
  output: Record<string, unknown>;
  traces: TraceEvent[];
};

function fail(
  traces: TraceEvent[],
  error: GuardrailFailure,
): ToolExecuteResult {
  traces.push(traceEvent("guardrail", `blocked: ${error.code}`, error));
  return { output: { ...error }, traces };
}

export async function executeTool(
  name: string,
  rawArgs: string,
  origin: string,
): Promise<ToolExecuteResult> {
  const traces: TraceEvent[] = [
    traceEvent("tool_call", name, { args: rawArgs }),
  ];

  let args: Record<string, unknown> = {};
  try {
    args = rawArgs ? (JSON.parse(rawArgs) as Record<string, unknown>) : {};
  } catch {
    return {
      traces,
      output: {
        ok: false,
        code: "INVALID_ARGS",
        message: "Tool arguments were not valid JSON.",
      },
    };
  }

  switch (name) {
    case "findOrdersByEmail": {
      const email = String(args.email ?? "").trim();
      if (!email) {
        return fail(traces, {
          ok: false,
          code: "INVALID_ARGS",
          message: "email is required.",
        });
      }
      const orders = findOrdersByEmail(email).map((o) => ({
        orderId: o.id,
        status: o.status,
        orderedAt: o.orderedAt,
        deliveredAt: o.deliveredAt,
        itemSummaries: o.items.map((i) => `${i.title} by ${i.author}`),
      }));
      traces.push(
        traceEvent("app", "findOrdersByEmail", { count: orders.length }),
      );
      return { traces, output: { ok: true, email, orders } };
    }
    case "getOrder": {
      const exists = requireOrderExists(String(args.orderId ?? ""));
      if (!exists.ok) return fail(traces, exists);
      traces.push(traceEvent("guardrail", "requireOrderExists: pass"));
      const match = requireCustomerMatch(exists.value, String(args.email ?? ""));
      if (!match.ok) return fail(traces, match);
      traces.push(traceEvent("guardrail", "requireCustomerMatch: pass"));
      const o = match.value;
      return {
        traces,
        output: {
          ok: true,
          order: {
            orderId: o.id,
            email: o.email,
            customerName: o.customerName,
            status: o.status,
            orderedAt: o.orderedAt,
            deliveredAt: o.deliveredAt,
            shipping: o.shipping,
            items: o.items,
          },
        },
      };
    }
    case "checkReturnEligibility": {
      const itemId =
        args.itemId === null || args.itemId === undefined
          ? undefined
          : String(args.itemId);
      const result = evaluateReturnEligibility({
        orderId: String(args.orderId ?? ""),
        email: String(args.email ?? ""),
        itemIds: itemId ? [itemId] : undefined,
      });
      traces.push(...result.traces);
      if (!result.ok) {
        return {
          traces,
          output: { eligible: false, ...result.error },
        };
      }
      return {
        traces,
        output: { ok: true, ...result.value },
      };
    }
    case "lookupPolicy": {
      const topic = String(args.topic ?? "") as PolicyTopic;
      if (!POLICY_TOPICS.includes(topic)) {
        return fail(traces, {
          ok: false,
          code: "INVALID_ARGS",
          message: `Unknown policy topic. Use one of: ${POLICY_TOPICS.join(", ")}.`,
        });
      }
      return {
        traces,
        output: { ok: true, topic, policy: getPolicy(topic) },
      };
    }
    case "createReturn": {
      const itemIds = Array.isArray(args.itemIds)
        ? args.itemIds.map((id) => String(id))
        : [];
      const result = await createReturn(
        {
          orderId: String(args.orderId ?? ""),
          email: String(args.email ?? ""),
          itemIds,
          reason: String(args.reason ?? "customer request"),
        },
        origin,
      );
      traces.push(...result.traces);
      const { traces: _t, ...rest } = result;
      return { traces, output: rest };
    }
    default:
      return {
        traces,
        output: {
          ok: false,
          code: "UNKNOWN_TOOL",
          message: `No tool named ${name}. Catalog is five tools only.`,
        },
      };
  }
}
