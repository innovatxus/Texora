/**
 * Shop and product state machines (prompt §3.4, §3.7). Every transition the
 * app makes goes through `assertShopTransition` / `assertProductTransition`,
 * so an illegal jump (e.g. a merchant approving their own shop) can't happen
 * even if a caller is wrong. Pure, so it is unit tested.
 */
import type { ProductStatus } from "@/lib/validation/catalog";
import type { ShopStatus } from "@/lib/validation/merchant";

/** Who is making a change: the merchant, a reviewer (admin) or the system (scheduler). */
export type Actor = "merchant" | "admin" | "system";

type Transitions<S extends string> = Readonly<
  Record<S, ReadonlyArray<{ to: S; by: readonly Actor[] }>>
>;

export const SHOP_TRANSITIONS: Transitions<ShopStatus> = {
  draft: [
    { to: "pending_review", by: ["merchant"] },
    { to: "closed", by: ["merchant"] },
  ],
  pending_review: [
    { to: "approved", by: ["admin"] },
    { to: "changes_requested", by: ["admin"] },
    { to: "draft", by: ["admin"] }, // rejected: back to the start with reasons
    { to: "closed", by: ["merchant"] },
  ],
  changes_requested: [
    { to: "pending_review", by: ["merchant"] },
    { to: "closed", by: ["merchant"] },
  ],
  approved: [
    { to: "suspended", by: ["admin"] },
    { to: "closed", by: ["merchant"] },
  ],
  suspended: [{ to: "approved", by: ["admin"] }],
  // Reopening returns to where review left off; approval is kept (within 30 days).
  closed: [
    { to: "approved", by: ["merchant"] },
    { to: "draft", by: ["merchant"] },
  ],
};

export const PRODUCT_TRANSITIONS: Transitions<ProductStatus> = {
  draft: [
    { to: "in_review", by: ["merchant"] },
    { to: "live", by: ["merchant", "admin"] }, // merchant only when trusted (checked by caller)
    { to: "scheduled", by: ["merchant", "admin"] },
    { to: "archived", by: ["merchant", "admin"] },
  ],
  in_review: [
    { to: "live", by: ["admin"] },
    { to: "scheduled", by: ["admin"] },
    { to: "changes_requested", by: ["admin"] },
    { to: "draft", by: ["merchant"] }, // withdrawn to keep editing
    { to: "archived", by: ["merchant", "admin"] },
  ],
  changes_requested: [
    { to: "in_review", by: ["merchant"] },
    { to: "draft", by: ["merchant"] },
    { to: "archived", by: ["merchant", "admin"] },
  ],
  scheduled: [
    { to: "live", by: ["system", "admin"] },
    { to: "draft", by: ["merchant", "admin"] },
    { to: "archived", by: ["merchant", "admin"] },
  ],
  live: [
    { to: "draft", by: ["merchant", "admin"] }, // unpublish
    { to: "archived", by: ["merchant", "admin"] },
  ],
  archived: [{ to: "draft", by: ["merchant", "admin"] }],
};

function allowed<S extends string>(map: Transitions<S>, from: S, to: S, by: Actor): boolean {
  return map[from].some((t) => t.to === to && t.by.includes(by));
}

/** Whether a shop may move from one status to another by this actor. */
export function canTransitionShop(from: ShopStatus, to: ShopStatus, by: Actor): boolean {
  return allowed(SHOP_TRANSITIONS, from, to, by);
}

/** Whether a product may move from one status to another by this actor. */
export function canTransitionProduct(from: ProductStatus, to: ProductStatus, by: Actor): boolean {
  return allowed(PRODUCT_TRANSITIONS, from, to, by);
}

/** Thrown for a transition the state machine doesn't allow. */
export class TransitionError extends Error {
  constructor(
    public readonly from: string,
    public readonly to: string,
  ) {
    super(`Can't move from ${from} to ${to}`);
    this.name = "TransitionError";
  }
}

export function assertShopTransition(from: ShopStatus, to: ShopStatus, by: Actor): void {
  if (!canTransitionShop(from, to, by)) throw new TransitionError(from, to);
}

export function assertProductTransition(from: ProductStatus, to: ProductStatus, by: Actor): void {
  if (!canTransitionProduct(from, to, by)) throw new TransitionError(from, to);
}

/** Merchant-facing names for shop statuses. */
export const SHOP_STATUS_LABELS: Readonly<Record<ShopStatus, string>> = {
  draft: "Setting up",
  pending_review: "In review",
  changes_requested: "Changes requested",
  approved: "Live",
  suspended: "Paused",
  closed: "Closed",
};

/** Whether shoppers can see a shop (and therefore its live products). */
export function isShopVisible(status: ShopStatus): boolean {
  return status === "approved";
}

/** Whether the merchant can still edit their shop's setup and submit it. */
export function isShopEditable(status: ShopStatus): boolean {
  return status !== "suspended" && status !== "closed";
}
