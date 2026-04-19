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
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      setSetting: (key, value) => {
        set({ [key]: value });
        if (key === "accentColor") {
          document.documentElement.style.setProperty("--accent", value as string);
        }
      },
    }),
    { name: "zrm_settings" }
  )
);

export function applyAccentColor(color: string) {
  document.documentElement.style.setProperty("--accent", color);
}
