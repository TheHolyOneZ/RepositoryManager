import { useEffect } from "react";
import { useQueueStore } from "../stores/queueStore";
import { useNotificationStore } from "../stores/notificationStore";
import { useUIStore } from "../stores/uiStore";
import { useRepoStore } from "../stores/repoStore";
import { useSelectionStore } from "../stores/selectionStore";
import * as events from "../lib/tauri/events";

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
      addNotification({
        type: e.failed > 0 ? "queue_failed" : "queue_done",
        title: e.failed > 0 ? "Queue completed with errors" : "Queue completed",
        message: `${e.completed} succeeded, ${e.failed} failed, ${e.skipped} skipped`,
      });

      triggerRepoRefresh();

      deselectAll();
    }).then((fn) => cleanups.push(fn));

    return () => cleanups.forEach((fn) => fn());
  }, []);
}
