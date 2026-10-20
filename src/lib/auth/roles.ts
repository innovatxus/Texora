import "server-only";
import { writeAuditLog } from "@/lib/audit/log";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { canAssignRole, canSystemGrant, isRole, type Role } from "./rbac";
import type { Session } from "./session";

/** Thrown when a role change is refused, with the reason. */
export class RoleAssignmentError extends Error {
  constructor(
    public readonly reason: string,
    message: string,
  ) {
    super(message);
    this.name = "RoleAssignmentError";
  }
}

const REASON_MESSAGES: Record<string, string> = {
  no_permission: "You can't assign roles",
  self_change: "You can't change your own role",
  protected_target: "Only a super admin can change a super admin",
  protected_role: "Only a super admin can grant super admin",
  invalid_role: "That role can't be assigned",
  not_found: "User not found",
};

/**
 * Assigns a role: checks the policy, sets the custom claim, mirrors it on the
 * profile, revokes existing sessions so the new role applies immediately, and
 * writes an audit record.
 */
export async function assignRole(
  actor: Session,
  targetUid: string,
  nextRole: Role,
  options: { vendorId?: string } = {},
): Promise<void> {
  const { auth, db } = getFirebaseAdmin();

  let target;
  try {
    target = await auth.getUser(targetUid);
  } catch {
    throw new RoleAssignmentError("not_found", REASON_MESSAGES.not_found ?? "User not found");
  }

  const currentClaim = target.customClaims?.role;
  const targetCurrentRole: Role = isRole(currentClaim) ? currentClaim : "customer";

  const decision = canAssignRole({
    actorUid: actor.uid,
    actorRole: actor.role,
    targetUid,
    targetCurrentRole,
    nextRole,
  });
  if (!decision.allowed) {
    throw new RoleAssignmentError(
      decision.reason,
      REASON_MESSAGES[decision.reason] ?? decision.reason,
    );
  }

  const claims: Record<string, unknown> = { role: nextRole };
  if (nextRole === "vendor") {
    if (!options.vendorId)
      throw new RoleAssignmentError("invalid_role", "Vendors need a vendor id");
    claims.vendorId = options.vendorId;
  }

  await auth.setCustomUserClaims(targetUid, claims);
  await db
    .collection("users")
    .doc(targetUid)
    .set(
      {
        role: nextRole,
        ...(claims.vendorId ? { vendorId: claims.vendorId } : {}),
        updatedAt: new Date(),
      },
      { merge: true },
    );
  await auth.revokeRefreshTokens(targetUid);

  await writeAuditLog({
    actor,
    action: "users.assign_role",
    target: { type: "user", id: targetUid },
    before: { role: targetCurrentRole },
    after: { role: nextRole, ...(claims.vendorId ? { vendorId: claims.vendorId } : {}) },
  });
}

/**
 * Makes a shopper a merchant when they register a shop (D-061). There is no
 * admin actor, so the policy is `canSystemGrant`: only customer or rewards
 * member → vendor. Sets the claims, mirrors them on the profile, revokes old
 * sessions (the caller mints a fresh one) and audits the change as the user's own.
 */
export async function grantMerchantRole(targetUid: string, vendorId: string): Promise<void> {
  const { auth, db } = getFirebaseAdmin();
  const target = await auth.getUser(targetUid);
  const currentClaim = target.customClaims?.role;
  const currentRole: Role = isRole(currentClaim) ? currentClaim : "customer";

  if (currentRole === "vendor" && target.customClaims?.vendorId === vendorId) return;
  if (!canSystemGrant(currentRole, "vendor")) {
    throw new RoleAssignmentError("protected_target", "This account can't become a merchant");
  }

  await auth.setCustomUserClaims(targetUid, { role: "vendor", vendorId });
  await db
    .collection("users")
    .doc(targetUid)
    .set({ role: "vendor", vendorId, updatedAt: new Date() }, { merge: true });
  await auth.revokeRefreshTokens(targetUid);

  await writeAuditLog({
    actor: { uid: targetUid, role: currentRole, email: target.email ?? null },
    action: "merchants.register",
    target: { type: "user", id: targetUid },
    before: { role: currentRole },
    after: { role: "vendor", vendorId },
  });
}
