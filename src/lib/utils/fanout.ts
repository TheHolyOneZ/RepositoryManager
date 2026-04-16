export interface FanoutResult<T, R> {
  item: T;
  ok: boolean;
  value?: R;
  error?: string;
}

export async function fanout<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
  onProgress?: (done: number, total: number) => void,
): Promise<FanoutResult<T, R>[]> {
  const results: FanoutResult<T, R>[] = [];
  let index = 0;
  let done = 0;

  async function next(): Promise<void> {
    while (index < items.length) {
      const i = index++;
      const item = items[i];
      try {
        const value = await worker(item);
        results[i] = { item, ok: true, value };
      } catch (e: unknown) {
        let errMsg: string;
        if (e instanceof Error) {
          errMsg = e.message;
        } else if (e && typeof e === "object") {
          const o = e as Record<string, unknown>;
          errMsg = typeof o.message === "string" ? o.message : JSON.stringify(e);
        } else {
          errMsg = String(e);
        }
        results[i] = { item, ok: false, error: errMsg };
      }
      done++;
      onProgress?.(done, items.length);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, next));
  return results;
}
