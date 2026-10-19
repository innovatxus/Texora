import "server-only";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import {
  categorySchema,
  collectionSchema,
  storeSchema,
  type Category,
  type Collection,
  type Department,
  type Store,
} from "@/lib/validation";
import { parseSnapshot } from "./firestore";

const db = () => getFirebaseAdmin().db;

export async function listLiveCategories(department: Department): Promise<Category[]> {
  const snapshot = await db()
    .collection("categories")
    .where("department", "==", department)
    .where("status", "==", "live")
    .orderBy("sortOrder", "asc")
    .get();
  return snapshot.docs
    .map((s) => parseSnapshot(categorySchema, s))
    .filter((c): c is Category => c !== null);
}

export async function getLiveCategoryByPath(path: readonly string[]): Promise<Category | null> {
  const leaf = path.at(-1);
  if (!leaf) return null;
  const snapshot = await db()
    .collection("categories")
    .where("slug", "==", leaf)
    .where("status", "==", "live")
    .get();
  const match = snapshot.docs
    .map((s) => parseSnapshot(categorySchema, s))
    .find(
      (c) =>
        c !== null && c.path.length === path.length && c.path.every((slug, i) => slug === path[i]),
    );
  return match ?? null;
}

export async function getLiveCollectionBySlug(slug: string): Promise<Collection | null> {
  const snapshot = await db()
    .collection("collections")
    .where("slug", "==", slug)
    .where("status", "==", "live")
    .limit(1)
    .get();
  const doc = snapshot.docs[0];
  return doc ? parseSnapshot(collectionSchema, doc) : null;
}

export async function listStores(): Promise<Store[]> {
  const snapshot = await db().collection("stores").orderBy("name", "asc").get();
  return snapshot.docs
    .map((s) => parseSnapshot(storeSchema, s))
    .filter((s): s is Store => s !== null);
}

export async function getStore(id: string): Promise<Store | null> {
  return parseSnapshot(storeSchema, await db().collection("stores").doc(id).get());
}
