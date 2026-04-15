import { create } from "zustand";
import type { QueueItem, QueueStatus, ExecutionMode } from "../types/queue";

interface QueueState {
  items: QueueItem[];
  status: QueueStatus;
  mode: ExecutionMode;
  graceSecondsRemaining: number | null;
  currentItemId: string | null;
  isDryRun: boolean;

  setItems: (items: QueueItem[]) => void;
  setStatus: (status: QueueStatus) => void;
  setMode: (mode: ExecutionMode) => void;
  setGraceSeconds: (seconds: number | null) => void;
  setCurrentItem: (id: string | null) => void;
  setDryRun: (enabled: boolean) => void;
  updateItemStatus: (id: string, status: QueueItem["status"], error?: string) => void;
  clearCompleted: () => void;
  reset: () => void;
}

export const useQueueStore = create<QueueState>((set) => ({
  items: [],
  status: "idle",
  mode: "fast",
  graceSecondsRemaining: null,
  currentItemId: null,
  isDryRun: false,

  setItems: (items) => set({ items }),
  setStatus: (status) => set({ status }),
  setMode: (mode) => set({ mode }),
  setGraceSeconds: (graceSecondsRemaining) => set({ graceSecondsRemaining }),
  setCurrentItem: (currentItemId) => set({ currentItemId }),
  setDryRun: (isDryRun) => set({ isDryRun }),

  updateItemStatus: (id, status, error) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, status, error } : item
      ),
    })),

  clearCompleted: () =>
    set((state) => ({
      items: state.items.filter((i) => i.status !== "completed"),
    })),

  reset: () =>
    set({
      items: [],
      status: "idle",
      graceSecondsRemaining: null,
      currentItemId: null,
    }),
}));


export function selectPending(state: QueueState): QueueItem[] {
  return state.items.filter((i) => i.status === "pending");
}

export function selectProcessing(state: QueueState): QueueItem | undefined {
  return state.items.find((i) => i.status === "processing");
}

export function selectCompleted(state: QueueState): QueueItem[] {
  return state.items.filter((i) => i.status === "completed");
}

export function selectFailed(state: QueueState): QueueItem[] {
  return state.items.filter((i) => i.status === "failed");
}

export function selectSkipped(state: QueueState): QueueItem[] {
  return state.items.filter((i) => i.status === "skipped");
}

export function selectTotalCount(state: QueueState): number {
  return state.items.length;
}
