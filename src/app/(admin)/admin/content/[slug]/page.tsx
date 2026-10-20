import type { Metadata } from "next";
import NextLink from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdminLoading } from "@/components/admin/AdminLoading";
import { PageEditor } from "@/components/admin/PageEditor";
import { AdminPageHeader } from "@/components/admin/ui";
import { ADDABLE_MODULES, getPage, moduleTemplate } from "@/lib/admin/site-service";
import { requirePagePermission } from "@/lib/auth/guard";
import type { CmsModule, CmsModuleType } from "@/lib/cms/modules";

/** Page editor title. */
export const metadata: Metadata = { title: "Edit page" };

async function EditPage({ params }: PageProps<"/admin/content/[slug]">) {
  await requirePagePermission("content.write");
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page) notFound();
  const templates = Object.fromEntries(
    ADDABLE_MODULES.map((t) => [t, moduleTemplate(t)]),
  ) as Partial<Record<CmsModuleType, CmsModule>>;
  const url = slug === "home" ? "/" : `/${slug}`;
  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        eyebrow={
          <NextLink href="/admin/content" className="underline">
            Content
          </NextLink>
        }
        title={page.title}
        description={<span className="font-mono text-xs">{url}</span>}
        actions={
          page.status === "live" && (
            <NextLink href={url} target="_blank" className="text-sm underline">
              View on site<span className="sr-only"> (opens in a new tab)</span>
            </NextLink>
          )
        }
      />
      <PageEditor
        page={{
          slug: page.slug,
          title: page.title,
          status: page.status,
          seo: page.seo,
          modules: page.modules,
        }}
        templates={templates}
      />
    </div>
  );
}

/** Page builder for one CMS page. */
export default function Page(props: PageProps<"/admin/content/[slug]">) {
  return (
    <Suspense fallback={<AdminLoading />}>
      <EditPage {...props} />
    </Suspense>
  );
}
