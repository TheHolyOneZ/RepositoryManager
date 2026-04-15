import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { FetchProgress, RateLimitWarning } from "./types";
import type { QueueItem, QueueStatus } from "../../types/queue";

export interface QueueItemEvent {
  item_id: string;
  repo_name: string;
  action: string;
  error?: string;
}

export interface QueueGraceTick {
  seconds_remaining: number;
}

export interface QueueFinished {
  completed: number;
  failed: number;
  skipped: number;
}


export const onQueueItemStarted = (cb: (e: QueueItemEvent) => void): Promise<UnlistenFn> =>
  listen<QueueItemEvent>("queue:item-started", (event) => cb(event.payload));

export const onQueueItemCompleted = (cb: (e: QueueItemEvent) => void): Promise<UnlistenFn> =>
  listen<QueueItemEvent>("queue:item-completed", (event) => cb(event.payload));

export const onQueueItemFailed = (cb: (e: QueueItemEvent) => void): Promise<UnlistenFn> =>
  listen<QueueItemEvent>("queue:item-failed", (event) => cb(event.payload));

export const onQueueItemSkipped = (cb: (e: QueueItemEvent) => void): Promise<UnlistenFn> =>
  listen<QueueItemEvent>("queue:item-skipped", (event) => cb(event.payload));

export const onQueuePaused = (cb: () => void): Promise<UnlistenFn> =>
  listen("queue:paused", () => cb());

export const onQueueResumed = (cb: () => void): Promise<UnlistenFn> =>
  listen("queue:resumed", () => cb());

export const onQueueCancelled = (cb: () => void): Promise<UnlistenFn> =>
  listen("queue:cancelled", () => cb());

export const onQueueGraceTick = (cb: (e: QueueGraceTick) => void): Promise<UnlistenFn> =>
  listen<QueueGraceTick>("queue:grace-tick", (event) => cb(event.payload));

export const onQueueFinished = (cb: (e: QueueFinished) => void): Promise<UnlistenFn> =>
  listen<QueueFinished>("queue:finished", (event) => cb(event.payload));

export const onReposFetchProgress = (cb: (e: FetchProgress) => void): Promise<UnlistenFn> =>
  listen<FetchProgress>("repos:fetch-progress", (event) => cb(event.payload));

export const onReposCacheUpdated = (cb: () => void): Promise<UnlistenFn> =>
  listen("repos:cache-updated", () => cb());

export const onHealthScoresReady = (cb: () => void): Promise<UnlistenFn> =>
  listen("health:scores-ready", () => cb());

export const onSuggestionsReady = (cb: (count: number) => void): Promise<UnlistenFn> =>
  listen<{ count: number }>("suggestions:ready", (event) => cb(event.payload.count));

export const onRateLimitWarning = (cb: (e: RateLimitWarning) => void): Promise<UnlistenFn> =>
  listen<RateLimitWarning>("rate-limit:warning", (event) => cb(event.payload));
