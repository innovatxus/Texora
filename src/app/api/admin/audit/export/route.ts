import { toCsv } from "@/lib/admin/csv";
import { writeAuditLog } from "@/lib/audit/log";
import { AuthorizationError, requirePermission } from "@/lib/auth/guard";
import { listAuditLogs } from "@/lib/data/admin-records";
import type { AuditLog } from "@/lib/validation";

const MAX_ROWS = 5_000;

/** Downloads audit entries (same filters as the viewer) as CSV, newest first. */
export async function GET(request: Request) {
  let session;
  try {
    session = await requirePermission("audit.export");
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return new Response(error.code === "unauthenticated" ? "Sign in" : "Forbidden", {
        status: error.code === "unauthenticated" ? 401 : 403,
      });
    }
    throw error;
  }
  const params = new URL(request.url).searchParams;
  const value = (k: string) => params.get(k)?.trim() || undefined;
  const action = value("action");
  const actor = value("actor");
  const targetType = value("targetType");
  const targetId = value("targetId");

  const rows: AuditLog[] = [];
  let cursor: string | null = null;
  do {
    const page = await listAuditLogs({
      limit: 500,
      cursor,
      ...(action ? { action } : {}),
      ...(actor ? { actorUid: actor } : {}),
      ...(targetType && targetId ? { target: { type: targetType, id: targetId } } : {}),
    });
    rows.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor && rows.length < MAX_ROWS);

  const csv = toCsv(
    [
      "at",
      "action",
      "actor_uid",
      "actor_role",
      "actor_email",
      "target_type",
      "target_id",
      "changes",
      "before",
      "after",
      "ip",
    ],
    rows
      .slice(0, MAX_ROWS)
      .map((l) => [
        l.at.toISOString(),
        l.action,
        l.actor.uid,
        l.actor.role,
        l.actor.email ?? "",
        l.target.type,
        l.target.id,
        l.changes.join(" "),
        l.before ? JSON.stringify(l.before) : "",
        l.after ? JSON.stringify(l.after) : "",
        l.ip ?? "",
      ]),
  );
  await writeAuditLog({
    actor: session,
    action: "audit.export",
    target: { type: "audit_log", id: "csv" },
    after: { rows: Math.min(rows.length, MAX_ROWS), action, actor, targetType, targetId },
  });
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
