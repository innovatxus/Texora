import { create } from "zustand";

type Panel = "search" | "mobile-nav" | "bag" | null;

/** What quick add / Add to bag just added, for the confirmation drawer. */
export interface AddedItem {
  productId: string;
  slug: string;
  name: string;
  colorName: string;
  size: string;
  image: string;
  price: number;
  compareAtPrice?: number;
}

interface UiState {
  lastAdded: AddedItem | null;
  /** Records the added item and opens the bag drawer. */
  showAdded: (item: AddedItem) => void;
  /** Only one full-screen panel is open at a time. */
  panel: Panel;
  open: (panel: Exclude<Panel, null>) => void;
  close: () => void;
  setOpen: (panel: Exclude<Panel, null>, open: boolean) => void;
}

/** Which overlay is open (menu, search, bag) and the last item added, for the bag drawer. */
export const useUiStore = create<UiState>()((set) => ({
  panel: null,
  lastAdded: null,
  showAdded: (item) => set({ lastAdded: item, panel: "bag" }),
  open: (panel) => set({ panel }),
  close: () => set({ panel: null }),
  setOpen: (panel, open) =>
    set((state) => ({ panel: open ? panel : state.panel === panel ? null : state.panel })),
}));
