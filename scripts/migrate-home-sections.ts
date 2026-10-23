/**
 * One-off: adds the new home page sections to the live home page, in place:
 * the "Dress Code: Evening" campaign diptych, "The essentials, for her and
 * him" tiles and the "Most Wanted" gift shop diptych; switches "Shop by
 * category" to the editorial style, gives "New arrivals" its subheading and
 * the home hero its video.
 * Only adds what is missing, so it is safe to run again. Edit the sections
 * afterwards in /admin/content/home.
 *
 *   npm run migrate:home            shows the changes (no writes)
 *   npm run migrate:home -- --apply writes them
 */
import { loadEnvConfig } from "@next/env";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { buildStarterPages } from "./store/pages";

/** New module id → the id it follows on the page. */
const INSERTS: Record<string, string> = {
  "home-campaign": "home-tiles",
  "home-essentials": "home-new",
  "home-gifts": "home-best",
};

type Module = { id: string; type: string; data: Record<string, unknown> };

async function main() {
  loadEnvConfig(process.cwd());
  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!encoded) throw new Error("FIREBASE_SERVICE_ACCOUNT is not set in .env.local");
  const account = JSON.parse(Buffer.from(encoded, "base64").toString("utf8")) as {
    project_id: string;
    client_email: string;
    private_key: string;
  };
  initializeApp({
    credential: cert({
      projectId: account.project_id,
      clientEmail: account.client_email,
      privateKey: account.private_key,
    }),
    projectId: account.project_id,
  });
  const apply = process.argv.includes("--apply");
  console.log(`Project: ${account.project_id}${apply ? "" : " (dry run)"}`);

  const starter = buildStarterPages(new Date()).find((p) => p.slug === "home");
  if (!starter) throw new Error("No starter home page");
  const ref = getFirestore().collection("pages").doc("home");
  const live = (await ref.get()).data();
  if (!live) throw new Error("pages/home doesn't exist. Run `npm run bootstrap` first.");
  const modules = [...(live.modules as Module[])];
  const changes: string[] = [];

  for (const [id, after] of Object.entries(INSERTS)) {
    if (modules.some((m) => m.id === id)) continue;
    const added = starter.modules.find((m) => m.id === id);
    if (!added) throw new Error(`Starter module ${id} is missing`);
    const at = modules.findIndex((m) => m.id === after);
    modules.splice(at === -1 ? modules.length : at + 1, 0, added as unknown as Module);
    changes.push(`add ${added.type} "${id}" after "${after}"`);
  }
  const tiles = modules.find((m) => m.id === "home-tiles");
  if (tiles && tiles.data.variant !== "editorial") {
    tiles.data = { ...tiles.data, variant: "editorial" };
    changes.push(`"home-tiles" → editorial style`);
  }
  const fresh = modules.find((m) => m.id === "home-new");
  const starterNew = starter.modules.find((m) => m.id === "home-new");
  const subheading =
    starterNew?.type === "productCarousel" ? starterNew.data.subheading : undefined;
  if (fresh && !fresh.data.subheading && subheading) {
    fresh.data = { ...fresh.data, subheading };
    changes.push(`"home-new" subheading → "${subheading}"`);
  }
  const hero = modules.find((m) => m.id === "home-hero");
  const starterHero = starter.modules.find((m) => m.id === "home-hero");
  const video = starterHero?.type === "hero" ? starterHero.data.video : undefined;
  if (hero && video && JSON.stringify(hero.data.video) !== JSON.stringify(video)) {
    hero.data = { ...hero.data, video };
    changes.push(`"home-hero" video → ${video.desktop.webm}`);
  }

  if (changes.length === 0) {
    console.log("Nothing to change.");
    return;
  }
  for (const change of changes) console.log(`  ${change}`);
  console.log(`New order: ${modules.map((m) => m.id).join(" → ")}`);
  if (!apply) {
    console.log("\nDry run: nothing written. Add -- --apply to write.");
    return;
  }
  await ref.update({ modules, updatedAt: new Date() });
  console.log("\n✓ Home page updated. It shows on the storefront within a minute.");
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
