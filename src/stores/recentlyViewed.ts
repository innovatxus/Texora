import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface RecentlyViewedItem {
  productId: string;
  slug: string;
  name: string;
  image: string;
  price: number;
  compareAtPrice?: number;
}

const LIMIT = 12;

interface RecentlyViewedState {
  items: RecentlyViewedItem[];
  record: (item: RecentlyViewedItem) => void;
  clear: () => void;
}

/** Most recent first, de-duplicated, capped. Synced to the account in Phase 7. */
export const useRecentlyViewedStore = create<RecentlyViewedState>()(
  persist(
    (set) => ({
      items: [],
      record: (item) =>
        set((state) => ({
          items: [item, ...state.items.filter((i) => i.productId !== item.productId)].slice(
            0,
            LIMIT,
          ),
        })),
      clear: () => set({ items: [] }),
    }),
    {
      name: "texora-recently-viewed",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);
