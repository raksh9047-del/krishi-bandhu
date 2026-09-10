"use client";

/**
 * Offline-first client-side cache for the Market Price feature.
 *
 * Prices are written to localStorage keyed by `cropId:mandiId` whenever the
 * network fetch succeeds, and read back when the user is offline or the
 * network fetch fails. This gives the farmer a persistent, per-pair price
 * cache that survives reloads — independent of the service worker's volatile
 * (16-entry, 24h) API cache, which can evict price URLs.
 *
 * Storage shape:
 *   key: "krishibandhu-price-cache"
 *   value: { [_key: `${crop}:${mandi}`]: { data: PriceData, savedAt: string } }
 *
 * MAX_ENTRIES keeps localStorage bounded; we evict the oldest entries first.
 */

const STORAGE_KEY = "krishibandhu-price-cache";
const MAX_ENTRIES = 65; // a bit more than the 130 pair space usage on smaller devices

export interface CachedPrice<T> {
  data: T;
  savedAt: string;
}

export function readPriceCache<T>(): Record<string, CachedPrice<T>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, CachedPrice<T>>) : {};
  } catch {
    return {};
  }
}

export function getCachedPrice<T>(cropId: string, mandiId: string): CachedPrice<T> | null {
  return readPriceCache<T>()?.[`${cropId}:${mandiId}`] ?? null;
}

export function setCachedPrice<T>(cropId: string, mandiId: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    const cache = readPriceCache<T>();
    cache[`${cropId}:${mandiId}`] = { data, savedAt: new Date().toISOString() };

    // Evict oldest entries to keep localStorage bounded.
    const entries = Object.entries(cache) as [string, CachedPrice<T>][];
    if (entries.length > MAX_ENTRIES) {
      entries
        .sort((a, b) => new Date(a[1].savedAt).getTime() - new Date(b[1].savedAt).getTime())
        .slice(0, entries.length - MAX_ENTRIES)
        .forEach(([key]) => delete cache[key]);
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage full/unavailable — the network path still works.
  }
}
