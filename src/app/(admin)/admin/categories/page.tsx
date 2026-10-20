import type { Metadata } from "next";
import NextLink from "next/link";
import { Suspense } from "react";
import { AdminLoading } from "@/components/admin/AdminLoading";
import { AdminPageHeader, Panel, StatusPill } from "@/components/admin/ui";
import { listAllCategories } from "@/lib/admin/catalog-service";
import { requirePagePermission } from "@/lib/auth/guard";
import { DEPARTMENTS } from "@/lib/validation";

/** Categories title. */
export const metadata: Metadata = { title: "Categories" };

async function Categories() {
  await requirePagePermission("merch.write");
  const categories = await listAllCategories();
  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        title="Categories"
        description="Edit names, menu order and visibility, and pin, boost or bury products."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        {DEPARTMENTS.map((department) => {
          const root = categories.find((c) => c.department === department && c.parentId === null);
          const children = categories.filter(
            (c) => c.department === department && c.parentId !== null,
          );
          return (
            <Panel key={department} title={root?.name ?? department}>
              <ul className="flex flex-col divide-y divide-line">
                {[...(root ? [root] : []), ...children].map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-3 py-2"
                    style={{ paddingLeft: `${(c.path.length - 1) * 1.25}rem` }}
                  >
                    <NextLink href={`/admin/categories/${c.id}`} className="underline">
                      {c.name}
                    </NextLink>
                    <span className="flex items-center gap-3 text-xs text-ink-soft">
                      {c.merchRules.pinned.length > 0 && `${c.merchRules.pinned.length} pinned`}
                      <StatusPill tone={c.status === "live" ? "success" : "neutral"}>
                        {c.status}
                      </StatusPill>
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}

/** Category tree for both departments. */
export default function Page() {
  return (
    <Suspense fallback={<AdminLoading />}>
      <Categories />
    </Suspense>
  );
}
