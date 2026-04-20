import { useEffect } from "react";
import { useQueueStore } from "../stores/queueStore";
import { useNotificationStore } from "../stores/notificationStore";
import { useUIStore } from "../stores/uiStore";
import { useRepoStore } from "../stores/repoStore";
import { useSelectionStore } from "../stores/selectionStore";
import { useSettingsStore } from "../stores/settingsStore";
import * as events from "../lib/tauri/events";

function sendDesktopNotification(title: string, body: string) {
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    new Notification(title, { body, icon: "/icon.png" });
  } else if (Notification.permission === "default") {
    Notification.requestPermission().then((p) => {
      if (p === "granted") new Notification(title, { body, icon: "/icon.png" });
    });
  }
}

export function useQueueEventListener() {
  const setCurrentItem = useQueueStore((s) => s.setCurrentItem);
  const updateItemStatus = useQueueStore((s) => s.updateItemStatus);
  const setStatus = useQueueStore((s) => s.setStatus);
  const setGraceSeconds = useQueueStore((s) => s.setGraceSeconds);
  const addNotification = useNotificationStore((s) => s.addNotification);
  const triggerRepoRefresh = useUIStore((s) => s.triggerRepoRefresh);
  const applyRepoStatusChange = useRepoStore((s) => s.applyRepoStatusChange);
  const deselectAll = useSelectionStore((s) => s.deselectAll);

  useEffect(() => {
    const cleanups: Array<() => void> = [];

    events.onQueueItemStarted((e) => {
      setCurrentItem(e.item_id);
      updateItemStatus(e.item_id, "processing");
      setStatus("running");
    }).then((fn) => cleanups.push(fn));

    events.onQueueItemCompleted((e) => {
      updateItemStatus(e.item_id, "completed");
      setCurrentItem(null);

      const item = useQueueStore.getState().items.find((i) => i.id === e.item_id);
      if (item) {
        applyRepoStatusChange(item.repo_id, item.action);
      }
    }).then((fn) => cleanups.push(fn));

    events.onQueueItemFailed((e) => {
      updateItemStatus(e.item_id, "failed", e.error);
      setCurrentItem(null);
    }).then((fn) => cleanups.push(fn));

    events.onQueueItemSkipped((e) => {
      updateItemStatus(e.item_id, "skipped");
    }).then((fn) => cleanups.push(fn));

    events.onQueuePaused(() => {
      setStatus("paused");
    }).then((fn) => cleanups.push(fn));

    events.onQueueResumed(() => {
      setStatus("running");
    }).then((fn) => cleanups.push(fn));

    events.onQueueCancelled(() => {
      setStatus("idle");
      setGraceSeconds(null);
    }).then((fn) => cleanups.push(fn));

    events.onQueueGraceTick((e) => {
      setGraceSeconds(e.seconds_remaining);
      setStatus("grace");
    }).then((fn) => cleanups.push(fn));

    events.onQueueFinished((e) => {
      setStatus("done");
      setGraceSeconds(null);
      setCurrentItem(null);
      const hasFailed = e.failed > 0;
      const notifTitle = hasFailed ? "Queue completed with errors" : "Queue completed";
      const notifMsg = `${e.completed} succeeded, ${e.failed} failed, ${e.skipped} skipped`;
      addNotification({
        type: hasFailed ? "queue_failed" : "queue_done",
        title: notifTitle,
        message: notifMsg,
      });

      const { desktopNotificationsEnabled, notifyOnQueueComplete, notifyOnQueueFailure } = useSettingsStore.getState();
      if (desktopNotificationsEnabled) {
        if (!hasFailed && notifyOnQueueComplete) sendDesktopNotification(notifTitle, notifMsg);
        if (hasFailed && notifyOnQueueFailure) sendDesktopNotification(notifTitle, notifMsg);
      }

      triggerRepoRefresh();
      deselectAll();
    }).then((fn) => cleanups.push(fn));

    return () => cleanups.forEach((fn) => fn());
  }, []);
}
