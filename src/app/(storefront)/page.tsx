import type { Metadata } from "next";
import { ErrorState } from "@/components/feedback/ErrorState";
import { ModuleRenderer } from "@/components/editorial/ModuleRenderer";
import { ButtonLink } from "@/components/primitives";
import { brand } from "@/config/brand";
import { getLivePage } from "@/lib/cms/pages";

/** Title and description for the home page, from its CMS record. */
export async function generateMetadata(): Promise<Metadata> {
  const page = await getLivePage("home");
  return {
    title: { absolute: page?.seo.title ?? brand.name },
    description: page?.seo.description ?? brand.description,
    alternates: { canonical: "/" },
  };
}

/** Home page assembled from CMS modules. */
export default async function HomePage() {
  const page = await getLivePage("home");
  if (!page || page.modules.length === 0) {
    return (
      <ErrorState
        layout="page"
        title={brand.name}
        description={brand.tagline}
        actions={
          <>
            <ButtonLink href="/women">Shop women</ButtonLink>
            <ButtonLink href="/men" variant="secondary">
              Shop men
            </ButtonLink>
          </>
        }
      />
    );
  }
  return <ModuleRenderer modules={page.modules} />;
}
