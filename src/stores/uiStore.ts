import { create } from "zustand";

export type SlideOverType = "repo-detail" | "queue-panel" | "notifications" | null;

export interface Toast {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  message?: string;
  duration?: number;
}

interface UIState {
  isSidebarCollapsed: boolean;
  activeSlideOver: SlideOverType;
  slideOverData: unknown;
  activeModal: string | null;
  modalData: unknown;
  toasts: Toast[];
  isCommandPaletteOpen: boolean;
  isDryRunMode: boolean;
  repoRefreshToken: number;

  setSidebarCollapsed: (collapsed: boolean) => void;
  openSlideOver: (type: SlideOverType, data?: unknown) => void;
  closeSlideOver: () => void;
  openModal: (id: string, data?: unknown) => void;
  closeModal: () => void;
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  setDryRunMode: (enabled: boolean) => void;
  triggerRepoRefresh: () => void;
}

let toastIdCounter = 0;

export const useUIStore = create<UIState>((set) => ({
  isSidebarCollapsed: false,
  activeSlideOver: null,
  slideOverData: null,
  activeModal: null,
  modalData: null,
  toasts: [],
  isCommandPaletteOpen: false,
  isDryRunMode: false,
  repoRefreshToken: 0,

  setSidebarCollapsed: (isSidebarCollapsed) => set({ isSidebarCollapsed }),

  openSlideOver: (activeSlideOver, slideOverData = null) =>
    set({ activeSlideOver, slideOverData }),

  closeSlideOver: () => set({ activeSlideOver: null, slideOverData: null }),

  openModal: (activeModal, modalData = null) => set({ activeModal, modalData }),

  closeModal: () => set({ activeModal: null, modalData: null }),

  addToast: (toast) => {
    const id = String(++toastIdCounter);
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    const duration = toast.duration ?? 4000;
    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
      }, duration);
    }
  },

  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  openCommandPalette: () => set({ isCommandPaletteOpen: true }),
  closeCommandPalette: () => set({ isCommandPaletteOpen: false }),
  setDryRunMode: (isDryRunMode) => set({ isDryRunMode }),
  triggerRepoRefresh: () => set((s) => ({ repoRefreshToken: s.repoRefreshToken + 1 })),
}));
