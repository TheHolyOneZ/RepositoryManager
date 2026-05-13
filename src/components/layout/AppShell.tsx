import React, { useState, useCallback, useEffect } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { ToastContainer } from "../glass/GlassToast";
import { CommandPalette } from "../command-palette/CommandPalette";
import { NotificationCenter } from "../notifications/NotificationCenter";
import { ConfirmationModal } from "../confirmation/ConfirmationModal";
import { ShortcutsOverlay } from "../shortcuts/ShortcutsOverlay";
import { useQueueEventListener } from "../../hooks/useQueue";
import { useUIStore } from "../../stores/uiStore";
import { useGlobalKeyboard } from "../../hooks/useKeyboard";
import { useAccountStore, selectActiveAccount } from "../../stores/accountStore";
import { useGlobalContextRefresh } from "../../hooks/useGlobalContextRefresh";
import { useSettingsStore, applyAccentColor } from "../../stores/settingsStore";

const DevBadge: React.FC = () => {
  const show = useSettingsStore((s) => s.showDevBuildStamp);
  const accent = useSettingsStore((s) => s.accentColor);
  const accounts = useAccountStore((s) => s.accounts);
  const activeAccount = useAccountStore(selectActiveAccount);
  if (!show) return null;
  const idx = activeAccount ? accounts.findIndex((a) => a.id === activeAccount.id) + 1 : 1;

  const r = parseInt(accent.slice(1,3), 16);
  const g = parseInt(accent.slice(3,5), 16);
  const b = parseInt(accent.slice(5,7), 16);
  return (
    <div style={{
      position: "fixed", top: 4, left: 4, zIndex: 9999,
      fontSize: "0.55rem", fontWeight: 700, letterSpacing: "0.06em",
      color: `rgba(${r},${g},${b},0.45)`,
      pointerEvents: "none", userSelect: "none",
      fontFamily: "monospace",
    }}>
      v1.4.3.{idx}
    </div>
  );
};

export const AppShell: React.FC = () => {
  useQueueEventListener();
  useGlobalContextRefresh();
  const accentColor = useSettingsStore((s) => s.accentColor);
  useEffect(() => { applyAccentColor(accentColor); }, [accentColor]);
  const openPalette = useUIStore((s) => s.openCommandPalette);
  const activeSlideOver = useUIStore((s) => s.activeSlideOver);
  const closeSlideOver = useUIStore((s) => s.closeSlideOver);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useGlobalKeyboard({
    "cmd+k": openPalette,
    "?": useCallback(() => setShortcutsOpen(true), []),
  });

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden", background: "#06080F" }}>
      <DevBadge />
      <Sidebar />
      <div style={{ display: "flex", minWidth: 0, flex: 1, flexDirection: "column" }}>
        <TopBar />
        <main style={{ minHeight: 0, flex: 1, overflow: "hidden", position: "relative" }}>
          <Outlet />
        </main>
      </div>
      <CommandPalette />
      <NotificationCenter open={activeSlideOver === "notifications"} onClose={closeSlideOver} />
      <ShortcutsOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <ConfirmationModal />
      <ToastContainer />
    </div>
  );
};
