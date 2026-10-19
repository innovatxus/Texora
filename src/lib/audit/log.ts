import "server-only";
import { headers } from "next/headers";
import type { Transaction } from "firebase-admin/firestore";
import type { Session } from "@/lib/auth/session";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { auditLogSchema, type AuditLog } from "@/lib/validation";
import { changedPaths } from "./diff";

export interface AuditEntry {
  actor: Pick<Session, "uid" | "role" | "email">;
  /** Dotted verb, e.g. "orders.refund", "users.assign_role". */
  action: string;
  target: { type: string; id: string };
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

async function requestMeta(): Promise<{ ip: string | null; userAgent: string | null }> {
  try {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
    return {
      ip: forwarded || h.get("x-real-ip") || null,
      userAgent: h.get("user-agent")?.slice(0, 512) ?? null,
    };
  } catch {
    // Outside a request (scripts, background jobs) there are no headers.
    return { ip: null, userAgent: null };
  }
}

export function buildAuditLog(
  entry: AuditEntry,
  meta: { ip: string | null; userAgent: string | null },
  id: string,
  at: Date,
): AuditLog {
  const before = entry.before ?? null;
  const after = entry.after ?? null;
  return auditLogSchema.parse({
    id,
    actor: {
      uid: entry.actor.uid,
      role: entry.actor.role,
      ...(entry.actor.email ? { email: entry.actor.email } : {}),
    },
    action: entry.action,
    target: entry.target,
    before,
    after,
    changes: changedPaths(before, after),
    ip: meta.ip,
    userAgent: meta.userAgent,
    at,
  });
}

/**
 * Appends an immutable audit record. Pass the transaction when the audited
 * change is transactional so the record commits (or fails) with it.
 */
export async function writeAuditLog(entry: AuditEntry, tx?: Transaction): Promise<AuditLog> {
  const { db } = getFirebaseAdmin();
  const ref = db.collection("auditLogs").doc();
  const log = buildAuditLog(entry, await requestMeta(), ref.id, new Date());
  if (tx) tx.create(ref, log);
  else await ref.create(log);
  return log;
}
