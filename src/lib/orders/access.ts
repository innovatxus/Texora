import "server-only";
import { hasPermission } from "@/lib/auth/rbac";
import { getSession } from "@/lib/auth/session";
import { getOrder } from "@/lib/data/orders";
import type { Order } from "@/lib/validation";
import { verifyOrderAccessToken } from "./token";

/**
 * An order is visible to whoever holds its signed link (checkout and
 * emails), to the signed-in customer who placed it, and to staff who can
 * read orders. Everyone else gets null, indistinguishable from "not found".
 */
export async function getAuthorisedOrder(
  orderId: string,
  token: string | null | undefined,
): Promise<Order | null> {
  const [order, session] = await Promise.all([getOrder(orderId), getSession()]);
  if (!order) return null;
  if (verifyOrderAccessToken(order.id, token)) return order;
  if (session && order.userId === session.uid) return order;
  if (session && hasPermission(session.role, "orders.read")) return order;
  return null;
}
