import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface BagLine {
  sku: string;
  productId: string;
  quantity: number;
  addedAt: number;
}

export const MAX_LINE_QUANTITY = 10;

interface BagState {
  lines: BagLine[];
  add: (line: Omit<BagLine, "addedAt" | "quantity"> & { quantity?: number }) => void;
  setQuantity: (sku: string, quantity: number) => void;
  remove: (sku: string) => void;
  clear: () => void;
}

/**
 * Guest bag, persisted in localStorage. Prices and stock are never trusted
 * from here: the server re-prices every line (Phase 6).
 * Hydrated after mount (see BagHydration) to avoid SSR mismatches.
 */
export const useBagStore = create<BagState>()(
  persist(
    (set) => ({
      lines: [],
      add: ({ sku, productId, quantity = 1 }) =>
        set((state) => {
          const existing = state.lines.find((l) => l.sku === sku);
          if (existing) {
            return {
              lines: state.lines.map((l) =>
                l.sku === sku
                  ? { ...l, quantity: Math.min(MAX_LINE_QUANTITY, l.quantity + quantity) }
                  : l,
              ),
            };
          }
          return {
            lines: [
              ...state.lines,
              {
                sku,
                productId,
                quantity: Math.min(MAX_LINE_QUANTITY, quantity),
                addedAt: Date.now(),
              },
            ],
          };
        }),
      setQuantity: (sku, quantity) =>
        set((state) => ({
          lines:
            quantity <= 0
              ? state.lines.filter((l) => l.sku !== sku)
              : state.lines.map((l) =>
                  l.sku === sku ? { ...l, quantity: Math.min(MAX_LINE_QUANTITY, quantity) } : l,
                ),
        })),
      remove: (sku) => set((state) => ({ lines: state.lines.filter((l) => l.sku !== sku) })),
      clear: () => set({ lines: [] }),
    }),
    {
      name: "texora-bag",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);

export const selectBagCount = (state: BagState) =>
  state.lines.reduce((sum, l) => sum + l.quantity, 0);
