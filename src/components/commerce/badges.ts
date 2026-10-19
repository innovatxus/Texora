import { percentOff } from "@/lib/format/money";

export type BadgeTone = "neutral" | "muted" | "inverse" | "sale" | "success" | "warning";

/** The single badge a card shows: the first by priority (sale → final sale → … → new). */
export function primaryBadge(
  badges: readonly string[],
  price: number,
  compareAtPrice?: number,
): { label: string; tone: BadgeTone } | null {
  const first = badges[0];
  switch (first) {
    case "sale": {
      const pct = compareAtPrice ? percentOff(price, compareAtPrice) : 0;
      return { label: pct > 0 ? `Sale −${pct}%` : "Sale", tone: "sale" };
    }
    case "final_sale":
      return { label: "Final sale", tone: "sale" };
    case "low_stock":
      return { label: "Low stock", tone: "warning" };
    case "back_in_stock":
      return { label: "Back in stock", tone: "success" };
    case "online_exclusive":
      return { label: "Online exclusive", tone: "inverse" };
    case "new":
      return { label: "New", tone: "neutral" };
    default:
      return null;
  }
}
