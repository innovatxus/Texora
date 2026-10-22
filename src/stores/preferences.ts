import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { FitFamily, SizeType } from "@/lib/validation/common";

interface PreferencesState {
  fitFamily: FitFamily | null;
  savedSizes: Partial<Record<SizeType, string>>;
  set: (prefs: {
    fitFamily: FitFamily | null;
    savedSizes: Partial<Record<SizeType, string>>;
  }) => void;
  clear: () => void;
}

/**
 * A copy of the signed-in shopper's fit and sizes, so cached product pages
 * can pre-select them without a request. Refreshed from the account (and on
 * save); cleared on sign-out.
 */
export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      fitFamily: null,
      savedSizes: {},
      set: (prefs) => set(prefs),
      clear: () => set({ fitFamily: null, savedSizes: {} }),
    }),
    {
      name: "texora-preferences",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);
