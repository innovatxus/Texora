/**
 * What a shop still needs before it can be submitted, the setup checklist and
 * onboarding step order. Pure, so the dashboard, the review step and the
 * submit action agree on exactly the same list.
 */
import type { Merchant, MerchantLocation, OnboardingStep, Shop } from "@/lib/validation/merchant";
import { ONBOARDING_STEPS } from "@/lib/validation/merchant";

export interface Blocker {
  key: "email" | "basics" | "logo" | "banner" | "contact" | "location";
  message: string;
  /** Where to fix it. */
  href: string;
}

const STEP_PATH = (step: OnboardingStep) => `/merchant/onboarding/${step}`;

/** Active locations orders can ship from. */
export function shipFromCount(locations: readonly MerchantLocation[]): number {
  return locations.filter((l) => l.status === "active" && l.types.includes("ship_from")).length;
}

/** Everything that blocks submitting the shop for review, in journey order. */
export function shopBlockers(
  merchant: Pick<Merchant, "emailVerified">,
  shop: Shop | null,
  locations: readonly MerchantLocation[],
): Blocker[] {
  const blockers: Blocker[] = [];
  if (!merchant.emailVerified) {
    blockers.push({ key: "email", message: "Verify your email", href: "/merchant/verify-email" });
  }
  if (!shop) {
    blockers.push({ key: "basics", message: "Add your shop basics", href: STEP_PATH("basics") });
    return blockers;
  }
  if (!shop.logo)
    blockers.push({ key: "logo", message: "Add a logo", href: STEP_PATH("branding") });
  if (!shop.banner) {
    blockers.push({ key: "banner", message: "Add a banner", href: STEP_PATH("branding") });
  }
  if (!shop.completedSteps.includes("contact")) {
    blockers.push({
      key: "contact",
      message: "Add your contact details and policies",
      href: STEP_PATH("contact"),
    });
  }
  if (shipFromCount(locations) === 0) {
    blockers.push({
      key: "location",
      message: "Add a ship-from location",
      href: STEP_PATH("locations"),
    });
  }
  return blockers;
}

/** The step after this one, or "review" at the end. */
export function nextStep(step: OnboardingStep): OnboardingStep {
  const index = ONBOARDING_STEPS.indexOf(step);
  return ONBOARDING_STEPS[Math.min(index + 1, ONBOARDING_STEPS.length - 1)] ?? "review";
}

/** Whether the merchant may open a step yet: basics first, then any step in any order. */
export function canOpenStep(step: OnboardingStep, shop: Shop | null): boolean {
  return step === "basics" || shop !== null;
}

/** Step labels for the stepper. */
export const STEP_LABELS: Readonly<Record<OnboardingStep, string>> = {
  basics: "Basics",
  branding: "Branding",
  contact: "Contact & policies",
  locations: "Locations",
  review: "Review",
};

export interface ChecklistItem {
  label: string;
  done: boolean;
  href: string;
}

/** The dashboard's setup checklist (journey §7). */
export function setupChecklist(
  merchant: Pick<Merchant, "emailVerified">,
  shop: Shop | null,
  locations: readonly MerchantLocation[],
  productCount: number,
): ChecklistItem[] {
  return [
    { label: "Verify your email", done: merchant.emailVerified, href: "/merchant/verify-email" },
    {
      label: "Add your branding",
      done: Boolean(shop?.logo && shop.banner),
      href: STEP_PATH("branding"),
    },
    { label: "Add a location", done: shipFromCount(locations) > 0, href: STEP_PATH("locations") },
    { label: "Add your first product", done: productCount > 0, href: "/merchant/products/new" },
    {
      label: "Submit your shop",
      done: Boolean(shop && shop.status !== "draft"),
      href: STEP_PATH("review"),
    },
  ];
}
