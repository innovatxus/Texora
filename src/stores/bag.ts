import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface BagLine {
  sku: string;
  productId: string;
  quantity: number;
  addedAt: number;
}

/** Most units of one SKU per bag line. */
export const MAX_LINE_QUANTITY = 10;

interface BagState {
  lines: BagLine[];
  savedForLater: BagLine[];
  promoCodes: string[];
  giftCardCode: string | null;
  rewardsValue: number;
  add: (line: Omit<BagLine, "addedAt" | "quantity"> & { quantity?: number }) => void;
  setQuantity: (sku: string, quantity: number) => void;
  /** Swaps a line to another variant (size or colour change), merging duplicates. */
  replaceSku: (sku: string, next: { sku: string; productId: string }) => void;
  remove: (sku: string) => void;
  saveForLater: (sku: string) => void;
  moveToBag: (sku: string) => void;
  removeSaved: (sku: string) => void;
  addPromoCode: (code: string) => void;
  removePromoCode: (code: string) => void;
  setGiftCardCode: (code: string | null) => void;
  setRewardsValue: (value: number) => void;
  clear: () => void;
}

const capped = (n: number) => Math.min(MAX_LINE_QUANTITY, n);

/**
 * Guest bag, persisted in localStorage. Prices and stock are never trusted
 * from here: the server re-prices every line (lib/bag/price-bag.ts).
 * Hydrated after mount (see StoreHydration) to avoid SSR mismatches.
 */
export const useBagStore = create<BagState>()(
  persist(
    (set) => ({
      lines: [],
      savedForLater: [],
      promoCodes: [],
      giftCardCode: null,
      rewardsValue: 0,
      add: ({ sku, productId, quantity = 1 }) =>
        set((state) => {
          const existing = state.lines.find((l) => l.sku === sku);
          if (existing) {
            return {
              lines: state.lines.map((l) =>
                l.sku === sku ? { ...l, quantity: capped(l.quantity + quantity) } : l,
              ),
            };
          }
          return {
            lines: [
              ...state.lines,
              { sku, productId, quantity: capped(quantity), addedAt: Date.now() },
            ],
          };
        }),
      setQuantity: (sku, quantity) =>
        set((state) => ({
          lines:
            quantity <= 0
              ? state.lines.filter((l) => l.sku !== sku)
              : state.lines.map((l) => (l.sku === sku ? { ...l, quantity: capped(quantity) } : l)),
        })),
      replaceSku: (sku, next) =>
        set((state) => {
          const current = state.lines.find((l) => l.sku === sku);
          if (!current || next.sku === sku) return state;
          const target = state.lines.find((l) => l.sku === next.sku);
          const others = state.lines.filter((l) => l.sku !== sku && l.sku !== next.sku);
          const merged = {
            ...current,
            ...next,
            quantity: capped(current.quantity + (target?.quantity ?? 0)),
          };
          const index = state.lines.findIndex((l) => l.sku === sku);
          others.splice(Math.min(index, others.length), 0, merged);
          return { lines: others };
        }),
      remove: (sku) => set((state) => ({ lines: state.lines.filter((l) => l.sku !== sku) })),
      saveForLater: (sku) =>
        set((state) => {
          const line = state.lines.find((l) => l.sku === sku);
          if (!line) return state;
          return {
            lines: state.lines.filter((l) => l.sku !== sku),
            savedForLater: [line, ...state.savedForLater.filter((l) => l.sku !== sku)],
          };
        }),
      moveToBag: (sku) =>
        set((state) => {
          const line = state.savedForLater.find((l) => l.sku === sku);
          if (!line) return state;
          const existing = state.lines.find((l) => l.sku === sku);
          return {
            savedForLater: state.savedForLater.filter((l) => l.sku !== sku),
            lines: existing
              ? state.lines.map((l) =>
                  l.sku === sku ? { ...l, quantity: capped(l.quantity + line.quantity) } : l,
                )
              : [...state.lines, { ...line, addedAt: Date.now() }],
          };
        }),
      removeSaved: (sku) =>
        set((state) => ({ savedForLater: state.savedForLater.filter((l) => l.sku !== sku) })),
      addPromoCode: (code) =>
        set((state) => {
          const normalised = code.trim().toUpperCase();
          return normalised && !state.promoCodes.includes(normalised)
            ? { promoCodes: [...state.promoCodes, normalised].slice(0, 5) }
            : state;
        }),
      removePromoCode: (code) =>
        set((state) => ({ promoCodes: state.promoCodes.filter((c) => c !== code) })),
      setGiftCardCode: (giftCardCode) => set({ giftCardCode }),
      setRewardsValue: (rewardsValue) => set({ rewardsValue }),
      clear: () => set({ lines: [], promoCodes: [], giftCardCode: null, rewardsValue: 0 }),
    }),
    {
      name: "texora-bag",
      version: 2,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as Partial<BagState>;
        if (version < 2)
          return {
            ...state,
            savedForLater: [],
            promoCodes: [],
            giftCardCode: null,
            rewardsValue: 0,
          };
        return state;
      },
    },
  ),
);

/** Total units in the bag, for the header badge. */
export const selectBagCount = (state: Pick<BagState, "lines">) =>
  state.lines.reduce((sum, l) => sum + l.quantity, 0);

const subscribeHydration = (onChange: () => void) =>
  useBagStore.persist.onFinishHydration(onChange);

/** False until the persisted bag has loaded, so pages never flash "empty". */
export function useBagHydrated(): boolean {
  return useSyncExternalStore(
    subscribeHydration,
    () => useBagStore.persist.hasHydrated(),
    () => false,
  );
}
