import type { Metadata } from "next";
import { Suspense } from "react";
import { ActionForm } from "@/components/admin/ActionForm";
import { AdminLoading } from "@/components/admin/AdminLoading";
import { formatDateTime } from "@/components/admin/status";
import { AdminPageHeader, DetailList, Panel } from "@/components/admin/ui";
import { updateSettingsAction, updateStoreAction } from "@/lib/admin/ops-actions";
import { requirePagePermission } from "@/lib/auth/guard";
import { hasPermission } from "@/lib/auth/rbac";
import { getStoreSettings } from "@/lib/data/admin-records";
import { listStores } from "@/lib/data/catalog-structure";
import { formatMoney } from "@/lib/format/money";

/** Settings title. */
export const metadata: Metadata = { title: "Settings" };

const dollars = (cents: number) => (cents / 100).toFixed(2);

async function Settings() {
  const session = await requirePagePermission("settings.read");
  const canWrite = hasPermission(session.role, "settings.write");
  const [settings, stores] = await Promise.all([getStoreSettings(), listStores()]);

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Settings"
        description={`Store-wide rules. Last changed ${formatDateTime(settings.updatedAt)}.`}
      />
      {canWrite ? (
        <Panel title="Shipping, refunds, rewards and features">
          <ActionForm
            action={updateSettingsAction}
            submitLabel="Save settings"
            done="Settings saved"
            variant="primary"
            resetOnSuccess={false}
            className="grid gap-4 md:grid-cols-3"
            fields={[
              {
                name: "standardRate",
                label: "Standard shipping ($)",
                type: "number",
                step: "0.01",
                required: true,
                defaultValue: dollars(settings.shippingRates.standard),
              },
              {
                name: "expressRate",
                label: "Express shipping ($)",
                type: "number",
                step: "0.01",
                required: true,
                defaultValue: dollars(settings.shippingRates.express),
              },
              {
                name: "freeShippingThreshold",
                label: "Free standard shipping from ($)",
                type: "number",
                step: "0.01",
                required: true,
                defaultValue: dollars(settings.freeShippingThreshold),
              },
              {
                name: "refundLimit",
                label: "Customer service refund limit per order ($)",
                type: "number",
                step: "0.01",
                required: true,
                defaultValue: dollars(settings.refundLimits.customer_service),
                hint: "Admins can refund more.",
              },
              {
                name: "reservationMinutes",
                label: "Hold stock for card payments (minutes)",
                type: "number",
                required: true,
                defaultValue: String(settings.reservationMinutes),
              },
              {
                name: "pointsPerDollar",
                label: "Reward points per dollar",
                type: "number",
                required: true,
                defaultValue: String(settings.loyalty.pointsPerCurrencyUnit),
              },
              {
                name: "enthusiastThreshold",
                label: "Enthusiast tier from ($ a year)",
                type: "number",
                step: "0.01",
                required: true,
                defaultValue: dollars(settings.loyalty.tierThresholds.enthusiast),
              },
              {
                name: "iconThreshold",
                label: "Icon tier from ($ a year)",
                type: "number",
                step: "0.01",
                required: true,
                defaultValue: dollars(settings.loyalty.tierThresholds.icon),
              },
              {
                name: "birthdayPoints",
                label: "Birthday reward (points)",
                type: "number",
                required: true,
                defaultValue: String(settings.loyalty.birthdayRewardPoints),
              },
              {
                name: "cashOnDelivery",
                label: "Offer pay on delivery",
                type: "checkbox",
                defaultChecked: settings.features.cashOnDelivery,
              },
              {
                name: "expressPay",
                label: "Express pay buttons (needs card payments)",
                type: "checkbox",
                defaultChecked: settings.features.expressPay,
              },
              {
                name: "quickView",
                label: "Quick view on product cards",
                type: "checkbox",
                defaultChecked: settings.features.quickView,
              },
              {
                name: "vendorMarketplace",
                label: "Marketplace merchants",
                type: "checkbox",
                defaultChecked: settings.features.vendorMarketplace,
              },
            ]}
          />
        </Panel>
      ) : (
        <Panel title="Store settings">
          <DetailList
            items={[
              ["Standard shipping", formatMoney(settings.shippingRates.standard)],
              ["Express shipping", formatMoney(settings.shippingRates.express)],
              ["Free shipping from", formatMoney(settings.freeShippingThreshold)],
              [
                "Refund limit (customer service)",
                formatMoney(settings.refundLimits.customer_service),
              ],
              ["Points per dollar", settings.loyalty.pointsPerCurrencyUnit],
              ["Pay on delivery", settings.features.cashOnDelivery ? "On" : "Off"],
            ]}
          />
        </Panel>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {stores.map((store) => (
          <Panel key={store.id} title={store.name}>
            <p className="mb-3 text-ink-soft">
              {store.address.line1}, {store.address.city}, {store.address.region}
            </p>
            {canWrite ? (
              <ActionForm
                action={updateStoreAction}
                payload={{ storeId: store.id }}
                submitLabel="Save store"
                done="Store saved"
                resetOnSuccess={false}
                fields={[
                  {
                    name: "phone",
                    label: "Phone",
                    type: "text",
                    required: true,
                    defaultValue: store.phone,
                  },
                  {
                    name: "status",
                    label: "Status",
                    type: "select",
                    required: true,
                    defaultValue: store.status,
                    options: [
                      { value: "open", label: "Open" },
                      { value: "temporarily_closed", label: "Temporarily closed" },
                      { value: "closed", label: "Permanently closed" },
                    ],
                  },
                  {
                    name: "returns",
                    label: "Accepts returns",
                    type: "checkbox",
                    defaultChecked: store.services.includes("returns"),
                  },
                  {
                    name: "alterations",
                    label: "Alterations",
                    type: "checkbox",
                    defaultChecked: store.services.includes("alterations"),
                  },
                  {
                    name: "styling",
                    label: "Personal styling",
                    type: "checkbox",
                    defaultChecked: store.services.includes("styling"),
                  },
                ]}
              />
            ) : (
              <DetailList
                items={[
                  ["Phone", store.phone],
                  ["Status", store.status.replace("_", " ")],
                  ["Services", store.services.join(", ")],
                ]}
              />
            )}
          </Panel>
        ))}
      </div>
    </div>
  );
}

/** Settings: shipping, refunds, reservations, loyalty, feature switches and stores. */
export default function Page() {
  return (
    <Suspense fallback={<AdminLoading />}>
      <Settings />
    </Suspense>
  );
}
