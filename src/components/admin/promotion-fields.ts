import { AUDIENCES, PROMOTION_TYPES, type Promotion } from "@/lib/validation";
import type { ActionField } from "./ActionForm";

const TYPE_LABELS: Record<(typeof PROMOTION_TYPES)[number], string> = {
  percent: "Percentage off",
  fixed: "Amount off",
  bogo: "Buy one, get one",
  tiered: "Spend more, save more",
  free_shipping: "Free shipping",
};

const AUDIENCE_LABELS: Record<(typeof AUDIENCES)[number], string> = {
  everyone: "Everyone",
  guest: "Guests",
  member: "Rewards members",
  core: "Core members",
  enthusiast: "Enthusiast members",
  icon: "Icon members",
};

const localInput = (d: Date | undefined) =>
  d ? new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : "";

/** Form fields for creating or editing a promotion, prefilled from an existing one. */
export function promotionFields(p?: Promotion): ActionField[] {
  return [
    { name: "name", label: "Name", type: "text", required: true, defaultValue: p?.name ?? "" },
    {
      name: "type",
      label: "Type",
      type: "select",
      required: true,
      defaultValue: p?.type ?? "percent",
      options: PROMOTION_TYPES.map((t) => ({ value: t, label: TYPE_LABELS[t] })),
    },
    {
      name: "value",
      label: "Value",
      type: "number",
      step: "0.01",
      required: true,
      defaultValue: p ? String(p.type === "fixed" ? p.value / 100 : p.value) : "0",
      hint: "Percent for percentage off, EGP for amount off. Ignored for BOGO and free shipping.",
    },
    {
      name: "tiers",
      label: "Tiers",
      type: "text",
      defaultValue: p?.tiers?.map((t) => `${t.minSubtotal / 100}:${t.value}`).join(", ") ?? "",
      hint: "Spend more, save more: spend:percent pairs, e.g. 100:10, 200:20",
    },
    {
      name: "minSubtotal",
      label: "Minimum spend (EGP)",
      type: "number",
      step: "0.01",
      defaultValue: p?.conditions.minSubtotal ? String(p.conditions.minSubtotal / 100) : "",
    },
    {
      name: "categoryKeys",
      label: "Only these categories",
      type: "text",
      defaultValue: p?.conditions.categoryKeys?.join(", ") ?? "",
      hint: "Comma separated, e.g. women/dresses, men. Empty for everything.",
    },
    {
      name: "audience",
      label: "Who can use it",
      type: "select",
      required: true,
      defaultValue: p?.audience ?? "everyone",
      options: AUDIENCES.map((a) => ({ value: a, label: AUDIENCE_LABELS[a] })),
    },
    {
      name: "priority",
      label: "Priority",
      type: "number",
      required: true,
      defaultValue: String(p?.priority ?? 10),
      hint: "Higher wins when two non-stackable promotions both apply.",
    },
    {
      name: "startsAt",
      label: "Starts",
      type: "datetime-local",
      defaultValue: localInput(p?.schedule.startsAt),
    },
    {
      name: "endsAt",
      label: "Ends",
      type: "datetime-local",
      defaultValue: localInput(p?.schedule.endsAt),
    },
    {
      name: "excludeSale",
      label: "Exclude items already on sale",
      type: "checkbox",
      defaultChecked: p?.conditions.excludeSale ?? false,
    },
    {
      name: "automatic",
      label: "Applies automatically (no code needed)",
      type: "checkbox",
      defaultChecked: p?.automatic ?? false,
    },
    {
      name: "stackable",
      label: "Can combine with other promotions",
      type: "checkbox",
      defaultChecked: p?.stackable ?? false,
    },
    { name: "active", label: "Active", type: "checkbox", defaultChecked: p?.active ?? false },
  ];
}

export { TYPE_LABELS as PROMOTION_TYPE_LABELS, AUDIENCE_LABELS };
