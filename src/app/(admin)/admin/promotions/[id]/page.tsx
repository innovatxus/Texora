import type { Metadata } from "next";
import NextLink from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActionButton } from "@/components/admin/ActionButton";
import { ActionForm } from "@/components/admin/ActionForm";
import { AdminLoading } from "@/components/admin/AdminLoading";
import { promotionFields } from "@/components/admin/promotion-fields";
import { AdminPageHeader, DataTable, Panel, StatusPill } from "@/components/admin/ui";
import { listPromoCodes } from "@/lib/admin/merch-service";
import {
  generateCodesAction,
  savePromotionAction,
  setPromoCodeActiveAction,
} from "@/lib/admin/ops-actions";
import { requirePagePermission } from "@/lib/auth/guard";
import { getPromotion } from "@/lib/data/promotions";

/** Promotion editor title. */
export const metadata: Metadata = { title: "Promotion" };

async function EditPromotion({ params }: PageProps<"/admin/promotions/[id]">) {
  await requirePagePermission("promotions.write");
  const { id } = await params;
  const [promotion, codes] = await Promise.all([getPromotion(id), listPromoCodes(id)]);
  if (!promotion) notFound();
  const used = codes.reduce((n, c) => n + c.usedCount, 0);

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        eyebrow={
          <NextLink href="/admin/promotions" className="underline">
            Promotions
          </NextLink>
        }
        title={promotion.name}
        description={`${codes.length} codes · used ${used} times`}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <Panel title="Details">
          <ActionForm
            action={savePromotionAction}
            payload={{ id: promotion.id }}
            submitLabel="Save"
            variant="primary"
            resetOnSuccess={false}
            className="grid gap-4 md:grid-cols-2"
            fields={promotionFields(promotion)}
          />
        </Panel>
        <aside className="flex flex-col gap-6">
          <Panel title="Generate codes">
            <ActionForm
              action={generateCodesAction}
              payload={{ promotionId: promotion.id }}
              submitLabel="Generate"
              done="Codes created"
              fields={[
                {
                  name: "prefix",
                  label: "Prefix",
                  type: "text",
                  required: true,
                  placeholder: "FALL",
                },
                {
                  name: "count",
                  label: "How many",
                  type: "number",
                  required: true,
                  defaultValue: "50",
                },
                {
                  name: "usageLimit",
                  label: "Uses per code",
                  type: "number",
                  hint: "Empty for unlimited",
                },
                { name: "perCustomerLimit", label: "Uses per customer", type: "number" },
              ]}
            />
          </Panel>
        </aside>
      </div>
      <Panel title="Codes">
        <DataTable
          caption="Promo codes for this promotion"
          rows={codes}
          rowKey={(c) => c.code}
          empty="No codes. Automatic promotions don't need one."
          columns={[
            { header: "Code", cell: (c) => <span className="font-mono">{c.code}</span> },
            {
              header: "Used",
              cell: (c) => `${c.usedCount}${c.usageLimit ? ` / ${c.usageLimit}` : ""}`,
              align: "right",
            },
            { header: "Per customer", cell: (c) => c.perCustomerLimit ?? "—", align: "right" },
            {
              header: "Status",
              cell: (c) => (
                <StatusPill tone={c.active ? "success" : "neutral"}>
                  {c.active ? "On" : "Off"}
                </StatusPill>
              ),
            },
            {
              header: "Action",
              cell: (c) => (
                <ActionButton
                  action={setPromoCodeActiveAction}
                  payload={{ code: c.code, active: !c.active }}
                >
                  {c.active ? "Turn off" : "Turn on"}
                </ActionButton>
              ),
            },
          ]}
        />
      </Panel>
    </div>
  );
}

/** One promotion: details, code generation and codes. */
export default function Page(props: PageProps<"/admin/promotions/[id]">) {
  return (
    <Suspense fallback={<AdminLoading />}>
      <EditPromotion {...props} />
    </Suspense>
  );
}
