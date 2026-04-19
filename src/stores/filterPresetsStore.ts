import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { RepoFilters } from "../types/repo";

export interface FilterPreset {
  id: string;
  name: string;
  filters: RepoFilters;
}

interface FilterPresetsState {
  presets: FilterPreset[];
  savePreset: (name: string, filters: RepoFilters) => void;
  deletePreset: (id: string) => void;
}

export const useFilterPresetsStore = create<FilterPresetsState>()(
  persist(
    (set) => ({
      presets: [],
      savePreset: (name, filters) =>
        set((s) => ({ presets: [...s.presets, { id: crypto.randomUUID(), name, filters }] })),
      deletePreset: (id) =>
        set((s) => ({ presets: s.presets.filter((p) => p.id !== id) })),
    }),
    { name: "zrm_filter_presets" }
  )
);
