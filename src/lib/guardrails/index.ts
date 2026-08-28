/**
 * DETERMINISTIC — fail closed. The model cannot skip these checks.
 * Soft identity: email on the order record (not real auth).
 */

import { getOrderById, getStore } from "../store";
import type { Order } from "../store/types";

export type GuardrailFailure = {
  ok: false;
  code:
    | "ORDER_NOT_FOUND"
    | "IDENTITY_MISMATCH"
    | "RETURN_WINDOW_EXPIRED"
    | "RETURN_NOT_ELIGIBLE"
    | "ITEM_NOT_ON_ORDER"
    | "ALREADY_RETURNED"
    | "INVALID_ARGS";
  message: string;
};

export type GuardrailSuccess<T> = { ok: true; value: T };

export type GuardrailResult<T> = GuardrailSuccess<T> | GuardrailFailure;

export function requireOrderExists(orderId: string): GuardrailResult<Order> {
  if (!orderId?.trim()) {
    return {
      ok: false,
      code: "INVALID_ARGS",
      message: "An order id is required.",
    };
  }
  const order = getOrderById(orderId);
  if (!order) {
    return {
      ok: false,
      code: "ORDER_NOT_FOUND",
      message: `No Bookly order found for ${orderId.trim().toUpperCase()}.`,
    };
  }
  return { ok: true, value: order };
}

export function requireCustomerMatch(
  order: Order,
  email: string,
): GuardrailResult<Order> {
  if (!email?.trim()) {
    return {
      ok: false,
      code: "INVALID_ARGS",
      message: "Email is required to look up or change an order.",
    };
  }
  if (order.email.toLowerCase() !== email.trim().toLowerCase()) {
    return {
      ok: false,
      code: "IDENTITY_MISMATCH",
      message:
        "That email does not match this order. We cannot share order details without a matching email.",
    };
  }
  return { ok: true, value: order };
}

export function requireReturnWindow(order: Order): GuardrailResult<Order> {
  const { returnWindowDays } = getStore();
  if (order.status === "returned") {
    return {
      ok: false,
      code: "ALREADY_RETURNED",
      message: "This order already has a completed return.",
    };
  }
  if (!order.deliveredAt) {
    return {
      ok: false,
      code: "RETURN_NOT_ELIGIBLE",
      message:
        "This order has not been delivered yet, so it is not eligible for a return. You can return it after delivery, within 30 days.",
    };
  }
  const delivered = new Date(order.deliveredAt).getTime();
  const deadline = delivered + returnWindowDays * 24 * 60 * 60 * 1000;
  if (Date.now() > deadline) {
    return {
      ok: false,
      code: "RETURN_WINDOW_EXPIRED",
      message: `The ${returnWindowDays}-day return window from delivery has closed.`,
    };
  }
  return { ok: true, value: order };
}

export function requireItemsOnOrder(
  order: Order,
  itemIds: string[],
): GuardrailResult<Order> {
  if (!itemIds.length) {
    return {
      ok: false,
      code: "INVALID_ARGS",
      message: "At least one item id is required.",
    };
  }
  const known = new Set(order.items.map((i) => i.id));
  const missing = itemIds.filter((id) => !known.has(id));
  if (missing.length) {
    return {
      ok: false,
      code: "ITEM_NOT_ON_ORDER",
      message: `Item(s) ${missing.join(", ")} are not on this order.`,
    };
  }
  return { ok: true, value: order };
}
