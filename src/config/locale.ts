/**
 * Where Texora trades: Egypt. Country, currency, language, time zone, VAT,
 * phone format, governorates and delivery zones all come from here, so the
 * rest of the app never hard-codes a market. English for now; Arabic (RTL)
 * is a later step.
 */

export const COUNTRY = "EG";
export const CURRENCY = "EGP";
/** Number and date formatting: English as used in Egypt (Western digits). */
export const LOCALE = "en-EG";
export const TIME_ZONE = "Africa/Cairo";

/** Egyptian VAT, added at checkout on goods and delivery. */
export const VAT_RATE = 0.14;

/** Egypt's 27 governorates (ISO 3166-2:EG codes), in the order shoppers expect. */
export const GOVERNORATES = [
  { code: "C", name: "Cairo" },
  { code: "GZ", name: "Giza" },
  { code: "ALX", name: "Alexandria" },
  { code: "KB", name: "Qalyubia" },
  { code: "DK", name: "Dakahlia" },
  { code: "SHR", name: "Sharqia" },
  { code: "GH", name: "Gharbia" },
  { code: "MNF", name: "Monufia" },
  { code: "BH", name: "Beheira" },
  { code: "KFS", name: "Kafr El Sheikh" },
  { code: "DT", name: "Damietta" },
  { code: "PTS", name: "Port Said" },
  { code: "IS", name: "Ismailia" },
  { code: "SUZ", name: "Suez" },
  { code: "FYM", name: "Faiyum" },
  { code: "BNS", name: "Beni Suef" },
  { code: "MN", name: "Minya" },
  { code: "AST", name: "Asyut" },
  { code: "SHG", name: "Sohag" },
  { code: "KN", name: "Qena" },
  { code: "LX", name: "Luxor" },
  { code: "ASN", name: "Aswan" },
  { code: "BA", name: "Red Sea" },
  { code: "WAD", name: "New Valley" },
  { code: "MT", name: "Matrouh" },
  { code: "SIN", name: "North Sinai" },
  { code: "JS", name: "South Sinai" },
] as const;

export type GovernorateCode = (typeof GOVERNORATES)[number]["code"];

export const GOVERNORATE_CODES = GOVERNORATES.map((g) => g.code) as readonly string[];

/** A governorate's name from its code (the code itself if unknown). */
export function governorateName(code: string): string {
  return GOVERNORATES.find((g) => g.code === code)?.name ?? code;
}

/** Delivery zones: Greater Cairo (Cairo and Giza) and the rest of Egypt. */
export const DELIVERY_ZONES = ["greater_cairo", "rest_of_egypt"] as const;
export type DeliveryZone = (typeof DELIVERY_ZONES)[number];

const GREATER_CAIRO: readonly string[] = ["C", "GZ"];

/** The delivery zone for a governorate (Greater Cairo when not known yet). */
export function deliveryZoneFor(governorate: string | null | undefined): DeliveryZone {
  if (!governorate) return "greater_cairo";
  return GREATER_CAIRO.includes(governorate) ? "greater_cairo" : "rest_of_egypt";
}

export const DELIVERY_ZONE_LABELS: Record<DeliveryZone, string> = {
  greater_cairo: "Cairo and Giza",
  rest_of_egypt: "Other governorates",
};

/** Business-day delivery windows per zone and method. */
export const DELIVERY_DAYS: Record<
  DeliveryZone,
  Record<"standard" | "express", { minDays: number; maxDays: number }>
> = {
  greater_cairo: { standard: { minDays: 1, maxDays: 3 }, express: { minDays: 1, maxDays: 1 } },
  rest_of_egypt: { standard: { minDays: 3, maxDays: 5 }, express: { minDays: 2, maxDays: 3 } },
};

/** Couriers don't deliver on Friday, Egypt's weekly day off (getDay() = 5). */
export const NON_DELIVERY_DAYS: readonly number[] = [5];

/**
 * Egyptian mobile numbers: 010, 011, 012 or 015 then 8 digits, written
 * locally (01…) or internationally (+20 1…). Spaces and dashes are allowed.
 */
export function normalizeEgyptianMobile(input: string): string | null {
  const digits = input.replace(/[\s-]/g, "");
  const match = digits.match(/^(?:\+?20|0020|0)?(1[0125]\d{8})$/);
  return match?.[1] ? `+20${match[1]}` : null;
}

/** Egyptian postal codes are five digits (optional on addresses). */
export const POSTAL_CODE_PATTERN = /^\d{5}$/;

/**
 * Any Egyptian phone number as typed (mobile 01…, landline 0…, +20 …, 0020 …)
 * in international E.164 form, e.g. "010 1234 5678" → "+201012345678".
 * Numbers already starting with "+" are kept (international contacts).
 */
export function toE164(input: string): string {
  const digits = input.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  if (digits.startsWith("20") && digits.length >= 11) return `+${digits}`;
  if (digits.startsWith("0")) return `+20${digits.slice(1)}`;
  return `+20${digits}`;
}

/** An address's last line, e.g. "Nasr City, Cairo 11765" (postal code optional). */
export function cityLine(address: {
  city: string;
  region: string;
  postalCode?: string | undefined;
}) {
  return [`${address.city}, ${governorateName(address.region)}`, address.postalCode]
    .filter(Boolean)
    .join(" ");
}

export const COUNTRY_NAME = "Egypt";
