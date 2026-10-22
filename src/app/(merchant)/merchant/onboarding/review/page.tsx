import type { Metadata } from "next";
import NextLink from "next/link";
import { redirect } from "next/navigation";
import { SubmitShop } from "@/components/merchant/onboarding/SubmitShop";
import { ShopHeader } from "@/components/merchant/shop/ShopHeader";
import {
  LOCATION_TYPES,
  PLATFORM_RETURN_POLICY,
  PROCESSING_TIMES,
  SHOP_TYPES,
} from "@/config/merchant";
import { getMerchantContext } from "@/lib/merchant/context";
import { shopBlockers } from "@/lib/merchant/onboarding";
import { listLocations } from "@/lib/merchant/repositories/locations";
import { SHOP_STATUS_LABELS } from "@/lib/merchant/status";
import { weeklyHours, DAY_NAMES } from "@/lib/stores/hours";

export const metadata: Metadata = { title: "Review & submit" };

function Summary({
  title,
  href,
  children,
}: {
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 border border-line bg-surface p-5">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-label">{title}</h3>
        <NextLink
          href={href}
          className="min-h-11 content-center text-sm underline underline-offset-4"
        >
          Edit<span className="sr-only"> {title.toLowerCase()}</span>
        </NextLink>
      </div>
      <div className="text-sm text-ink-soft">{children}</div>
    </section>
  );
}

/** Step 5: everything at a glance, a live preview, and submit (journey §6.5). */
export default async function Page() {
  const { merchant, shop } = await getMerchantContext();
  if (!shop) redirect("/merchant/onboarding/basics");
  const locations = await listLocations(shop.id);
  const blockers = shopBlockers(merchant, shop, locations);
  const submittable = shop.status === "draft" || shop.status === "changes_requested";
  const typeLabel = (v: string) => LOCATION_TYPES.find((t) => t.value === v)?.label ?? v;

  return (
    <section aria-labelledby="step-title" className="flex flex-col gap-8">
      <div>
        <h2 id="step-title" className="font-display text-3xl">
          Review & submit
        </h2>
        <p className="mt-2 text-ink-soft">
          Status: {SHOP_STATUS_LABELS[shop.status]}. Check everything, then submit your shop for
          review.
        </p>
      </div>

      {blockers.length > 0 && (
        <div
          role="region"
          aria-label="Still to do"
          className="border border-warning/50 bg-surface p-5"
        >
          <h3 className="font-medium">Before you can submit</h3>
          <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-sm">
            {blockers.map((b) => (
              <li key={b.key}>
                <NextLink href={b.href} className="underline underline-offset-4">
                  {b.message}
                </NextLink>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Summary title="Basics" href="/merchant/onboarding/basics">
          <p className="font-medium text-ink">{shop.name}</p>
          <p>texora.com/shops/{shop.slug}</p>
          <p>{SHOP_TYPES.find((t) => t.value === shop.shopType)?.label}</p>
          <p>{shop.categoryKeys.length} categories</p>
        </Summary>
        <Summary title="Branding" href="/merchant/onboarding/branding">
          <p>Logo: {shop.logo ? "Added" : "Missing"}</p>
          <p>Banner: {shop.banner ? "Added" : "Missing"}</p>
        </Summary>
        <Summary title="Contact & policies" href="/merchant/onboarding/contact">
          <p>{shop.contact.email}</p>
          <p>
            Returns:{" "}
            {shop.returnPolicy.mode === "platform"
              ? PLATFORM_RETURN_POLICY.summary
              : shop.returnPolicy.windowDays === 0
                ? "Final sale — no returns"
                : `Returns within ${shop.returnPolicy.windowDays} days`}
          </p>
          <p>
            Ships in {PROCESSING_TIMES.find((p) => p.value === shop.shipping.processingTime)?.label}
          </p>
        </Summary>
        <Summary title="Locations" href="/merchant/onboarding/locations">
          {locations.length === 0 ? (
            <p>None yet</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {locations.map((l) => (
                <li key={l.id}>
                  {l.name} — {l.types.map(typeLabel).join(", ")}, {l.address.city}
                </li>
              ))}
            </ul>
          )}
        </Summary>
      </div>

      <section aria-labelledby="preview-title" className="flex flex-col gap-3">
        <h3 id="preview-title" className="text-label">
          Preview: your shop page
        </h3>
        <div className="overflow-hidden border border-line bg-canvas pb-8">
          <ShopHeader shop={shop} headingLevel={2} />
          {locations.some((l) => l.types.includes("retail")) && (
            <div className="container-page mt-8 grid gap-4 sm:grid-cols-2">
              {locations
                .filter((l) => l.types.includes("retail"))
                .map((l) => (
                  <div key={l.id} className="text-sm">
                    <p className="font-medium">{l.name}</p>
                    <p className="text-ink-soft">
                      {l.address.line1}, {l.address.city}, {l.address.region}
                    </p>
                    <ul className="mt-2 text-ink-soft">
                      {weeklyHours(l).map((d) => (
                        <li key={d.day}>
                          {DAY_NAMES[d.day]}: {d.text}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
            </div>
          )}
        </div>
      </section>

      {submittable ? (
        <SubmitShop shopId={shop.id} blocked={blockers.length > 0} />
      ) : (
        <p role="status">
          {shop.status === "pending_review"
            ? "Your shop is in review — we usually reply within 1 business day."
            : `Your shop is ${SHOP_STATUS_LABELS[shop.status].toLowerCase()}.`}
        </p>
      )}
    </section>
  );
}
