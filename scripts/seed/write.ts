import type { Auth } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";
import type { SeedData } from "./generate";

function withoutKey<T extends object>(doc: T, key: keyof T): Record<string, unknown> {
  const { [key]: _omit, ...rest } = doc;
  return rest;
}

/** Writes generated seed data. Shared by `npm run seed` and the integration tests. */
export async function writeSeed(db: Firestore, auth: Auth, data: SeedData): Promise<void> {
  for (const user of data.authUsers) {
    await auth.createUser({
      uid: user.uid,
      email: user.email,
      password: user.password,
      displayName: user.displayName,
      emailVerified: true,
    });
    if (Object.keys(user.claims).length > 0) await auth.setCustomUserClaims(user.uid, user.claims);
  }

  const writer = db.bulkWriter();
  const failures: string[] = [];
  writer.onWriteError((error) => {
    failures.push(`${error.documentRef.path}: ${error.message}`);
    return false;
  });
  const write = (path: string, doc: Record<string, unknown>) => {
    void writer.set(db.doc(path), doc);
  };

  for (const c of data.categories) write(`categories/${c.id}`, withoutKey(c, "id"));
  for (const p of data.products) write(`products/${p.id}`, withoutKey(p, "id"));
  for (const v of data.variants) write(`variants/${v.sku}`, withoutKey(v, "sku"));
  for (const s of data.stores) write(`stores/${s.id}`, withoutKey(s, "id"));
  for (const r of data.reviews) write(`reviews/${r.id}`, withoutKey(r, "id"));
  for (const u of data.profiles) write(`users/${u.uid}`, withoutKey(u, "uid"));
  for (const p of data.promotions) write(`promotions/${p.id}`, withoutKey(p, "id"));
  for (const c of data.promoCodes) write(`promoCodes/${c.code}`, withoutKey(c, "code"));
  for (const g of data.giftCards) write(`giftCards/${g.id}`, withoutKey(g, "id"));
  for (const c of data.collections) write(`collections/${c.id}`, withoutKey(c, "id"));
  for (const page of data.pages) write(`pages/${page.slug}`, withoutKey(page, "id"));
  write("settings/store", data.settings);

  await writer.close();
  if (failures.length > 0) {
    throw new Error(`Seed writes failed:\n${failures.slice(0, 10).join("\n")}`);
  }
}

export async function clearEmulators(projectId: string, firestoreHost: string, authHost: string) {
  const responses = await Promise.all([
    fetch(
      `http://${firestoreHost}/emulator/v1/projects/${projectId}/databases/(default)/documents`,
      {
        method: "DELETE",
      },
    ),
    fetch(`http://${authHost}/emulator/v1/projects/${projectId}/accounts`, { method: "DELETE" }),
  ]);
  for (const r of responses) {
    if (!r.ok)
      throw new Error(`Could not clear emulator data (${r.status}). Are the emulators running?`);
  }
}
