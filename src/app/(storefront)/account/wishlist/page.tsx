import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { AccountNav } from "@/components/account/AccountNav";
import { SharedWishlist, WishlistView } from "@/components/account/WishlistView";
import { Skeleton } from "@/components/primitives";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Wishlist",
  robots: { index: false, follow: false },
};

async function Content({ searchParams }: PageProps<"/account/wishlist">) {
  const { items } = await searchParams;
  if (typeof items === "string" && items) {
    const ids = [...new Set(items.split(",").filter(Boolean))].slice(0, 200);
    return (
      <div className="container-page pt-10 pb-24">
        <h1 className="font-display text-5xl">A shared wishlist</h1>
        <p className="mt-4 text-ink-soft">Tap the heart on anything you&apos;d like to save.</p>
        <div className="mt-10">
          <SharedWishlist ids={ids} />
        </div>
      </div>
    );
  }
  await connection();
  const session = await getSession();
  const signedIn = Boolean(session && session.role !== "guest");
  return (
    <div className="container-page pt-10 pb-24">
      <p className="text-label text-ink-subtle">{signedIn ? "Your account" : "Saved items"}</p>
      <h1 className="mt-2 font-display text-5xl">Wishlist</h1>
      <div className={signedIn ? "mt-10 grid gap-10 lg:grid-cols-[14rem_1fr]" : "mt-10"}>
        {signedIn && <AccountNav />}
        <div className="min-w-0">
          <WishlistView signedIn={signedIn} />
        </div>
      </div>
    </div>
  );
}

/** The wishlist: this device's list for guests, the synced list for members; or a shared one. */
export default function Page(props: PageProps<"/account/wishlist">) {
  return (
    <Suspense fallback={<Skeleton className="container-page mt-10 h-96" />}>
      <Content {...props} />
    </Suspense>
  );
}
