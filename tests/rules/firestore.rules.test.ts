/**
 * Firestore rules matrix: every case runs for every persona (signed out,
 * anonymous guest and each role). Expected outcomes are derived from
 * src/lib/auth/rbac.ts, so these tests prove the rules implement the RBAC
 * table rather than restating it.
 *
 * Run with `npm run test:rules` (starts the Firestore emulator).
 */
import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  type Firestore,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { hasPermission, ROLES, type Permission, type Role } from "../../src/lib/auth/rbac";

interface Persona {
  key: string;
  role: Role;
  uid: string | null;
  anonymous: boolean;
}

const PERSONAS: Persona[] = [
  { key: "signed-out", role: "guest", uid: null, anonymous: false },
  { key: "anonymous", role: "guest", uid: "anon-uid", anonymous: true },
  ...ROLES.filter((r) => r !== "guest").map((role) => ({
    key: role,
    role,
    uid: `${role}-uid`,
    anonymous: false,
  })),
];

const VENDOR_ID = "vendor-1";

const can = (p: Persona, permission: Permission) => hasPermission(p.role, permission);
/** A real (non-anonymous) signed-in account. */
const hasAccount = (p: Persona) => p.uid !== null && !p.anonymous;
const signedIn = (p: Persona) => p.uid !== null;
const never = () => false;
const always = () => true;

interface Ctx {
  db: Firestore;
  persona: Persona;
  /** Unique id for this case × persona, so fixtures never collide. */
  id: string;
  /** The persona's uid, or a placeholder for signed-out users. */
  uid: string;
}

interface Case {
  name: string;
  /** Documents written with rules disabled before the attempt. */
  fixtures?: (ctx: Ctx) => Array<[path: string, data: Record<string, unknown>]>;
  attempt: (ctx: Ctx) => Promise<unknown>;
  expected: (p: Persona) => boolean;
}

const now = new Date("2026-01-01T00:00:00Z");

const product = (extra: Record<string, unknown> = {}) => ({
  name: "Linen Shirt",
  status: "draft",
  priceRange: { min: 8900, max: 8900 },
  ...extra,
});

const variant = () => ({
  productId: "p1",
  price: 8900,
  stockByLocation: { online: 5 },
  availableOnline: true,
  barcode: "000",
  updatedAt: now,
});

const review = (userId: string, extra: Record<string, unknown> = {}) => ({
  productId: "p1",
  userId,
  displayName: "A.",
  rating: 5,
  title: "Great",
  body: "Fits well",
  photos: [],
  verifiedPurchase: false,
  helpfulCount: 0,
  status: "pending",
  createdAt: now,
  ...extra,
});

const CASES: Record<string, Case[]> = {
  products: [
    {
      name: "get live",
      fixtures: ({ id }) => [[`products/${id}`, product({ status: "live" })]],
      attempt: ({ db, id }) => getDoc(doc(db, "products", id)),
      expected: always,
    },
    {
      name: "get draft",
      fixtures: ({ id }) => [[`products/${id}`, product()]],
      attempt: ({ db, id }) => getDoc(doc(db, "products", id)),
      expected: (p) => can(p, "catalog.read_drafts"),
    },
    {
      name: "list live",
      attempt: ({ db }) =>
        getDocs(query(collection(db, "products"), where("status", "==", "live"))),
      expected: always,
    },
    {
      name: "create draft",
      attempt: ({ db, id }) => setDoc(doc(db, "products", id), product()),
      expected: (p) => can(p, "catalog.write"),
    },
    {
      name: "create live (publish)",
      attempt: ({ db, id }) => setDoc(doc(db, "products", id), product({ status: "live" })),
      expected: (p) => can(p, "catalog.write") && can(p, "catalog.publish"),
    },
    {
      name: "create own vendor draft",
      attempt: ({ db, id }) => setDoc(doc(db, "products", id), product({ vendorId: VENDOR_ID })),
      expected: (p) => can(p, "catalog.write") || p.role === "vendor",
    },
    {
      name: "update name",
      fixtures: ({ id }) => [[`products/${id}`, product()]],
      attempt: ({ db, id }) => updateDoc(doc(db, "products", id), { name: "Linen Camp Shirt" }),
      expected: (p) => can(p, "catalog.write"),
    },
    {
      name: "update display price",
      fixtures: ({ id }) => [[`products/${id}`, product()]],
      attempt: ({ db, id }) =>
        updateDoc(doc(db, "products", id), { priceRange: { min: 100, max: 100 } }),
      expected: (p) => can(p, "catalog.write") && can(p, "pricing.write"),
    },
    {
      name: "delete",
      fixtures: ({ id }) => [[`products/${id}`, product()]],
      attempt: ({ db, id }) => deleteDoc(doc(db, "products", id)),
      expected: (p) => can(p, "catalog.write"),
    },
  ],

  variants: [
    {
      name: "get",
      fixtures: ({ id }) => [[`variants/${id}`, variant()]],
      attempt: ({ db, id }) => getDoc(doc(db, "variants", id)),
      expected: always,
    },
    {
      name: "create",
      attempt: ({ db, id }) => setDoc(doc(db, "variants", id), variant()),
      expected: (p) => can(p, "catalog.write"),
    },
    {
      name: "update stock",
      fixtures: ({ id }) => [[`variants/${id}`, variant()]],
      attempt: ({ db, id }) =>
        updateDoc(doc(db, "variants", id), { stockByLocation: { online: 0 } }),
      expected: (p) => can(p, "inventory.write"),
    },
    {
      name: "update price",
      fixtures: ({ id }) => [[`variants/${id}`, variant()]],
      attempt: ({ db, id }) =>
        updateDoc(doc(db, "variants", id), { price: 6900, compareAtPrice: 8900 }),
      expected: (p) => can(p, "pricing.write"),
    },
    {
      name: "update barcode",
      fixtures: ({ id }) => [[`variants/${id}`, variant()]],
      attempt: ({ db, id }) => updateDoc(doc(db, "variants", id), { barcode: "123" }),
      expected: (p) => can(p, "catalog.write"),
    },
    {
      name: "update price and barcode together",
      fixtures: ({ id }) => [[`variants/${id}`, variant()]],
      attempt: ({ db, id }) => updateDoc(doc(db, "variants", id), { price: 1, barcode: "1" }),
      expected: never,
    },
    {
      name: "delete",
      fixtures: ({ id }) => [[`variants/${id}`, variant()]],
      attempt: ({ db, id }) => deleteDoc(doc(db, "variants", id)),
      expected: (p) => can(p, "catalog.write"),
    },
  ],

  priceChangeRequests: [
    {
      name: "create own pending",
      attempt: ({ db, id, uid }) =>
        setDoc(doc(db, "priceChangeRequests", id), {
          sku: "s",
          proposedPrice: 1,
          requestedBy: uid,
          status: "pending",
        }),
      expected: (p) => can(p, "catalog.write"),
    },
    {
      name: "approve",
      fixtures: ({ id }) => [
        [`priceChangeRequests/${id}`, { sku: "s", requestedBy: "x", status: "pending" }],
      ],
      attempt: ({ db, id, uid }) =>
        updateDoc(doc(db, "priceChangeRequests", id), {
          status: "approved",
          decidedBy: uid,
          decidedAt: now,
        }),
      expected: (p) => can(p, "pricing.approve"),
    },
    {
      name: "get",
      fixtures: ({ id }) => [
        [`priceChangeRequests/${id}`, { sku: "s", requestedBy: "x", status: "pending" }],
      ],
      attempt: ({ db, id }) => getDoc(doc(db, "priceChangeRequests", id)),
      expected: (p) => can(p, "catalog.write") || can(p, "pricing.approve"),
    },
  ],

  categories: [
    {
      name: "get live",
      fixtures: ({ id }) => [[`categories/${id}`, { status: "live" }]],
      attempt: ({ db, id }) => getDoc(doc(db, "categories", id)),
      expected: always,
    },
    {
      name: "get draft",
      fixtures: ({ id }) => [[`categories/${id}`, { status: "draft" }]],
      attempt: ({ db, id }) => getDoc(doc(db, "categories", id)),
      expected: (p) => can(p, "catalog.read_drafts"),
    },
    {
      name: "write",
      attempt: ({ db, id }) => setDoc(doc(db, "categories", id), { status: "draft" }),
      expected: (p) => can(p, "merch.write"),
    },
  ],

  collections: [
    {
      name: "get live",
      fixtures: ({ id }) => [[`collections/${id}`, { status: "live" }]],
      attempt: ({ db, id }) => getDoc(doc(db, "collections", id)),
      expected: always,
    },
    {
      name: "write",
      attempt: ({ db, id }) => setDoc(doc(db, "collections", id), { status: "draft" }),
      expected: (p) => can(p, "merch.write"),
    },
  ],

  pages: [
    {
      name: "get live",
      fixtures: ({ id }) => [[`pages/${id}`, { status: "live" }]],
      attempt: ({ db, id }) => getDoc(doc(db, "pages", id)),
      expected: always,
    },
    {
      name: "get draft",
      fixtures: ({ id }) => [[`pages/${id}`, { status: "draft" }]],
      attempt: ({ db, id }) => getDoc(doc(db, "pages", id)),
      expected: (p) => can(p, "content.write"),
    },
    {
      name: "write",
      attempt: ({ db, id }) => setDoc(doc(db, "pages", id), { status: "draft" }),
      expected: (p) => can(p, "content.write"),
    },
  ],

  stores: [
    {
      name: "get",
      fixtures: ({ id }) => [[`stores/${id}`, { name: "SoHo" }]],
      attempt: ({ db, id }) => getDoc(doc(db, "stores", id)),
      expected: always,
    },
    {
      name: "write",
      attempt: ({ db, id }) => setDoc(doc(db, "stores", id), { name: "SoHo" }),
      expected: (p) => can(p, "settings.write"),
    },
  ],

  reviews: [
    {
      name: "get approved",
      fixtures: ({ id }) => [[`reviews/${id}`, review("someone", { status: "approved" })]],
      attempt: ({ db, id }) => getDoc(doc(db, "reviews", id)),
      expected: always,
    },
    {
      name: "get own pending",
      fixtures: ({ id, uid }) => [[`reviews/${id}`, review(uid)]],
      attempt: ({ db, id }) => getDoc(doc(db, "reviews", id)),
      expected: (p) => hasAccount(p) || can(p, "reviews.moderate"),
    },
    {
      name: "get someone else's pending",
      fixtures: ({ id }) => [[`reviews/${id}`, review("someone")]],
      attempt: ({ db, id }) => getDoc(doc(db, "reviews", id)),
      expected: (p) => can(p, "reviews.moderate"),
    },
    {
      name: "create",
      attempt: ({ db, id, uid }) => setDoc(doc(db, "reviews", id), review(uid)),
      expected: (p) => can(p, "reviews.write"),
    },
    {
      name: "create claiming verified purchase",
      attempt: ({ db, id, uid }) =>
        setDoc(doc(db, "reviews", id), review(uid, { verifiedPurchase: true })),
      expected: never,
    },
    {
      name: "create as someone else",
      attempt: ({ db, id }) => setDoc(doc(db, "reviews", id), review("someone")),
      expected: never,
    },
    {
      name: "moderate",
      fixtures: ({ id }) => [[`reviews/${id}`, review("someone")]],
      attempt: ({ db, id, uid }) =>
        updateDoc(doc(db, "reviews", id), { status: "approved", moderatedBy: uid }),
      expected: (p) => can(p, "reviews.moderate"),
    },
    {
      name: "delete",
      fixtures: ({ id }) => [[`reviews/${id}`, review("someone")]],
      attempt: ({ db, id }) => deleteDoc(doc(db, "reviews", id)),
      expected: (p) => can(p, "reviews.moderate"),
    },
  ],

  users: [
    {
      name: "get own profile",
      fixtures: ({ uid }) => [[`users/${uid}`, { firstName: "A", role: "customer" }]],
      attempt: ({ db, uid }) => getDoc(doc(db, "users", uid)),
      expected: (p) => hasAccount(p) || can(p, "customers.read"),
    },
    {
      name: "get another profile",
      fixtures: ({ id }) => [[`users/${id}`, { firstName: "B", role: "customer" }]],
      attempt: ({ db, id }) => getDoc(doc(db, "users", id)),
      expected: (p) => can(p, "customers.read"),
    },
    {
      name: "list profiles",
      attempt: ({ db }) => getDocs(collection(db, "users")),
      expected: (p) => can(p, "customers.read"),
    },
    {
      name: "create own profile",
      attempt: ({ db, uid }) => setDoc(doc(db, "users", uid), { firstName: "A", role: "customer" }),
      expected: never,
    },
    {
      name: "update own name",
      fixtures: ({ uid }) => [[`users/${uid}`, { firstName: "A", role: "customer" }]],
      attempt: ({ db, uid }) => updateDoc(doc(db, "users", uid), { firstName: "Ana" }),
      expected: (p) => hasAccount(p) || can(p, "customers.write"),
    },
    {
      name: "update own role (self-elevation)",
      fixtures: ({ uid }) => [[`users/${uid}`, { firstName: "A", role: "customer" }]],
      attempt: ({ db, uid }) => updateDoc(doc(db, "users", uid), { role: "super_admin" }),
      expected: never,
    },
    {
      name: "update own loyalty points",
      fixtures: ({ uid }) => [
        [`users/${uid}`, { firstName: "A", role: "customer", loyalty: { points: 0 } }],
      ],
      attempt: ({ db, uid }) => updateDoc(doc(db, "users", uid), { "loyalty.points": 99999 }),
      expected: never,
    },
    {
      name: "update another's name",
      fixtures: ({ id }) => [[`users/${id}`, { firstName: "B", role: "customer" }]],
      attempt: ({ db, id }) => updateDoc(doc(db, "users", id), { firstName: "Bea" }),
      expected: (p) => can(p, "customers.write"),
    },
    {
      name: "delete own profile",
      fixtures: ({ uid }) => [[`users/${uid}`, { firstName: "A", role: "customer" }]],
      attempt: ({ db, uid }) => deleteDoc(doc(db, "users", uid)),
      expected: never,
    },
    {
      name: "write own address",
      attempt: ({ db, uid, id }) =>
        setDoc(doc(db, "users", uid, "addresses", id), { line1: "1 Main St" }),
      expected: hasAccount,
    },
    {
      name: "read another's address",
      fixtures: ({ id }) => [[`users/${id}/addresses/a1`, { line1: "1 Main St" }]],
      attempt: ({ db, id }) => getDoc(doc(db, "users", id, "addresses", "a1")),
      expected: (p) => can(p, "customers.read"),
    },
    {
      name: "write another's address",
      attempt: ({ db, id }) =>
        setDoc(doc(db, "users", id, "addresses", "a1"), { line1: "1 Main St" }),
      expected: never,
    },
    {
      name: "write own wishlist",
      attempt: ({ db, uid, id }) =>
        setDoc(doc(db, "users", uid, "wishlist", id), { productId: "p1" }),
      expected: hasAccount,
    },
    {
      name: "read own payment methods",
      fixtures: ({ uid }) => [[`users/${uid}/paymentMethods/pm1`, { last4: "4242" }]],
      attempt: ({ db, uid }) => getDoc(doc(db, "users", uid, "paymentMethods", "pm1")),
      expected: hasAccount,
    },
    {
      name: "write own payment method",
      attempt: ({ db, uid, id }) =>
        setDoc(doc(db, "users", uid, "paymentMethods", id), { last4: "4242" }),
      expected: never,
    },
  ],

  carts: [
    {
      name: "create own",
      attempt: ({ db, id, uid }) => setDoc(doc(db, "carts", id), { ownerUid: uid, lines: [] }),
      expected: signedIn,
    },
    {
      name: "get own",
      fixtures: ({ id, uid }) => [[`carts/${id}`, { ownerUid: uid, lines: [] }]],
      attempt: ({ db, id }) => getDoc(doc(db, "carts", id)),
      expected: signedIn,
    },
    {
      name: "get someone else's",
      fixtures: ({ id }) => [[`carts/${id}`, { ownerUid: "someone", lines: [] }]],
      attempt: ({ db, id }) => getDoc(doc(db, "carts", id)),
      expected: never,
    },
    {
      name: "hand own cart to someone else",
      fixtures: ({ id, uid }) => [[`carts/${id}`, { ownerUid: uid, lines: [] }]],
      attempt: ({ db, id }) => updateDoc(doc(db, "carts", id), { ownerUid: "someone" }),
      expected: never,
    },
  ],

  orders: [
    {
      name: "get own",
      fixtures: ({ id, uid }) => [[`orders/${id}`, { userId: uid, vendorIds: [] }]],
      attempt: ({ db, id }) => getDoc(doc(db, "orders", id)),
      expected: (p) => hasAccount(p) || can(p, "orders.read"),
    },
    {
      name: "get another's (with vendor lines)",
      fixtures: ({ id }) => [[`orders/${id}`, { userId: "someone", vendorIds: [VENDOR_ID] }]],
      attempt: ({ db, id }) => getDoc(doc(db, "orders", id)),
      expected: (p) => can(p, "orders.read") || p.role === "vendor",
    },
    {
      name: "create",
      attempt: ({ db, id, uid }) => setDoc(doc(db, "orders", id), { userId: uid, vendorIds: [] }),
      expected: never,
    },
  ],

  returns: [
    {
      name: "get own",
      fixtures: ({ id, uid }) => [[`returns/${id}`, { userId: uid }]],
      attempt: ({ db, id }) => getDoc(doc(db, "returns", id)),
      expected: (p) => hasAccount(p) || can(p, "returns.read"),
    },
    {
      name: "get another's",
      fixtures: ({ id }) => [[`returns/${id}`, { userId: "someone" }]],
      attempt: ({ db, id }) => getDoc(doc(db, "returns", id)),
      expected: (p) => can(p, "returns.read"),
    },
    {
      name: "create",
      attempt: ({ db, id, uid }) => setDoc(doc(db, "returns", id), { userId: uid }),
      expected: never,
    },
  ],

  inventoryReservations: [
    {
      name: "get",
      fixtures: ({ id }) => [[`inventoryReservations/${id}`, { sku: "s" }]],
      attempt: ({ db, id }) => getDoc(doc(db, "inventoryReservations", id)),
      expected: (p) => can(p, "inventory.read"),
    },
    {
      name: "create",
      attempt: ({ db, id }) => setDoc(doc(db, "inventoryReservations", id), { sku: "s" }),
      expected: never,
    },
  ],

  promotions: [
    {
      name: "get",
      fixtures: ({ id }) => [[`promotions/${id}`, { name: "Sale" }]],
      attempt: ({ db, id }) => getDoc(doc(db, "promotions", id)),
      expected: (p) => can(p, "promotions.write"),
    },
    {
      name: "write",
      attempt: ({ db, id }) => setDoc(doc(db, "promotions", id), { name: "Sale" }),
      expected: (p) => can(p, "promotions.write"),
    },
    {
      name: "read a promo code",
      fixtures: ({ id }) => [[`promoCodes/${id}`, { promotionId: "x" }]],
      attempt: ({ db, id }) => getDoc(doc(db, "promoCodes", id)),
      expected: (p) => can(p, "promotions.write"),
    },
  ],

  giftCards: [
    {
      name: "get",
      fixtures: ({ id }) => [[`giftCards/${id}`, { balance: 5000, initialBalance: 5000 }]],
      attempt: ({ db, id }) => getDoc(doc(db, "giftCards", id)),
      expected: (p) => can(p, "giftcards.issue") || can(p, "orders.read"),
    },
    {
      name: "issue",
      attempt: ({ db, id }) =>
        setDoc(doc(db, "giftCards", id), { balance: 5000, initialBalance: 5000 }),
      expected: (p) => can(p, "giftcards.issue"),
    },
    {
      name: "issue with a top-up balance",
      attempt: ({ db, id }) =>
        setDoc(doc(db, "giftCards", id), { balance: 9000, initialBalance: 5000 }),
      expected: never,
    },
    {
      name: "change balance",
      fixtures: ({ id }) => [[`giftCards/${id}`, { balance: 5000, initialBalance: 5000 }]],
      attempt: ({ db, id }) => updateDoc(doc(db, "giftCards", id), { balance: 99999 }),
      expected: never,
    },
  ],

  notifications: [
    {
      name: "subscribe for self",
      attempt: ({ db, id, uid }) =>
        setDoc(doc(db, "notifications", id), {
          userId: uid,
          productId: "p1",
          type: "back_in_stock",
        }),
      expected: hasAccount,
    },
    {
      name: "mark as sent",
      fixtures: ({ id, uid }) => [[`notifications/${id}`, { userId: uid, productId: "p1" }]],
      attempt: ({ db, id }) => updateDoc(doc(db, "notifications", id), { sentAt: now }),
      expected: never,
    },
  ],

  auditLogs: [
    {
      name: "get",
      fixtures: ({ id }) => [[`auditLogs/${id}`, { action: "orders.refund" }]],
      attempt: ({ db, id }) => getDoc(doc(db, "auditLogs", id)),
      expected: (p) => can(p, "audit.read"),
    },
    {
      name: "write",
      attempt: ({ db, id }) => setDoc(doc(db, "auditLogs", id), { action: "orders.refund" }),
      expected: never,
    },
    {
      name: "tamper",
      fixtures: ({ id }) => [[`auditLogs/${id}`, { action: "orders.refund" }]],
      attempt: ({ db, id }) => deleteDoc(doc(db, "auditLogs", id)),
      expected: never,
    },
  ],

  settings: [
    {
      name: "get",
      fixtures: () => [["settings/store", { currency: "USD" }]],
      attempt: ({ db }) => getDoc(doc(db, "settings", "store")),
      expected: (p) => can(p, "settings.read"),
    },
    {
      name: "update",
      fixtures: ({ id }) => [[`settings/${id}`, { currency: "USD" }]],
      attempt: ({ db, id }) => updateDoc(doc(db, "settings", id), { currency: "EUR" }),
      expected: (p) => can(p, "settings.write"),
    },
  ],

  unlisted: [
    {
      name: "any unknown collection",
      attempt: ({ db, id }) => setDoc(doc(db, "secrets", id), { x: 1 }),
      expected: never,
    },
  ],
};

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-texora-rules",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});

// Each case starts from an empty database so fixtures never leak between cases.
beforeEach(async () => {
  await env.clearFirestore();
});

afterAll(async () => {
  await env?.cleanup();
});

function contextFor(persona: Persona) {
  if (persona.uid === null) return env.unauthenticatedContext();
  if (persona.anonymous) {
    return env.authenticatedContext(persona.uid, { firebase: { sign_in_provider: "anonymous" } });
  }
  return env.authenticatedContext(persona.uid, {
    role: persona.role,
    ...(persona.role === "vendor" ? { vendorId: VENDOR_ID } : {}),
    firebase: { sign_in_provider: "password" },
  });
}

let counter = 0;

for (const [collectionName, cases] of Object.entries(CASES)) {
  describe(collectionName, () => {
    for (const testCase of cases) {
      describe(testCase.name, () => {
        for (const persona of PERSONAS) {
          const allowed = testCase.expected(persona);
          it(`${allowed ? "allows" : "denies"} ${persona.key}`, async () => {
            const id = `t${++counter}`;
            const db = contextFor(persona).firestore() as unknown as Firestore;
            const ctx: Ctx = { db, persona, id, uid: persona.uid ?? "signed-out" };

            const fixtures = testCase.fixtures?.(ctx) ?? [];
            if (fixtures.length > 0) {
              await env.withSecurityRulesDisabled(async (admin) => {
                const adminDb = admin.firestore() as unknown as Firestore;
                for (const [path, data] of fixtures) await setDoc(doc(adminDb, path), data);
              });
            }

            const attempt = testCase.attempt(ctx);
            await (allowed ? assertSucceeds(attempt) : assertFails(attempt));
          });
        }
      });
    }
  });
}

describe("role claim fallback", () => {
  it("treats a signed-in user without a role claim as a customer", async () => {
    const db = env
      .authenticatedContext("no-claim-uid", { firebase: { sign_in_provider: "password" } })
      .firestore() as unknown as Firestore;
    await assertSucceeds(
      setDoc(doc(db, "users", "no-claim-uid", "wishlist", "w1"), { productId: "p1" }),
    );
    await assertFails(getDocs(collection(db, "users")));
  });

  it("gives an unknown role claim no permissions, even over its own data", async () => {
    const db = env
      .authenticatedContext("forged-uid", {
        role: "owner",
        firebase: { sign_in_provider: "password" },
      })
      .firestore() as unknown as Firestore;
    await assertFails(
      setDoc(doc(db, "users", "forged-uid", "wishlist", "w1"), { productId: "p1" }),
    );
    await assertFails(setDoc(doc(db, "carts", "c1"), { ownerUid: "forged-uid", lines: [] }));
    await assertFails(setDoc(doc(db, "reviews", "r1"), review("forged-uid")));
  });
});
