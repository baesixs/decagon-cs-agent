import { createSeedStore } from "./seed";
import type { BooklyStore, Order, PolicyTopic } from "./types";

/**
 * In-memory Bookly store. Survives Next.js HMR via globalThis.
 * Not durable — POC only.
 */

const globalStore = globalThis as typeof globalThis & {
  __booklyStore?: BooklyStore;
};

export function getStore(): BooklyStore {
  if (!globalStore.__booklyStore) {
    globalStore.__booklyStore = createSeedStore();
  }
  return globalStore.__booklyStore;
}

export function resetStore(): BooklyStore {
  globalStore.__booklyStore = createSeedStore();
  return globalStore.__booklyStore;
}

export function findOrdersByEmail(email: string): Order[] {
  const normalized = email.trim().toLowerCase();
  return getStore().orders.filter((o) => o.email.toLowerCase() === normalized);
}

export function getOrderById(orderId: string): Order | undefined {
  return getStore().orders.find(
    (o) => o.id.toUpperCase() === orderId.trim().toUpperCase(),
  );
}

export function getPolicy(topic: PolicyTopic): string {
  return getStore().policies[topic];
}

export function itemsTotalCents(order: Order, itemIds: string[]): number {
  const wanted = new Set(itemIds);
  return order.items
    .filter((i) => wanted.has(i.id))
    .reduce((sum, i) => sum + i.priceCents * i.quantity, 0);
}
