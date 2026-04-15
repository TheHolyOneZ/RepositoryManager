import { create } from "zustand";

interface SelectionState {
  selectedIds: Set<string>;
  toggle: (id: string) => void;
  selectAll: (ids: string[]) => void;
  deselectAll: () => void;
  invertSelection: (allIds: string[]) => void;
  selectFiltered: (ids: string[]) => void;
}

export const useSelectionStore = create<SelectionState>((set) => ({
  selectedIds: new Set(),

  toggle: (id) =>
    set((state) => {
      const next = new Set(state.selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedIds: next };
    }),

  selectAll: (ids) => set({ selectedIds: new Set(ids) }),

  deselectAll: () => set({ selectedIds: new Set() }),

  invertSelection: (allIds) =>
    set((state) => {
      const next = new Set(allIds.filter((id) => !state.selectedIds.has(id)));
      return { selectedIds: next };
    }),

  selectFiltered: (ids) => set({ selectedIds: new Set(ids) }),
}));
