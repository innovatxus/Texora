// One-time setup for a live Firebase project:
// store settings, the category tree, starter CMS pages and the owner's admin
// account. Adds no demo customers, orders or products, never overwrites
// anything that already exists, and is safe to run again.
//
//   npm run bootstrap -- --project <firebase-project-id> --admin-email you@example.com --name "Ada Lovelace"
//
// Add --personas for one test account per role (a shopper, a rewards member and
// each staff role) at "+" aliases of the admin email, so their mail reaches you.
// Passwords are typed at a hidden prompt; they are never stored or printed.
import { createInterface, type Interface } from "node:readline";
import { Writable } from "node:stream";
import { parseArgs } from "node:util";
import { loadEnvConfig } from "@next/env";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth, type UserRecord } from "firebase-admin/auth";
import { getFirestore, type DocumentReference } from "firebase-admin/firestore";
import { passwordProblem } from "../src/lib/auth/password";
import type { Role } from "../src/lib/auth/rbac";
import { userSchema } from "../src/lib/validation/customer";
import { buildCategories, buildCollections, buildStoreSettings } from "./store/structure";
import { buildStarterPages } from "./store/pages";

loadEnvConfig(process.cwd());

const { values: args } = parseArgs({
  options: {
    project: { type: "string" },
    "admin-email": { type: "string" },
    personas: { type: "boolean", default: false },
    name: { type: "string" },
  },
});

function fail(message: string): never {
  console.error(`\n${message}\n`);
  process.exit(1);
}

const projectId = process.env.FIREBASE_PROJECT_ID ?? "";
const emulators = process.env.USE_FIREBASE_EMULATORS === "true";
if (!args.project) fail("Pass --project <firebase-project-id> to confirm which project to set up.");
if (args.project !== projectId) {
  fail(
    `--project ${args.project} doesn't match FIREBASE_PROJECT_ID (${projectId}) in your env file.`,
  );
}
const adminEmail = args["admin-email"]?.trim().toLowerCase();
if (!adminEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adminEmail)) {
  fail("Pass --admin-email you@example.com for the owner's admin account.");
}

function credential() {
  if (emulators) return {};
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) fail("FIREBASE_SERVICE_ACCOUNT is missing from your env file.");
  const account = JSON.parse(Buffer.from(raw, "base64").toString("utf8")) as {
    project_id: string;
    client_email: string;
    private_key: string;
  };
  if (account.project_id !== projectId) {
    fail(`The service account is for ${account.project_id}, not ${projectId}.`);
  }
  return {
    credential: cert({
      projectId: account.project_id,
      clientEmail: account.client_email,
      privateKey: account.private_key,
    }),
  };
}

const app = initializeApp({ projectId, ...credential() }, "bootstrap");
const auth = getAuth(app);
const db = getFirestore(app);

/** Creates a document only if it doesn't exist; returns whether it was created. */
async function createIfMissing(ref: DocumentReference, data: object): Promise<boolean> {
  try {
    await ref.create(data);
    return true;
  } catch (error) {
    if ((error as { code?: number }).code === 6) return false; // ALREADY_EXISTS
    throw error;
  }
}

function withoutId<T extends { id: string }>(doc: T): Omit<T, "id"> {
  const { id: _id, ...rest } = doc;
  return rest;
}

/**
 * One line reader for the whole run. Lines are queued, so typed and piped
 * input both reach the prompts in order; nothing typed is echoed.
 */
let prompter: Interface | null = null;
const queued: string[] = [];
const waiting: Array<(line: string) => void> = [];
function askHidden(question: string): Promise<string> {
  if (!prompter) {
    prompter = createInterface({
      input: process.stdin,
      output: new Writable({ write: (_chunk, _encoding, done) => done() }),
      terminal: process.stdin.isTTY,
    });
    prompter.on("line", (line) => {
      const next = waiting.shift();
      if (next) next(line);
      else queued.push(line);
    });
    prompter.on("close", () => {
      if (waiting.length > 0) fail("No password entered.");
    });
  }
  process.stdout.write(question);
  return new Promise((resolve) => {
    const take = (line: string) => {
      process.stdout.write("\n");
      resolve(line);
    };
    const line = queued.shift();
    if (line !== undefined) take(line);
    else waiting.push(take);
  });
}

/** Asks for a new password twice, checked against the app's password policy. */
async function askNewPassword(userInputs: string[]): Promise<string> {
  console.log("Use at least 12 characters; a short phrase is easiest to remember.");
  for (;;) {
    const password = await askHidden("Password: ");
    const problem = passwordProblem(password, userInputs);
    if (problem) {
      console.log(problem);
      continue;
    }
    if ((await askHidden("Confirm password: ")) === password) return password;
    console.log("The passwords don't match. Try again.");
  }
}

/** Test personas: one account per role, at "+" aliases of the admin email. */
const PERSONAS: ReadonlyArray<{ alias: string; role: Role; firstName: string; lastName: string }> =
  [
    { alias: "customer", role: "customer", firstName: "Casey", lastName: "Customer" },
    { alias: "member", role: "loyalty_member", firstName: "Morgan", lastName: "Member" },
    { alias: "service", role: "customer_service", firstName: "Sam", lastName: "Service" },
    { alias: "merch", role: "merchandiser", firstName: "Mira", lastName: "Merchandiser" },
    { alias: "pricing", role: "pricing_manager", firstName: "Priya", lastName: "Pricing" },
    { alias: "inventory", role: "inventory_manager", firstName: "Ivan", lastName: "Inventory" },
    { alias: "fulfilment", role: "fulfillment", firstName: "Fern", lastName: "Fulfilment" },
    { alias: "manager", role: "manager", firstName: "Maya", lastName: "Manager" },
    { alias: "admin", role: "admin", firstName: "Alex", lastName: "Admin" },
  ];

const aliasOf = (email: string, tag: string) => {
  const [local, domain] = email.split("@");
  return `${local}+${tag}@${domain}`;
};

/** Creates any missing personas with one shared password; existing ones are left alone. */
async function personas(ownerEmail: string, now: Date): Promise<string[]> {
  const missing = new Set<string>();
  for (const p of PERSONAS) {
    try {
      await auth.getUserByEmail(aliasOf(ownerEmail, p.alias));
    } catch (error) {
      if ((error as { code?: string }).code !== "auth/user-not-found") throw error;
      missing.add(p.alias);
    }
  }
  if (missing.size === 0) return PERSONAS.map((p) => `${aliasOf(ownerEmail, p.alias)} (kept)`);
  console.log(`\nCreating ${missing.size} test personas. Choose one password for all of them.`);
  const password = await askNewPassword([ownerEmail]);
  const lines: string[] = [];
  for (const p of PERSONAS) {
    const email = aliasOf(ownerEmail, p.alias);
    if (!missing.has(p.alias)) {
      lines.push(`${email} (kept)`);
      continue;
    }
    const user = await auth.createUser({
      email,
      password,
      displayName: `${p.firstName} ${p.lastName}`,
      emailVerified: true,
    });
    await auth.setCustomUserClaims(user.uid, { role: p.role });
    const profile = userSchema.parse({
      uid: user.uid,
      email,
      firstName: p.firstName,
      lastName: p.lastName,
      role: p.role,
      ...(p.role === "loyalty_member"
        ? { loyalty: { tier: "core", points: 0, periodSpend: 0, memberSince: now } }
        : {}),
      preferences: { marketingEmail: false, marketingSms: false },
      savedSizes: {},
      disabled: false,
      createdAt: now,
      updatedAt: now,
    });
    const { uid: _uid, ...data } = profile;
    await createIfMissing(db.collection("users").doc(user.uid), data);
    lines.push(`${email}: ${p.role}`);
  }
  return lines;
}

async function adminAccount(email: string, now: Date): Promise<string> {
  const [firstName = "Store", ...rest] = (args.name?.trim() || "Store Owner").split(/\s+/);
  const lastName = rest.join(" ") || "Owner";
  let user: UserRecord;
  let created = false;
  try {
    user = await auth.getUserByEmail(email);
  } catch (error) {
    if ((error as { code?: string }).code !== "auth/user-not-found") throw error;
    console.log(`\nCreating the admin account ${email}.`);
    const password = await askNewPassword([email, firstName, lastName]);
    user = await auth.createUser({
      email,
      password,
      displayName: `${firstName} ${lastName}`,
      emailVerified: true,
    });
    created = true;
  }
  await auth.setCustomUserClaims(user.uid, { ...user.customClaims, role: "super_admin" });
  const profile = userSchema.parse({
    uid: user.uid,
    email,
    firstName,
    lastName,
    role: "super_admin",
    preferences: { marketingEmail: false, marketingSms: false },
    savedSizes: {},
    disabled: false,
    createdAt: now,
    updatedAt: now,
  });
  const ref = db.collection("users").doc(user.uid);
  const { uid: _uid, ...data } = profile;
  if (!(await createIfMissing(ref, data)))
    await ref.update({ role: "super_admin", updatedAt: now });
  return created ? "created" : "already existed; made super admin";
}

async function main() {
  const now = new Date();
  console.log(`Setting up ${projectId}${emulators ? " (emulators)" : ""}…`);

  const settings = await createIfMissing(
    db.collection("settings").doc("store"),
    buildStoreSettings(now),
  );

  let categories = 0;
  for (const c of buildCategories()) {
    if (await createIfMissing(db.collection("categories").doc(c.id), withoutId(c))) categories++;
  }

  let pages = 0;
  for (const p of buildStarterPages(now)) {
    if (await createIfMissing(db.collection("pages").doc(p.slug), withoutId(p))) pages++;
  }

  // Collections are linked from the menu and promotions; they start empty.
  let collections = 0;
  for (const c of buildCollections([])) {
    if (await createIfMissing(db.collection("collections").doc(c.id), withoutId(c))) collections++;
  }

  // Order numbers continue from here (the same starting point as the seed).
  await createIfMissing(db.collection("counters").doc("orders"), { value: 100000 });

  const admin = await adminAccount(adminEmail as string, now);
  const personaLines = args.personas ? await personas(adminEmail as string, now) : [];

  console.log(`
Done.
  Store settings: ${settings ? "created" : "already set (kept)"}
  Categories:     ${categories} created (existing ones kept)
  Pages:          ${pages} created (existing ones kept)
  Collections:    ${collections} created (existing ones kept)
  Admin:          ${adminEmail} ${admin}${
    personaLines.length ? `\n  Personas:\n    ${personaLines.join("\n    ")}` : ""
  }

Sign in at /auth/signin, then open /admin.`);
}

main()
  .then(() => {
    prompter?.close();
    process.exit(0);
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
