import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { parseSnapshot } from "@/lib/data/firestore";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { cmsPageSchema, isModuleLive, type CmsPage } from "./modules";

/**
 * A live CMS page with its currently scheduled modules. Cached for minutes so
 * schedule windows open and close on time without a deploy.
 */
export async function getLivePage(slug: string): Promise<CmsPage | null> {
  "use cache";
  cacheTag("pages", `page:${slug}`);
  cacheLife("minutes");

  const page = parseSnapshot(
    cmsPageSchema,
    await getFirebaseAdmin().db.collection("pages").doc(slug).get(),
  );
  if (!page || page.status !== "live") return null;
  const now = Date.now();
  return { ...page, modules: page.modules.filter((m) => isModuleLive(m, now)) };
}
