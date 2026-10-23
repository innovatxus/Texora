import { governorateName } from "@/config/locale";
import type { Metadata } from "next";
import NextLink from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActionButton } from "@/components/admin/ActionButton";
import { AdminLoading } from "@/components/admin/AdminLoading";
import { DecisionForm, type DecisionOption } from "@/components/admin/DecisionForm";
import { formatDateTime } from "@/components/admin/status";
import { AdminPageHeader, DetailList, Panel, StatusPill } from "@/components/admin/ui";
import { ShopHeader } from "@/components/merchant/shop/ShopHeader";
import { requirePagePermission } from "@/lib/auth/guard";
import { hasPermission } from "@/lib/auth/rbac";
import { decideShopAction, setTrustLevelAction } from "@/lib/merchant/actions/admin";
import { listLocations } from "@/lib/merchant/repositories/locations";
import { getMerchant } from "@/lib/merchant/repositories/merchants";
import { getShop } from "@/lib/merchant/repositories/shops";
import { SHOP_STATUS_LABELS } from "@/lib/merchant/status";
import { returnSummary } from "@/lib/merchant/storefront";

export const metadata: Metadata = { title: "Merchant shop" };

const REVIEW: DecisionOption[] = [
  { value: "approve", label: "Approve", needsReason: false, variant: "primary" },
  { value: "changes", label: "Request changes", needsReason: true },
  {
    value: "reject",
    label: "Reject",
    needsReason: true,
    confirm: "Reject this shop? It goes back to setup.",
  },
];
const MANAGE_LIVE: DecisionOption[] = [
  {
    value: "suspend",
    label: "Pause shop",
    needsReason: true,
    confirm: "Pause this shop? Its products disappear from the storefront.",
  },
];
const MANAGE_PAUSED: DecisionOption[] = [
  { value: "reinstate", label: "Reinstate", needsReason: false, variant: "primary" },
];

async function ShopDetail({ params }: PageProps<"/admin/merchants/[shopId]">) {
  const session = await requirePagePermission("merchants.review");
  const { shopId } = await params;
  const shop = await getShop(shopId);
  if (!shop) notFound();
  const [merchant, locations] = await Promise.all([
    getMerchant(shop.vendorId),
    listLocations(shop.id),
  ]);
  const canManage = hasPermission(session.role, "merchants.manage");
  const options =
    shop.status === "pending_review"
      ? REVIEW
      : shop.status === "approved" && canManage
        ? MANAGE_LIVE
        : shop.status === "suspended" && canManage
          ? MANAGE_PAUSED
          : [];

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        eyebrow={
          <NextLink href="/admin/merchants" className="underline">
            Merchant shops
          </NextLink>
        }
        title={shop.name}
        description={<StatusPill>{SHOP_STATUS_LABELS[shop.status]}</StatusPill>}
      />
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          <Panel title="Shop page preview">
            <div className="-mx-4 overflow-hidden border-y border-line bg-canvas pb-6">
              <ShopHeader shop={shop} headingLevel={2} />
            </div>
          </Panel>
          <Panel title="Details">
            <DetailList
              items={[
                ["Address", `/shops/${shop.slug}`],
                ["Type", shop.shopType],
                ["Categories", shop.categoryKeys.join(", ")],
                [
                  "Contact",
                  shop.contact.email + (shop.contact.phone ? ` · ${shop.contact.phone}` : ""),
                ],
                ["Returns", returnSummary(shop.returnPolicy)],
                ["Processing", `${shop.shipping.processingTime} business days`],
                [
                  "Locations",
                  locations
                    .map(
                      (l) =>
                        `${l.name} (${l.types.join(", ")}) — ${l.address.city}, ${governorateName(l.address.region)}`,
                    )
                    .join("; ") || "None",
                ],
              ]}
            />
          </Panel>
          <Panel title="Review history">
            {shop.reviewNotes.length === 0 ? (
              <p className="text-sm text-ink-soft">No decisions yet.</p>
            ) : (
              <ol className="flex flex-col gap-3 text-sm">
                {[...shop.reviewNotes].reverse().map((note, i) => (
                  <li key={i}>
                    <span className="font-medium">{note.decision.replace("_", " ")}</span> ·{" "}
                    {formatDateTime(note.at)}
                    {note.reasons.length > 0 && (
                      <ul className="mt-1 list-disc pl-5 text-ink-soft">
                        {note.reasons.map((r) => (
                          <li key={r}>{r}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
        <div className="flex flex-col gap-5">
          {options.length > 0 && (
            <Panel title="Decision">
              <DecisionForm
                action={decideShopAction}
                payload={{ shopId: shop.id }}
                options={options}
                done={{
                  approve: "Approved. The shop and its live products are now visible.",
                  changes: "Changes requested. The merchant has been emailed.",
                  reject: "Rejected. The merchant has been emailed.",
                  suspend: "Paused. Its products are hidden.",
                  reinstate: "Reinstated. The shop is live again.",
                }}
              />
            </Panel>
          )}
          {merchant && (
            <Panel title="Merchant">
              <DetailList
                items={[
                  ["Username", `@${merchant.username}`],
                  ["Email", merchant.email],
                  ["Email verified", merchant.emailVerified ? "Yes" : "No"],
                  [
                    "Trust level",
                    merchant.trustLevel === "trusted" ? "Trusted (no product review)" : "Standard",
                  ],
                ]}
              />
              {canManage && (
                <div className="mt-3">
                  <ActionButton
                    action={setTrustLevelAction}
                    payload={{
                      vendorId: merchant.id,
                      trustLevel: merchant.trustLevel === "trusted" ? "standard" : "trusted",
                    }}
                    done="Trust level updated."
                  >
                    {merchant.trustLevel === "trusted" ? "Make standard" : "Make trusted"}
                  </ActionButton>
                </div>
              )}
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}

/** One merchant shop: preview, details, history, decisions and trust level. */
export default function Page(props: PageProps<"/admin/merchants/[shopId]">) {
  return (
    <Suspense fallback={<AdminLoading />}>
      <ShopDetail {...props} />
    </Suspense>
  );
}
