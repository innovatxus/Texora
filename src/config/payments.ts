/**
 * Payment methods shown to shoppers (footer, help, account). Keep this in
 * step with the Paymob integrations enabled for the store: cards (Visa,
 * Mastercard, Meeza) and mobile wallets, plus Cash on Delivery.
 *
 * Each method renders as a neutral text badge. To show an official
 * acceptance mark instead, add the artwork supplied by the network or by
 * Paymob's merchant kit under public/media/payments/ and set `logo`.
 */
export interface PaymentMark {
  id: string;
  /** Accessible name and tooltip. */
  label: string;
  /** Text shown on the badge when there is no logo. */
  badge: string;
  /** Optional official artwork, e.g. "/media/payments/visa.svg". */
  logo?: string;
}

export const PAYMENT_MARKS: readonly PaymentMark[] = [
  { id: "visa", label: "Visa", badge: "VISA" },
  { id: "mastercard", label: "Mastercard", badge: "Mastercard" },
  { id: "meeza", label: "Meeza", badge: "Meeza" },
  { id: "wallets", label: "Mobile wallets such as Vodafone Cash", badge: "Mobile wallet" },
  { id: "cod", label: "Cash on delivery", badge: "Cash on delivery" },
];
