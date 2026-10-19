import { create } from "zustand";

type Panel = "search" | "mobile-nav" | "bag" | null;

interface UiState {
  /** Only one full-screen panel is open at a time. */
  panel: Panel;
  open: (panel: Exclude<Panel, null>) => void;
  close: () => void;
  setOpen: (panel: Exclude<Panel, null>, open: boolean) => void;
}

export const useUiStore = create<UiState>()((set) => ({
  panel: null,
  open: (panel) => set({ panel }),
  close: () => set({ panel: null }),
  setOpen: (panel, open) =>
    set((state) => ({ panel: open ? panel : state.panel === panel ? null : state.panel })),
}));
