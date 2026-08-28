import type { BooklyStore } from "./types";

/** Seeded clock: 28 Aug 2026. BK-1001 is in-window; BK-1002 is expired. */
export function createSeedStore(): BooklyStore {
  return {
    returnWindowDays: 30,
    immediateRefund: true,
    orders: [
      {
        id: "BK-1001",
        email: "ava@example.com",
        customerName: "Ava Chen",
        status: "delivered",
        orderedAt: "2026-08-12T10:00:00.000Z",
        deliveredAt: "2026-08-20T15:30:00.000Z",
        items: [
          {
            id: "ITM-1",
            title: "The Left Hand of Darkness",
            author: "Ursula K. Le Guin",
            quantity: 1,
            priceCents: 1899,
          },
          {
            id: "ITM-2",
            title: "A Wizard of Earthsea",
            author: "Ursula K. Le Guin",
            quantity: 1,
            priceCents: 1499,
          },
        ],
        shipping: {
          carrier: "Bookly Logistics",
          tracking: "BL-88421",
          eta: null,
        },
      },
      {
        id: "BK-1002",
        email: "ava@example.com",
        customerName: "Ava Chen",
        status: "delivered",
        orderedAt: "2026-05-18T09:00:00.000Z",
        deliveredAt: "2026-05-24T14:00:00.000Z",
        items: [
          {
            id: "ITM-3",
            title: "Piranesi",
            author: "Susanna Clarke",
            quantity: 1,
            priceCents: 1699,
          },
        ],
        shipping: {
          carrier: "Bookly Logistics",
          tracking: "BL-55102",
          eta: null,
        },
      },
      {
        id: "BK-1003",
        email: "ava@example.com",
        customerName: "Ava Chen",
        status: "shipped",
        orderedAt: "2026-08-26T16:20:00.000Z",
        deliveredAt: null,
        items: [
          {
            id: "ITM-4",
            title: "Klara and the Sun",
            author: "Kazuo Ishiguro",
            quantity: 1,
            priceCents: 1999,
          },
        ],
        shipping: {
          carrier: "Bookly Logistics",
          tracking: "BL-90211",
          eta: "2026-08-30",
        },
      },
      {
        id: "BK-2001",
        email: "sam@example.com",
        customerName: "Sam Ortiz",
        status: "delivered",
        orderedAt: "2026-08-10T11:00:00.000Z",
        deliveredAt: "2026-08-18T12:00:00.000Z",
        items: [
          {
            id: "ITM-9",
            title: "Circe",
            author: "Madeline Miller",
            quantity: 1,
            priceCents: 1799,
          },
        ],
        shipping: {
          carrier: "Bookly Logistics",
          tracking: "BL-22001",
          eta: null,
        },
      },
    ],
    returnCases: [],
    refunds: [],
    policies: {
      shipping:
        "Standard shipping is 3–5 business days via Bookly Logistics. Tracking appears on the order once it ships. We do not offer same-day delivery.",
      returns:
        "Most delivered items can be returned within 30 days of delivery. Items must match the original order. Eligible returns create an RMA; Bookly issues an immediate refund to the original payment method when policy allows. We do not cancel in-flight shipments from this assistant — wait for delivery, then return.",
      password_reset:
        "We cannot reset passwords from chat. Use the Sign in page → Forgot password, and check the inbox (and spam) for the email you use with Bookly. If nothing arrives in 10 minutes, try again or contact hello@bookly.example.",
      general:
        "Bookly is a small online bookstore. This assistant can look up your orders (email + order id), explain shipping and returns, walk through password reset, and start a return after you confirm. It cannot access other customers' data or invent order status.",
    },
  };
}
