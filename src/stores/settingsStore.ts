import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AppSettings {
  defaultGraceSeconds: number;
  defaultExecutionMode: "fast" | "scheduled" | "controlled";
  staleBranchDays: number;
  repoCacheTtlMinutes: number;
  accentColor: string;
  desktopNotificationsEnabled: boolean;
  notifyOnQueueComplete: boolean;
  notifyOnQueueFailure: boolean;
  showDevBuildStamp: boolean;
}

interface SettingsState extends AppSettings {
  setSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}

const DEFAULTS: AppSettings = {
  defaultGraceSeconds: 10,
  defaultExecutionMode: "fast",
  staleBranchDays: 90,
  repoCacheTtlMinutes: 5,
  accentColor: "#8B5CF6",
  desktopNotificationsEnabled: false,
  notifyOnQueueComplete: true,
  notifyOnQueueFailure: true,
  showDevBuildStamp: false,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      setSetting: (key, value) => {
        set({ [key]: value });
        if (key === "accentColor") {
          applyAccentColor(value as string);
        }
      },
    }),
    { name: "zrm_settings" }
  )
);

export function applyAccentColor(color: string) {
  document.documentElement.style.setProperty("--accent", color);
  if (/^#[0-9a-fA-F]{6}$/.test(color)) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    document.documentElement.style.setProperty("--accent-rgb", `${r}, ${g}, ${b}`);
  }
}
