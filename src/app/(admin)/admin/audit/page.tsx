import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminLoading } from "@/components/admin/AdminLoading";
import { formatDateTime } from "@/components/admin/status";
import {
  AdminField,
  AdminPageHeader,
  adminControl,
  CursorPagination,
  DataTable,
  FilterBar,
} from "@/components/admin/ui";
import { requirePagePermission } from "@/lib/auth/guard";
import { hasPermission, ROLE_LABELS } from "@/lib/auth/rbac";
import { listAuditLogs } from "@/lib/data/admin-records";

/** Audit log title. */
export const metadata: Metadata = { title: "Audit log" };

const param = (v: string | string[] | undefined) =>
  typeof v === "string" && v.trim() ? v.trim() : undefined;

async function Audit({ searchParams }: PageProps<"/admin/audit">) {
  const session = await requirePagePermission("audit.read");
  const sp = await searchParams;
  const filters = {
    action: param(sp.action),
    actor: param(sp.actor),
    targetType: param(sp.targetType),
    targetId: param(sp.targetId),
    cursor: param(sp.cursor),
  };
  const page = await listAuditLogs({
    limit: 50,
    cursor: filters.cursor ?? null,
    ...(filters.action ? { action: filters.action } : {}),
    ...(filters.actor ? { actorUid: filters.actor } : {}),
    ...(filters.targetType && filters.targetId
      ? { target: { type: filters.targetType, id: filters.targetId } }
      : {}),
  });
  const exportQuery = new URLSearchParams(
    Object.entries(filters).filter(
      (e): e is [string, string] => e[0] !== "cursor" && Boolean(e[1]),
    ),
  );

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        title="Audit log"
        description="Every staff and system change, newest first. Records can't be edited or deleted."
        actions={
          hasPermission(session.role, "audit.export") && (
            <form action="/api/admin/audit/export" method="get">
              {[...exportQuery].map(([k, v]) => (
                <input key={k} type="hidden" name={k} value={v} />
              ))}
              <button
                type="submit"
                className="inline-flex h-10 items-center border border-ink px-4 text-label hover:bg-ink hover:text-surface"
              >
                Export CSV
              </button>
            </form>
          )
        }
      />
      <FilterBar action="/admin/audit">
        <AdminField label="Action" hint="e.g. orders.refund">
          <input name="action" defaultValue={filters.action} className={`${adminControl} w-48`} />
        </AdminField>
        <AdminField label="Actor user id">
          <input name="actor" defaultValue={filters.actor} className={`${adminControl} w-48`} />
        </AdminField>
        <AdminField label="Target type" hint="e.g. order">
          <input
            name="targetType"
            defaultValue={filters.targetType}
            className={`${adminControl} w-32`}
          />
        </AdminField>
        <AdminField label="Target id">
          <input
            name="targetId"
            defaultValue={filters.targetId}
            className={`${adminControl} w-48`}
          />
        </AdminField>
      </FilterBar>
      <p className="text-xs text-ink-soft">
        Filters apply one at a time: action, then actor, then target.
      </p>
      <DataTable
        caption="Audit log entries"
        rows={page.items}
        rowKey={(l) => l.id}
        empty="No entries match."
        columns={[
          { header: "When", cell: (l) => formatDateTime(l.at) },
          { header: "Action", cell: (l) => <span className="font-mono text-xs">{l.action}</span> },
          {
            header: "Actor",
            cell: (l) => (
              <>
                {l.actor.email ?? l.actor.uid}
                <span className="block text-xs text-ink-soft">{ROLE_LABELS[l.actor.role]}</span>
              </>
            ),
          },
          {
            header: "Target",
            cell: (l) => (
              <span className="font-mono text-xs">
                {l.target.type}/{l.target.id}
              </span>
            ),
          },
          {
            header: "Changes",
            cell: (l) => (
              <span className="text-xs text-ink-soft">{l.changes.join(", ") || "—"}</span>
            ),
          },
          { header: "IP", cell: (l) => <span className="text-xs">{l.ip ?? "—"}</span> },
        ]}
      />
      <CursorPagination
        basePath="/admin/audit"
        params={filters}
        nextCursor={page.nextCursor}
        hasPrevious={Boolean(filters.cursor)}
      />
    </div>
  );
}

/** Audit log: filters, pagination and export. */
export default function Page(props: PageProps<"/admin/audit">) {
  return (
    <Suspense fallback={<AdminLoading />}>
      <Audit {...props} />
    </Suspense>
  );
}
