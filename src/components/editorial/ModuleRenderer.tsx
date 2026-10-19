import { Suspense, type ReactNode } from "react";
import { getSession } from "@/lib/auth/session";
import type { CmsModule } from "@/lib/cms/modules";
import { getUserProfile } from "@/lib/data/admin-records";
import { CategoryTiles, PromoStrip, SplitFeature, StoryBlock } from "./EditorialBlocks";
import { HeroBanner } from "./HeroBanner";
import { LookbookGrid, ShopTheLook } from "./Lookbook";
import { ProductCarousel } from "./ProductCarousel";

function renderModule(module: CmsModule, index: number): ReactNode {
  switch (module.type) {
    case "hero":
      return <HeroBanner {...module.data} priority={index === 0} />;
    case "promoStrip":
      return <PromoStrip {...module.data} />;
    case "categoryTiles":
      return <CategoryTiles {...module.data} />;
    case "productCarousel":
      return <ProductCarousel {...module.data} />;
    case "splitFeature":
      return <SplitFeature {...module.data} />;
    case "storyBlock":
      return <StoryBlock {...module.data} />;
    case "lookbookGrid":
      return <LookbookGrid {...module.data} />;
    case "shopTheLook":
      return <ShopTheLook {...module.data} />;
  }
}

const PUBLIC = new Set(["everyone", "guest"]);

/**
 * Shows member- or tier-targeted modules only to matching visitors. Reads the
 * session, so it streams in behind Suspense and never blocks the static shell.
 */
async function AudienceGate({
  audience,
  children,
}: {
  audience: readonly string[];
  children: ReactNode;
}) {
  const session = await getSession();
  if (!session || session.role === "guest") return null;
  if (audience.includes("member")) return children;
  const tier = (await getUserProfile(session.uid))?.loyalty?.tier;
  return tier && audience.includes(tier) ? children : null;
}

/** Renders a CMS page's modules in order. */
export function ModuleRenderer({ modules }: { modules: readonly CmsModule[] }) {
  return (
    <>
      {modules.map((module, index) => {
        const content = renderModule(module, index);
        if (module.audience.some((a) => PUBLIC.has(a))) return <div key={module.id}>{content}</div>;
        return (
          <Suspense key={module.id} fallback={null}>
            <AudienceGate audience={module.audience}>{content}</AudienceGate>
          </Suspense>
        );
      })}
    </>
  );
}
