import type { Metadata } from "next";
import NextLink from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/admin/ActionForm";
import { AdminLoading } from "@/components/admin/AdminLoading";
import { formatDateTime } from "@/components/admin/status";
import { AdminField, AdminPageHeader, adminControl, FilterBar, Panel } from "@/components/admin/ui";
import { adjustStockAction } from "@/lib/admin/inventory-actions";
import { ADJUSTMENT_REASONS, listAdjustments, listInventory } from "@/lib/admin/inventory-service";
import { requirePagePermission } from "@/lib/auth/guard";
import { hasPermission } from "@/lib/auth/rbac";
import { listStores } from "@/lib/data/catalog-structure";
import { cn } from "@/lib/utils/cn";
import { ONLINE_LOCATION } from "@/lib/validation";

/** Inventory title. */
export const metadata: Metadata = { title: "Inventory" };

const param = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
const PAGE_SIZE = 50;

async function Inventory({ searchParams }: PageProps<"/admin/inventory">) {
  const session = await requirePagePermission("inventory.read");
  const sp = await searchParams;
  const q = param(sp.q);
  const lowOnly = param(sp.low) === "1";
  const selected = param(sp.sku);
  const page = Math.max(1, Number(param(sp.page) ?? 1) || 1);
  const [rows, stores] = await Promise.all([listInventory({ q, lowOnly }), listStores()]);
  const locations = [
    { id: ONLINE_LOCATION, name: "Online" },
    ...stores.map((s) => ({ id: s.id, name: s.name.replace(/^\S+\s/, "") })),
  ];
  const shown = rows.slice(0, page * PAGE_SIZE);
  const current = selected ? rows.find((r) => r.sku === selected) : undefined;
  const history = current ? await listAdjustments(current.sku) : [];
  const canWrite = hasPermission(session.role, "inventory.write");
  const link = (extra: Record<string, string>) =>
    `/admin/inventory?${new URLSearchParams({
      ...(q ? { q } : {}),
      ...(lowOnly ? { low: "1" } : {}),
      ...extra,
    })}`;

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        title="Inventory"
        description={`${rows.length} SKUs${lowOnly ? " at or below their low-stock threshold online" : ""}`}
      />
      <FilterBar action="/admin/inventory">
        <AdminField label="SKU or product">
          <input name="q" defaultValue={q} className={`${adminControl} w-56`} />
        </AdminField>
        <label className="flex h-10 items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="low"
            value="1"
            defaultChecked={lowOnly}
            className="size-4 accent-ink"
          />
          Low stock only
        </label>
      </FilterBar>

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="overflow-x-auto border border-line bg-surface">
          <table className="w-full text-sm tabular-nums">
            <caption className="sr-only">Stock by SKU and location</caption>
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-subtle">
                <th scope="col" className="px-3 py-2 font-medium">
                  SKU
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Product
                </th>
                {locations.map((l) => (
                  <th key={l.id} scope="col" className="px-3 py-2 text-right font-medium">
                    {l.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const online = r.stock[ONLINE_LOCATION] ?? 0;
                return (
                  <tr
                    key={r.sku}
                    className={cn(
                      "border-b border-line last:border-0",
                      r.sku === selected && "bg-surface-muted",
                    )}
                  >
                    <td className="px-3 py-2">
                      <NextLink href={link({ sku: r.sku })} className="font-mono text-xs underline">
                        {r.sku}
                      </NextLink>
                    </td>
                    <td className="px-3 py-2">
                      {r.productName}
                      <span className="block text-xs text-ink-soft">
                        {r.color} · {r.fitFamily} · {r.size.replace("x", " × ")}
                      </span>
                    </td>
                    {locations.map((l) => {
                      const n = r.stock[l.id] ?? 0;
                      return (
                        <td
                          key={l.id}
                          className={cn(
                            "px-3 py-2 text-right",
                            l.id === ONLINE_LOCATION &&
                              online <= r.threshold &&
                              "font-medium text-sale",
                          )}
                        >
                          {n}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 && <p className="p-6 text-sm text-ink-soft">No SKUs match.</p>}
          {shown.length < rows.length && (
            <p className="border-t border-line p-3 text-center text-sm">
              <NextLink href={link({ page: String(page + 1) })} className="underline">
                Show more ({rows.length - shown.length} left)
              </NextLink>
            </p>
          )}
        </div>

        <aside className="flex flex-col gap-6">
          {current ? (
            <>
              <Panel title={current.sku}>
                <p className="mb-3 text-ink-soft">
                  {current.productName}, {current.color}, {current.size.replace("x", " × ")}.
                  Low-stock threshold {current.threshold}.
                </p>
                {canWrite ? (
                  <ActionForm
                    action={adjustStockAction}
                    payload={{ sku: current.sku }}
                    submitLabel="Adjust stock"
                    done="Stock updated"
                    fields={[
                      {
                        name: "location",
                        label: "Location",
                        type: "select",
                        required: true,
                        defaultValue: ONLINE_LOCATION,
                        options: locations.map((l) => ({
                          value: l.id,
                          label: `${l.name} (${current.stock[l.id] ?? 0} in stock)`,
                        })),
                      },
                      {
                        name: "delta",
                        label: "Change",
                        type: "number",
                        required: true,
                        hint: "Positive to add, negative to remove",
                      },
                      {
                        name: "reason",
                        label: "Reason",
                        type: "select",
                        required: true,
                        options: ADJUSTMENT_REASONS,
                      },
                      { name: "note", label: "Note", type: "text" },
                    ]}
                  />
                ) : (
                  <p className="text-ink-soft">You can view stock but not change it.</p>
                )}
              </Panel>
              <Panel title="Recent changes">
                {history.length === 0 ? (
                  <p className="text-ink-soft">No adjustments yet.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {history.map((h) => (
                      <li key={h.id}>
                        <span
                          className={cn("font-medium tabular-nums", h.delta < 0 && "text-sale")}
                        >
                          {h.delta > 0 ? `+${h.delta}` : h.delta}
                        </span>{" "}
                        {locations.find((l) => l.id === h.location)?.name ?? h.location} → {h.after}
                        <span className="block text-xs text-ink-soft">
                          {ADJUSTMENT_REASONS.find((r) => r.value === h.reason)?.label}
                          {h.note ? ` · ${h.note}` : ""} · {formatDateTime(h.at)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </>
          ) : (
            <Panel title="Adjust stock">
              <p className="text-ink-soft">Choose a SKU to see its history and adjust its stock.</p>
            </Panel>
          )}
        </aside>
      </div>
    </div>
  );
}

/** Inventory: stock per location, low-stock filter and adjustments with reasons. */
export default function Page(props: PageProps<"/admin/inventory">) {
  return (
    <Suspense fallback={<AdminLoading />}>
      <Inventory {...props} />
    </Suspense>
  );
}
