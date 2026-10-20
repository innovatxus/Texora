import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { CheckoutAddress } from "@/lib/orders/checkout-schema";

export type DeliveryChoice = { method: "standard" } | { method: "express" };
export type PaymentChoice = "card" | "cod";

interface CheckoutState {
  email: string | null;
  shippingAddress: CheckoutAddress | null;
  delivery: DeliveryChoice | null;
  billingSameAsShipping: boolean;
  billingAddress: CheckoutAddress | null;
  paymentMethod: PaymentChoice | null;
  marketingOptIn: boolean;
  /** One per checkout attempt; a retry of the same attempt can never double-order. */
  idempotencyKey: string;
  setContact: (email: string, marketingOptIn: boolean) => void;
  setShippingAddress: (address: CheckoutAddress) => void;
  setDelivery: (delivery: DeliveryChoice) => void;
  setPayment: (payment: {
    method: PaymentChoice;
    billingSameAsShipping: boolean;
    billingAddress: CheckoutAddress | null;
  }) => void;
  reset: () => void;
}

const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `chk-${crypto.randomUUID()}`
    : `chk-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const initial = () => ({
  email: null,
  shippingAddress: null,
  delivery: null,
  billingSameAsShipping: true,
  billingAddress: null,
  paymentMethod: null,
  marketingOptIn: false,
  idempotencyKey: newKey(),
});

/** Checkout progress in sessionStorage: survives refresh, cleared when the tab closes. */
export const useCheckoutStore = create<CheckoutState>()(
  persist(
    (set) => ({
      ...initial(),
      setContact: (email, marketingOptIn) => set({ email, marketingOptIn }),
      setShippingAddress: (shippingAddress) => set({ shippingAddress }),
      setDelivery: (delivery) => set({ delivery }),
      setPayment: ({ method, billingSameAsShipping, billingAddress }) =>
        set({ paymentMethod: method, billingSameAsShipping, billingAddress }),
      reset: () => set(initial()),
    }),
    {
      name: "texora-checkout",
      version: 1,
      storage: createJSONStorage(() => sessionStorage),
      skipHydration: true,
    },
  ),
);

const subscribe = (onChange: () => void) => useCheckoutStore.persist.onFinishHydration(onChange);

/** True once the checkout store has loaded from sessionStorage. */
export function useCheckoutHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => useCheckoutStore.persist.hasHydrated(),
    () => false,
  );
}

export type CheckoutStep = "contact" | "shipping" | "delivery" | "payment" | "review";

/** The first step still missing information (guards deep links and refreshes). */
export function firstIncompleteStep(
  state: Pick<CheckoutState, "email" | "shippingAddress" | "delivery" | "paymentMethod">,
): CheckoutStep {
  if (!state.email) return "contact";
  if (!state.shippingAddress) return "shipping";
  if (!state.delivery) return "delivery";
  if (!state.paymentMethod) return "payment";
  return "review";
}
