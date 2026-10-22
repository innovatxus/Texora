"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { signOut } from "@/lib/auth/actions";
import { usePreferencesStore } from "@/stores/preferences";
import { useWishlistStore } from "@/stores/wishlist";

/** Signs out of this device and returns to the home page. */
export function SignOutLink() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await signOut({});
        // The bag stays on this device; account-only copies don't.
        usePreferencesStore.getState().clear();
        useWishlistStore.setState({ items: [] });
        router.replace("/");
        router.refresh();
      }}
      className="min-h-11 text-sm underline underline-offset-4 disabled:opacity-60"
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
