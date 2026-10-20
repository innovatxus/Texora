import type { Metadata } from "next";
import NextLink from "next/link";
import { Suspense } from "react";
import { AdminLoading } from "@/components/admin/AdminLoading";
import { formatDateTime } from "@/components/admin/status";
import { AdminPageHeader, DataTable, StatusPill } from "@/components/admin/ui";
import { listPages } from "@/lib/admin/site-service";
import { requirePagePermission } from "@/lib/auth/guard";

/** Content title. */
export const metadata: Metadata = { title: "Content" };

/** Storefront URL for a CMS page slug ("home" is the home page). */
const pageUrl = (slug: string) => (slug === "home" ? "/" : `/${slug}`);

async function Content() {
  await requirePagePermission("content.write");
  const pages = await listPages();
  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        title="Content"
        description="Home and landing pages are built from modules you can schedule and target."
      />
      <DataTable
        caption="Pages"
        rows={pages}
        rowKey={(p) => p.slug}
        columns={[
          {
            header: "Page",
            cell: (p) => (
              <NextLink href={`/admin/content/${p.slug}`} className="font-medium underline">
                {p.title}
              </NextLink>
            ),
          },
          {
            header: "URL",
            cell: (p) => <span className="font-mono text-xs">{pageUrl(p.slug)}</span>,
          },
          { header: "Modules", cell: (p) => p.modules.length, align: "right" },
          { header: "Updated", cell: (p) => formatDateTime(p.updatedAt) },
          {
            header: "Status",
            cell: (p) => (
              <StatusPill tone={p.status === "live" ? "success" : "neutral"}>{p.status}</StatusPill>
            ),
          },
        ]}
      />
    </div>
  );
}

/** CMS pages list. */
export default function Page() {
  return (
    <Suspense fallback={<AdminLoading />}>
      <Content />
    </Suspense>
  );
}
