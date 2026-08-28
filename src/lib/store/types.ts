/**
 * Bookly domain types. POC-only: in-memory store, soft identity via email.
 */

export type OrderStatus = "processing" | "shipped" | "delivered" | "returned";

export type LineItem = {
  id: string;
  title: string;
  author: string;
  quantity: number;
  priceCents: number;
};

export type Order = {
  id: string;
  email: string;
  customerName: string;
  status: OrderStatus;
  orderedAt: string;
  deliveredAt: string | null;
  items: LineItem[];
  shipping: {
    carrier: string;
    tracking: string | null;
    eta: string | null;
  };
};

export type ReturnCase = {
  id: string;
  orderId: string;
  itemIds: string[];
  reason: string;
  createdAt: string;
  refundId?: string;
};

export type RefundRecord = {
  id: string;
  orderId: string;
  returnCaseId: string;
  amountCents: number;
  status: "succeeded" | "declined";
  createdAt: string;
};

export type PasswordResetRequest = {
  id: string;
  email: string;
  createdAt: string;
};

export type PolicyTopic = "shipping" | "returns" | "password_reset" | "general";

export type BooklyStore = {
  orders: Order[];
  returnCases: ReturnCase[];
  refunds: RefundRecord[];
  passwordResets: PasswordResetRequest[];
  policies: Record<PolicyTopic, string>;
  returnWindowDays: number;
  immediateRefund: boolean;
};
