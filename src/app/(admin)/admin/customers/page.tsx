import type { Metadata } from "next";
import NextLink from "next/link";
import { Suspense } from "react";
import { AdminLoading } from "@/components/admin/AdminLoading";
import { formatDate } from "@/components/admin/status";
import {
  AdminField,
  AdminPageHeader,
  adminControl,
  DataTable,
  FilterBar,
} from "@/components/admin/ui";
import { searchUsers } from "@/lib/admin/people-service";
import { requirePagePermission } from "@/lib/auth/guard";
import { TIER_NAMES } from "@/lib/loyalty/tiers";

/** Customers title. */
export const metadata: Metadata = { title: "Customers" };

const param = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

async function Customers({ searchParams }: PageProps<"/admin/customers">) {
  await requirePagePermission("customers.read");
  const q = param((await searchParams).q);
  const customers = await searchUsers({ q, staff: false });
  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader title="Customers" description="Find a customer by email or name." />
      <FilterBar action="/admin/customers">
        <AdminField label="Email or name">
          <input name="q" defaultValue={q} className={`${adminControl} w-64`} />
        </AdminField>
      </FilterBar>
      <DataTable
        caption="Customers"
        rows={customers.slice(0, 100)}
        rowKey={(u) => u.uid}
        empty="No customers match."
        columns={[
          {
            header: "Customer",
            cell: (u) => (
              <NextLink href={`/admin/customers/${u.uid}`} className="font-medium underline">
                {u.firstName} {u.lastName}
              </NextLink>
            ),
          },
          { header: "Email", cell: (u) => u.email },
          {
            header: "Rewards",
            cell: (u) =>
              u.loyalty ? `${TIER_NAMES[u.loyalty.tier]} · ${u.loyalty.points} pts` : "—",
          },
          { header: "Joined", cell: (u) => formatDate(u.createdAt) },
          { header: "Status", cell: (u) => (u.disabled ? "Disabled" : "Active") },
        ]}
      />
    </div>
  );
}

/** Customer search. */
export default function Page(props: PageProps<"/admin/customers">) {
  return (
    <Suspense fallback={<AdminLoading />}>
      <Customers {...props} />
    </Suspense>
  );
}
