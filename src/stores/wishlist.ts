import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface WishlistEntry {
  productId: string;
  color?: string;
  /** Price when saved, for the price-drop indicator. */
  priceAtAdd: number;
  addedAt: number;
}

interface WishlistState {
  items: WishlistEntry[];
  toggle: (entry: Omit<WishlistEntry, "addedAt">) => boolean;
  remove: (productId: string) => void;
}

/** Guest wishlist in localStorage; merged into the account on sign-in (Phase 7). */
export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],
      toggle: (entry) => {
        const exists = get().items.some((i) => i.productId === entry.productId);
        set((state) => ({
          items: exists
            ? state.items.filter((i) => i.productId !== entry.productId)
            : [{ ...entry, addedAt: Date.now() }, ...state.items],
        }));
        return !exists;
      },
      remove: (productId) =>
        set((state) => ({ items: state.items.filter((i) => i.productId !== productId) })),
    }),
    {
      name: "texora-wishlist",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);
