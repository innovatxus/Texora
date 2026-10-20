import "server-only";
import { randomBytes } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { createElement } from "react";
import { brand } from "@/config/brand";
import { ActionError } from "@/lib/actions/run-action";
import { writeAuditLog } from "@/lib/audit/log";
import { isStaffRole, ROLE_LABELS, type Role } from "@/lib/auth/rbac";
import { assignRole, RoleAssignmentError } from "@/lib/auth/roles";
import type { Session } from "@/lib/auth/session";
import { getStoreSettings } from "@/lib/data/admin-records";
import { parseSnapshot } from "@/lib/data/firestore";
import { sendEmail } from "@/lib/email/send";
import { StaffInviteEmail } from "@/lib/email/templates/StaffInvite";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { applyLoyaltyChange } from "@/lib/loyalty/tiers";
import { userSchema, type User } from "@/lib/validation";

const db = () => getFirebaseAdmin().db;

/** Users matching an email (exact) or name fragment; staff, customers or both. */
export async function searchUsers(filter: {
  q?: string | undefined;
  staff?: boolean;
}): Promise<User[]> {
  const q = filter.q?.trim().toLowerCase();
  if (q && q.includes("@")) {
    const snap = await db().collection("users").where("email", "==", q).limit(10).get();
    return snap.docs.map((d) => parseSnapshot(userSchema, d, "uid")).filter((u): u is User => !!u);
  }
  const snap = await db().collection("users").limit(500).get();
  return snap.docs
    .map((d) => parseSnapshot(userSchema, d, "uid"))
    .filter((u): u is User => u !== null)
    .filter((u) => (filter.staff === undefined ? true : isStaffRole(u.role) === filter.staff))
    .filter(
      (u) => !q || `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) || u.email.includes(q),
    )
    .sort((a, b) => a.email.localeCompare(b.email));
}

/** Internal notes on a customer, newest first. */
export async function listCustomerNotes(uid: string) {
  const snap = await db()
    .collection("users")
    .doc(uid)
    .collection("staffNotes")
    .orderBy("at", "desc")
    .limit(50)
    .get();
  return snap.docs.map((d) => ({
    id: d.id,
    text: String(d.get("text")),
    byRole: d.get("by.role") as Role,
    at: (d.get("at") as FirebaseFirestore.Timestamp).toDate(),
  }));
}

/** Points history for a member, newest first. */
export async function listLoyaltyLedger(uid: string) {
  const snap = await db()
    .collection("users")
    .doc(uid)
    .collection("loyaltyLedger")
    .orderBy("at", "desc")
    .limit(30)
    .get();
  return snap.docs.map((d) => ({
    id: d.id,
    type: String(d.get("type")),
    points: Number(d.get("points")),
    balance: Number(d.get("balance")),
    reason: (d.get("reason") as string | undefined) ?? (d.get("orderNumber") as string | undefined),
    at: (d.get("at") as FirebaseFirestore.Timestamp).toDate(),
  }));
}

/** Adds an internal note to a customer (never shown to them). */
export async function addCustomerNote(actor: Session, uid: string, text: string): Promise<void> {
  const user = db().collection("users").doc(uid);
  if (!(await user.get()).exists) throw new ActionError("not_found", "Customer not found");
  await user
    .collection("staffNotes")
    .add({ text, by: { uid: actor.uid, role: actor.role }, at: new Date() });
  await writeAuditLog({
    actor,
    action: "customers.add_note",
    target: { type: "user", id: uid },
    after: { text },
  });
}

/** Goodwill or correction points for a member, with a reason, never below zero. */
export async function adjustLoyalty(
  actor: Session,
  uid: string,
  points: number,
  reason: string,
): Promise<number> {
  const settings = await getStoreSettings();
  const ref = db().collection("users").doc(uid);
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const loyalty = snap.get("loyalty") as { points: number; periodSpend: number } | undefined;
    if (!loyalty) throw new ActionError("conflict", "This customer isn't a rewards member");
    if (loyalty.points + points < 0) {
      throw new ActionError("conflict", `They only have ${loyalty.points} points`);
    }
    const next = applyLoyaltyChange(loyalty, { points, spend: 0 }, settings.loyalty.tierThresholds);
    const now = new Date();
    tx.update(ref, { "loyalty.points": next.points, updatedAt: now });
    tx.create(ref.collection("loyaltyLedger").doc(), {
      type: "adjustment",
      points,
      reason,
      balance: next.points,
      by: { uid: actor.uid, role: actor.role },
      at: now,
    });
    await writeAuditLog(
      {
        actor,
        action: "loyalty.adjust",
        target: { type: "user", id: uid },
        before: { points: loyalty.points },
        after: { points: next.points, change: points, reason },
      },
      tx,
    );
    return next.points;
  });
}

/**
 * Invites a staff member: creates the account (or reuses an existing
 * customer account), assigns the role through the role policy and emails a
 * set-password link.
 */
export async function inviteStaff(
  actor: Session,
  input: { email: string; firstName: string; lastName: string; role: Role },
): Promise<{ uid: string; created: boolean }> {
  if (!isStaffRole(input.role)) throw new ActionError("conflict", "Choose a staff role");
  const { auth } = getFirebaseAdmin();
  let uid: string;
  let created = false;
  try {
    uid = (await auth.getUserByEmail(input.email)).uid;
  } catch {
    const user = await auth.createUser({
      email: input.email,
      // Never used: the invitee sets their own password from the email link.
      password: randomBytes(24).toString("base64url"),
      displayName: `${input.firstName} ${input.lastName}`,
      emailVerified: false,
    });
    uid = user.uid;
    created = true;
    const now = new Date();
    await db()
      .collection("users")
      .doc(uid)
      .set({
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        role: "customer",
        preferences: { marketingEmail: false, marketingSms: false },
        savedSizes: {},
        disabled: false,
        createdAt: now,
        updatedAt: now,
      });
  }
  try {
    await assignRole(actor, uid, input.role);
  } catch (error) {
    if (created) {
      await auth.deleteUser(uid);
      await db().collection("users").doc(uid).delete();
    }
    if (error instanceof RoleAssignmentError) throw new ActionError("forbidden", error.message);
    throw error;
  }
  const link = await auth.generatePasswordResetLink(input.email);
  await sendEmail({
    to: input.email,
    subject: `Your ${brand.name} back office invitation`,
    kind: "staff_invite",
    ref: uid,
    template: createElement(StaffInviteEmail, {
      brandName: brand.name,
      name: input.firstName,
      role: ROLE_LABELS[input.role],
      link,
    }),
  });
  await writeAuditLog({
    actor,
    action: "users.invite",
    target: { type: "user", id: uid },
    after: { email: input.email, role: input.role, created },
  });
  return { uid, created };
}

/** Changes a user's role through the role policy (no self-change, super admin protected). */
export async function changeRole(actor: Session, uid: string, role: Role): Promise<void> {
  try {
    await assignRole(actor, uid, role);
  } catch (error) {
    if (error instanceof RoleAssignmentError) throw new ActionError("forbidden", error.message);
    throw error;
  }
}

/** Signs a user out everywhere; their next request needs a fresh sign-in. */
export async function revokeSessions(actor: Session, uid: string): Promise<void> {
  if (uid === actor.uid) throw new ActionError("conflict", "Use Sign out to end your own sessions");
  await getFirebaseAdmin().auth.revokeRefreshTokens(uid);
  await db()
    .collection("users")
    .doc(uid)
    .update({ sessionsRevokedAt: FieldValue.serverTimestamp() });
  await writeAuditLog({
    actor,
    action: "users.revoke_sessions",
    target: { type: "user", id: uid },
  });
}
