import "server-only";
import type { UserRecord } from "firebase-admin/auth";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import type { Role } from "./rbac";

/** A complete `users/{uid}` profile for an Auth user who doesn't have one yet. */
export function newProfile(record: UserRecord, now: Date, role: Role = "customer") {
  const [firstName = "", ...rest] = (record.displayName ?? "").split(" ");
  return {
    uid: record.uid,
    email: record.email ?? "",
    firstName,
    lastName: rest.join(" "),
    role,
    preferences: { marketingEmail: false, marketingSms: false },
    savedSizes: {},
    disabled: false,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Mirrors a role (and vendorId) onto the profile. Creates the full profile
 * when it doesn't exist yet, so a role change never leaves a partial document
 * that fails its schema (e.g. a merchant registering before their first sign-in).
 */
export async function writeRoleToProfile(
  record: UserRecord,
  role: Role,
  vendorId: string | null,
  now: Date = new Date(),
): Promise<void> {
  const { db } = getFirebaseAdmin();
  const ref = db.collection("users").doc(record.uid);
  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    const roleFields = { role, ...(vendorId ? { vendorId } : {}), updatedAt: now };
    if (snapshot.exists) tx.update(ref, roleFields);
    else tx.create(ref, { ...newProfile(record, now, role), ...roleFields });
  });
}
