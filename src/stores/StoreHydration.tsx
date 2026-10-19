"use client";

import { useEffect } from "react";
import { useBagStore } from "./bag";
import { useRecentlyViewedStore } from "./recentlyViewed";
import { useWishlistStore } from "./wishlist";

/** Rehydrates persisted client stores after mount, so server and first client render match. */
export function StoreHydration() {
  useEffect(() => {
    void useBagStore.persist.rehydrate();
    void useRecentlyViewedStore.persist.rehydrate();
    void useWishlistStore.persist.rehydrate();
  }, []);
  return null;
}
