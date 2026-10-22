import { beforeEach, describe, expect, it, vi } from "vitest";

// A minimal in-memory cookie jar standing in for next/headers in a request.
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  }),
  headers: async () =>
    new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1", "user-agent": "vitest" }),
}));

const { listAuditLogs, getUserProfile } = await import("@/lib/data/admin-records");
const { assignRole, RoleAssignmentError } = await import("@/lib/auth/roles");
const { createSession, getSession, SESSION_COOKIE, verifySessionCookie } =
  await import("@/lib/auth/session");
const { requirePermission, AuthorizationError } = await import("@/lib/auth/guard");
const { getFirebaseAdmin } = await import("@/lib/firebase/admin");
const { SEED_PASSWORD } = await import("../fixtures/seed/generate");

/** Signs in against the Auth emulator's REST API and returns a fresh ID token. */
async function signIn(email: string, password = SEED_PASSWORD): Promise<string> {
  const host = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const response = await fetch(
    `http://${host}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const body = (await response.json()) as { idToken?: string; error?: { message: string } };
  if (!body.idToken) throw new Error(`Sign-in failed: ${body.error?.message}`);
  return body.idToken;
}

const session = (uid: string, role: "admin" | "super_admin" | "customer_service") => ({
  uid,
  role,
  email: `${role}@texora.test`,
  vendorId: null,
});

beforeEach(() => jar.clear());

describe("sessions", () => {
  it("mints an HTTP-only session cookie that carries the role claim", async () => {
    const result = await createSession(await signIn("merchandiser@texora.test"));
    expect(result).toMatchObject({ uid: "seed-merchandiser", role: "merchandiser" });

    const cookie = jar.get(SESSION_COOKIE);
    expect(cookie).toBeTruthy();
    expect(await verifySessionCookie(cookie ?? "", { checkRevoked: true })).toMatchObject({
      role: "merchandiser",
    });
    expect(await getSession()).toMatchObject({ uid: "seed-merchandiser" });
  });

  it("creates a customer profile on first sign-in", async () => {
    const { auth } = getFirebaseAdmin();
    await auth.createUser({
      uid: "it-new-user",
      email: "new@texora.test",
      password: SEED_PASSWORD,
      displayName: "Nia Park",
    });

    const result = await createSession(await signIn("new@texora.test"));
    expect(result.role).toBe("customer");
    expect(await getUserProfile("it-new-user")).toMatchObject({
      role: "customer",
      firstName: "Nia",
      lastName: "Park",
    });
  });

  it("rejects garbage tokens", async () => {
    await expect(createSession("not-a-token")).rejects.toMatchObject({ code: "invalid_token" });
  });

  it("enforces permissions in requirePermission", async () => {
    await createSession(await signIn("customer@texora.test"));
    await expect(requirePermission("account.manage")).resolves.toMatchObject({ role: "customer" });
    await expect(requirePermission("orders.refund")).rejects.toBeInstanceOf(AuthorizationError);

    jar.clear();
    await expect(requirePermission("account.manage")).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  it("rejects a revoked session on mutation checks", async () => {
    await createSession(await signIn("fulfillment@texora.test"));
    // Firebase compares revocation to auth_time at one-second precision, so a
    // revocation in the same second as sign-in would not apply.
    await new Promise((resolve) => setTimeout(resolve, 1100));
    await getFirebaseAdmin().auth.revokeRefreshTokens("seed-fulfillment");
    await expect(requirePermission("fulfillment.write")).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });
});

describe("role assignment", () => {
  it("assigns a role, updates claims and profile, and writes an audit record", async () => {
    await assignRole(session("seed-admin", "admin"), "seed-shopper-01", "customer_service");

    const { auth } = getFirebaseAdmin();
    expect((await auth.getUser("seed-shopper-01")).customClaims).toMatchObject({
      role: "customer_service",
    });
    expect((await getUserProfile("seed-shopper-01"))?.role).toBe("customer_service");

    const logs = await listAuditLogs({ action: "users.assign_role", limit: 10 });
    const entry = logs.items.find((l) => l.target.id === "seed-shopper-01");
    expect(entry).toMatchObject({
      actor: { uid: "seed-admin", role: "admin" },
      after: { role: "customer_service" },
      changes: ["role"],
      ip: "203.0.113.7",
      userAgent: "vitest",
    });
  });

  it("blocks an admin from granting super_admin", async () => {
    await expect(
      assignRole(session("seed-admin", "admin"), "seed-shopper-02", "super_admin"),
    ).rejects.toMatchObject({
      reason: "protected_role",
    });
  });

  it("blocks self-elevation", async () => {
    await expect(
      assignRole(session("seed-admin", "admin"), "seed-admin", "super_admin"),
    ).rejects.toBeInstanceOf(RoleAssignmentError);
  });

  it("blocks roles without users.assign_role", async () => {
    await expect(
      assignRole(session("seed-customer_service", "customer_service"), "seed-shopper-03", "admin"),
    ).rejects.toMatchObject({ reason: "no_permission" });
  });

  it("lets a super_admin grant super_admin", async () => {
    await assignRole(session("seed-super_admin", "super_admin"), "seed-shopper-04", "super_admin");
    expect((await getUserProfile("seed-shopper-04"))?.role).toBe("super_admin");
  });
});
