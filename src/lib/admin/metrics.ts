import type { Order, OrderStatus } from "@/lib/validation";

/** Statuses that count as revenue: paid or committed, not cancelled or awaiting payment. */
const COUNTED: ReadonlySet<OrderStatus> = new Set([
  "placed",
  "processing",
  "partially_shipped",
  "shipped",
  "delivered",
  "partially_refunded",
  "refunded",
]);

export type MetricsOrder = Pick<Order, "status" | "placedAt" | "totals" | "lines" | "refunds">;

export interface SalesSummary {
  revenue: number;
  orders: number;
  averageOrderValue: number;
  refunded: number;
  /** One point per day, oldest first, for the chart. */
  daily: Array<{ date: string; revenue: number; orders: number }>;
  topProducts: Array<{ productId: string; name: string; units: number; revenue: number }>;
}

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Sales over the last `days` days (UTC calendar days, today included).
 * Revenue is merchandise plus shipping and tax as charged, less refunds.
 */
export function summariseSales(
  orders: readonly MetricsOrder[],
  now: Date,
  days = 30,
): SalesSummary {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - (days - 1));
  const daily = new Map<string, { revenue: number; orders: number }>();
  for (let i = 0; i < days; i += 1) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    daily.set(dayKey(d), { revenue: 0, orders: 0 });
  }

  let revenue = 0;
  let count = 0;
  let refunded = 0;
  const products = new Map<string, { name: string; units: number; revenue: number }>();

  for (const order of orders) {
    if (!COUNTED.has(order.status) || order.placedAt < start || order.placedAt > now) continue;
    const refundTotal = order.refunds.reduce((sum, r) => sum + r.amount, 0);
    const net = order.totals.total - refundTotal;
    revenue += net;
    refunded += refundTotal;
    count += 1;
    const bucket = daily.get(dayKey(order.placedAt));
    if (bucket) {
      bucket.revenue += net;
      bucket.orders += 1;
    }
    for (const line of order.lines) {
      const p = products.get(line.productId) ?? { name: line.name, units: 0, revenue: 0 };
      p.units += line.quantity;
      p.revenue += line.lineTotal;
      products.set(line.productId, p);
    }
  }

  return {
    revenue,
    orders: count,
    averageOrderValue: count > 0 ? Math.round(revenue / count) : 0,
    refunded,
    daily: [...daily.entries()].map(([date, v]) => ({ date, ...v })),
    topProducts: [...products.entries()]
      .map(([productId, p]) => ({ productId, ...p }))
      .sort((a, b) => b.units - a.units || b.revenue - a.revenue)
      .slice(0, 5),
  };
}
