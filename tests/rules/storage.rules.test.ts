/**
 * Storage rules: merchants may only drop raw uploads into their own tmp
 * folder, with an allowed type and size; nothing is readable from the client
 * (processed media is served by the app, D-064).
 *
 * Run with `npm run test:rules` (starts the Firestore and Storage emulators).
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { deleteObject, getBytes, ref, uploadBytes, type FirebaseStorage } from "firebase/storage";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import type { Role } from "../../src/lib/auth/rbac";

const VENDOR_ID = "vendor-1";
const SHOP_ID = "shop-1";
/** Each test gets fresh object names, so no case sees another's files. */
interface Paths {
  uuid: string;
  tmp: string;
}

interface Persona {
  key: string;
  role: Role;
  uid: string | null;
  anonymous?: boolean;
  vendorId?: string;
}

const PERSONAS: Persona[] = [
  { key: "signed-out", role: "guest", uid: null },
  { key: "anonymous", role: "guest", uid: "anon", anonymous: true },
  { key: "customer", role: "customer", uid: "customer-uid" },
  { key: "admin", role: "admin", uid: "admin-uid" },
  { key: "super_admin", role: "super_admin", uid: "super-uid" },
  { key: "vendor-owner", role: "vendor", uid: "vendor-uid", vendorId: VENDOR_ID },
  { key: "vendor-other", role: "vendor", uid: "vendor-other-uid", vendorId: "vendor-2" },
];

const isOwner = (p: Persona) => p.vendorId === VENDOR_ID;
const never = () => false;

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const MB = 1024 * 1024;

interface Case {
  name: string;
  /** Objects written with rules disabled before the attempt. */
  fixtures?: (paths: Paths) => string[];
  attempt: (storage: FirebaseStorage, paths: Paths) => Promise<unknown>;
  expected: (p: Persona) => boolean;
}

const upload = (storage: FirebaseStorage, path: string, data: Uint8Array, contentType: string) =>
  uploadBytes(ref(storage, path), data, { contentType });

const CASES: Case[] = [
  {
    name: "upload a PNG to own tmp folder",
    attempt: (s, paths) => upload(s, paths.tmp, PNG, "image/png"),
    expected: isOwner,
  },
  {
    name: "upload an SVG logo to own tmp folder",
    attempt: (s, paths) =>
      upload(s, paths.tmp, new TextEncoder().encode("<svg/>"), "image/svg+xml"),
    expected: isOwner,
  },
  {
    name: "upload a video to own tmp folder",
    attempt: (s, paths) => upload(s, paths.tmp, PNG, "video/mp4"),
    expected: isOwner,
  },
  {
    name: "upload HTML disguised in the tmp folder",
    attempt: (s, paths) => upload(s, paths.tmp, new TextEncoder().encode("<script>"), "text/html"),
    expected: never,
  },
  {
    name: "upload an image over 15 MB",
    attempt: (s, paths) => upload(s, paths.tmp, new Uint8Array(15 * MB + 1), "image/jpeg"),
    expected: never,
  },
  {
    name: "upload an empty file",
    attempt: (s, paths) => upload(s, paths.tmp, new Uint8Array(0), "image/png"),
    expected: never,
  },
  {
    name: "upload with a name that isn't a UUID",
    attempt: (s) =>
      upload(s, `merchant-media/${VENDOR_ID}/${SHOP_ID}/tmp/../../logo.png`, PNG, "image/png"),
    expected: never,
  },
  {
    name: "upload straight to the permanent folder",
    attempt: (s, paths) =>
      upload(s, `merchant-media/${VENDOR_ID}/${SHOP_ID}/media/${paths.uuid}`, PNG, "image/png"),
    expected: never,
  },
  {
    name: "upload anywhere else in the bucket",
    attempt: (s, paths) => upload(s, `products/${paths.uuid}`, PNG, "image/png"),
    expected: never,
  },
  {
    name: "overwrite an existing upload",
    fixtures: ({ tmp }) => [tmp],
    attempt: (s, paths) => upload(s, paths.tmp, PNG, "image/png"),
    expected: never,
  },
  {
    name: "read an upload",
    fixtures: ({ tmp }) => [tmp],
    attempt: (s, paths) => getBytes(ref(s, paths.tmp)),
    expected: never,
  },
  {
    name: "read processed media",
    fixtures: ({ uuid }) => [`merchant-media/${VENDOR_ID}/${SHOP_ID}/media/${uuid}.webp`],
    attempt: (s, paths) =>
      getBytes(ref(s, `merchant-media/${VENDOR_ID}/${SHOP_ID}/media/${paths.uuid}.webp`)),
    expected: never,
  },
  {
    name: "cancel (delete) an upload",
    fixtures: ({ tmp }) => [tmp],
    attempt: (s, paths) => deleteObject(ref(s, paths.tmp)),
    expected: isOwner,
  },
];

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-texora-rules",
    storage: { rules: readFileSync("storage.rules", "utf8") },
  });
});

beforeEach(async () => {
  await env.clearStorage();
});

afterAll(async () => {
  await env?.cleanup();
});

function storageFor(persona: Persona): FirebaseStorage {
  if (persona.uid === null)
    return env.unauthenticatedContext().storage() as unknown as FirebaseStorage;
  const claims = persona.anonymous
    ? { firebase: { sign_in_provider: "anonymous" as const } }
    : {
        role: persona.role,
        ...(persona.vendorId ? { vendorId: persona.vendorId } : {}),
        firebase: { sign_in_provider: "password" as const },
      };
  return env.authenticatedContext(persona.uid, claims).storage() as unknown as FirebaseStorage;
}

describe("merchant media", () => {
  for (const testCase of CASES) {
    describe(testCase.name, () => {
      for (const persona of PERSONAS) {
        const allowed = testCase.expected(persona);
        it(`${allowed ? "allows" : "denies"} ${persona.key}`, async () => {
          const uuid = randomUUID();
          const paths: Paths = { uuid, tmp: `merchant-media/${VENDOR_ID}/${SHOP_ID}/tmp/${uuid}` };
          const fixtures = testCase.fixtures?.(paths) ?? [];
          if (fixtures.length > 0) {
            await env.withSecurityRulesDisabled(async (admin) => {
              const storage = admin.storage() as unknown as FirebaseStorage;
              for (const path of fixtures) await upload(storage, path, PNG, "image/png");
            });
          }
          const attempt = testCase.attempt(storageFor(persona), paths);
          await (allowed ? assertSucceeds(attempt) : assertFails(attempt));
        });
      }
    });
  }
});
