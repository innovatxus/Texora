"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/primitives";
import type { ProductDraftData } from "@/lib/validation/merchant";
import type { EditorContext } from "./types";

/** Skeleton matching the editor's layout while its code loads. */
function EditorSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[12rem_minmax(0,1fr)]" aria-busy="true">
      <Skeleton className="hidden h-80 lg:block" />
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-12" />
        <Skeleton className="h-40" />
        <Skeleton className="h-12" />
      </div>
    </div>
  );
}

// The editor, matrix, cropper and uploader are heavy; they load only on this page.
const ProductEditor = dynamic(() => import("./ProductEditor").then((m) => m.ProductEditor), {
  loading: EditorSkeleton,
});

/** Client boundary that code-splits the product editor. */
export function EditorLoader({
  initialData,
  context,
}: {
  initialData: ProductDraftData;
  context: EditorContext;
}) {
  return <ProductEditor initialData={initialData} context={context} />;
}
