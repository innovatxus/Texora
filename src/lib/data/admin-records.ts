import "server-only";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import {
  auditLogSchema,
  storeSettingsSchema,
  userSchema,
  type AuditLog,
  type StoreSettings,
  type User,
} from "@/lib/validation";
import { paginate, parseSnapshot, type Page, type PageRequest } from "./firestore";

const db = () => getFirebaseAdmin().db;

/** A user's profile document, or null. */
export async function getUserProfile(uid: string): Promise<User | null> {
  return parseSnapshot(userSchema, await db().collection("users").doc(uid).get(), "uid");
}

/** Document id of the single store settings record. */
export const STORE_SETTINGS_ID = "store";

/** Store-wide settings (shipping, loyalty, features). Throws if the store hasn't been seeded. */
export async function getStoreSettings(): Promise<StoreSettings> {
  const settings = parseSnapshot(
    storeSettingsSchema,
    await db().collection("settings").doc(STORE_SETTINGS_ID).get(),
  );
  if (!settings) throw new Error("Store settings are missing. Run `npm run seed`.");
  return settings;
}

export interface AuditLogFilter extends PageRequest {
  action?: string;
  actorUid?: string;
  target?: { type: string; id: string };
}

/** Newest first, filtered by at most one dimension (each has its own index). */
export async function listAuditLogs({
  action,
  actorUid,
  target,
  ...page
}: AuditLogFilter): Promise<Page<AuditLog>> {
  let base: FirebaseFirestore.Query = db().collection("auditLogs");
  if (action) base = base.where("action", "==", action);
  else if (actorUid) base = base.where("actor.uid", "==", actorUid);
  else if (target)
    base = base.where("target.type", "==", target.type).where("target.id", "==", target.id);
  return paginate(base, [{ field: "at", direction: "desc" }], page, (s) =>
    parseSnapshot(auditLogSchema, s),
  );
}
