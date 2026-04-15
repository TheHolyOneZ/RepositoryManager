import React from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { ToastContainer } from "../glass/GlassToast";
import { CommandPalette } from "../command-palette/CommandPalette";
import { NotificationCenter } from "../notifications/NotificationCenter";
import { ConfirmationModal } from "../confirmation/ConfirmationModal";
import { useQueueEventListener } from "../../hooks/useQueue";
import { useUIStore } from "../../stores/uiStore";
import { useGlobalKeyboard } from "../../hooks/useKeyboard";

export const AppShell: React.FC = () => {
  useQueueEventListener();
  const openPalette = useUIStore((s) => s.openCommandPalette);
  const activeSlideOver = useUIStore((s) => s.activeSlideOver);
  const closeSlideOver = useUIStore((s) => s.closeSlideOver);

  useGlobalKeyboard({ "cmd+k": openPalette });

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden", background: "#06080F" }}>
      <Sidebar />
      <div style={{ display: "flex", minWidth: 0, flex: 1, flexDirection: "column" }}>
        <TopBar />
        <main style={{ minHeight: 0, flex: 1, overflow: "hidden" }}>
          <Outlet />
        </main>
      </div>
      <CommandPalette />
      <NotificationCenter open={activeSlideOver === "notifications"} onClose={closeSlideOver} />
      <ConfirmationModal />
      <ToastContainer />
    </div>
  );
};
