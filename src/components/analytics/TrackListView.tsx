"use client";

import { useEffect } from "react";
import { track, type AnalyticsItem } from "@/lib/analytics/events";

/** Records a product list view once per list and page of results. */
export function TrackListView({ listName, items }: { listName: string; items: AnalyticsItem[] }) {
  const key = `${listName}|${items.map((i) => i.item_id).join(",")}`;
  useEffect(() => {
    const [name = ""] = key.split("|");
    if (items.length) track({ name: "view_item_list", params: { item_list_name: name, items } });
    // Keyed on the list and its products, not the array identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}
