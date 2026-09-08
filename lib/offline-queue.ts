import localforage from "localforage";

export interface QueueItem {
  tempId: string;
  payload: Record<string, unknown>;
  attempt: number;
  timestamp: string; // original creation time — preserved through sync, never overwritten with sync time
}

const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [2000, 4000, 8000];

function queueKey(cropId: string, mandiId: string) {
  return `feed-queue:${cropId}:${mandiId}`;
}

export async function loadQueue(cropId: string, mandiId: string): Promise<QueueItem[]> {
  const stored = await localforage.getItem<QueueItem[]>(queueKey(cropId, mandiId));
  return stored ?? [];
}

async function saveQueue(cropId: string, mandiId: string, items: QueueItem[]): Promise<void> {
  await localforage.setItem(queueKey(cropId, mandiId), items);
}

/** Adds a new queued item (attempt 0) and returns the updated queue. */
export async function enqueue(
  cropId: string,
  mandiId: string,
  payload: Record<string, unknown>
): Promise<QueueItem[]> {
  const items = await loadQueue(cropId, mandiId);
  const item: QueueItem = {
    tempId: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    payload,
    attempt: 0,
    timestamp: new Date().toISOString(),
  };
  const next = [...items, item];
  await saveQueue(cropId, mandiId, next);
  return next;
}

/** True once an item has exhausted its retries — rendered as "couldn't send, tap to retry" rather than an endless spinner. */
export function isFailed(item: QueueItem): boolean {
  return item.attempt >= MAX_ATTEMPTS;
}

async function attemptSend(item: QueueItem): Promise<boolean> {
  try {
    const res = await fetch("/api/parchi/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item.payload),
    });
    return res.ok;
  } catch {
    return false; // network error — still offline, or the request failed to even go out
  }
}

/**
 * Attempts every queued item in order. On success, removes it from the
 * queue. On failure, bumps its attempt count and — if under the retry cap —
 * schedules another attempt after the matching backoff delay (2s, 4s, 8s).
 * `onUpdate` fires after every state change so the feed can re-render
 * immediately rather than waiting for the whole flush to finish.
 */
export async function flushQueue(
  cropId: string,
  mandiId: string,
  onUpdate: (items: QueueItem[]) => void
): Promise<void> {
  const items = await loadQueue(cropId, mandiId);

  for (const item of items) {
    if (isFailed(item)) continue; // needs an explicit manual retry, not an automatic one

    const succeeded = await attemptSend(item);
    const current = await loadQueue(cropId, mandiId);

    if (succeeded) {
      const next = current.filter((i) => i.tempId !== item.tempId);
      await saveQueue(cropId, mandiId, next);
      onUpdate(next);
    } else {
      const next = current.map((i) => (i.tempId === item.tempId ? { ...i, attempt: i.attempt + 1 } : i));
      await saveQueue(cropId, mandiId, next);
      onUpdate(next);

      const updatedItem = next.find((i) => i.tempId === item.tempId);
      if (updatedItem && !isFailed(updatedItem)) {
        const delay = BACKOFF_MS[Math.min(updatedItem.attempt - 1, BACKOFF_MS.length - 1)];
        setTimeout(() => {
          flushQueue(cropId, mandiId, onUpdate);
        }, delay);
      }
    }
  }
}

/** Resets a permanently-failed item's attempt count and retries immediately — the "tap to retry" action. */
export async function retryItem(
  cropId: string,
  mandiId: string,
  tempId: string,
  onUpdate: (items: QueueItem[]) => void
): Promise<void> {
  const items = await loadQueue(cropId, mandiId);
  const next = items.map((i) => (i.tempId === tempId ? { ...i, attempt: 0 } : i));
  await saveQueue(cropId, mandiId, next);
  onUpdate(next);
  await flushQueue(cropId, mandiId, onUpdate);
}
