"use client";

import { useCallback, useEffect, useState } from "react";
import localforage from "localforage";
import { useAppStore } from "@/store/useAppStore";
import { useTranslation } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { getCropById, getMandiById } from "@/constants";
import type { FeedBubble } from "@/types";
import { enqueue, flushQueue, isFailed, loadQueue, retryItem, type QueueItem } from "@/lib/offline-queue";

function cacheKey(cropId: string, mandiId: string) {
  return `feed-cache:${cropId}:${mandiId}`;
}

interface CachedFeed {
  bubbles: FeedBubble[];
  syncedAt: string;
}

function timeAgo(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function InteractionFeed() {
  const selectedCropId = useAppStore((s) => s.selectedCropId);
  const selectedMandiId = useAppStore((s) => s.selectedMandiId);
  const currentFarmerId = useAppStore((s) => s.currentFarmerId);
  const { t } = useTranslation();

  const [syncedBubbles, setSyncedBubbles] = useState<FeedBubble[]>([]);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);

  // Quick "record a sale" entry, queued when offline.
  const [showEntry, setShowEntry] = useState(false);
  const [grossWeight, setGrossWeight] = useState("");
  const [deductionPercent, setDeductionPercent] = useState("");
  const [pricePerQuintal, setPricePerQuintal] = useState("");
  const [traderId, setTraderId] = useState("");

  const refreshQueue = useCallback(async () => {
    const items = await loadQueue(selectedCropId, selectedMandiId);
    setQueue(items);
  }, [selectedCropId, selectedMandiId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // 1. Offline-first: show cached data immediately, clearly labeled.
      const cached = await localforage.getItem<CachedFeed>(cacheKey(selectedCropId, selectedMandiId));
      if (!cancelled && cached) {
        setSyncedBubbles(cached.bubbles);
        setSyncedAt(cached.syncedAt);
      } else if (!cancelled) {
        setSyncedBubbles([]);
        setSyncedAt(null);
      }

      await refreshQueue();

      // 2. Try a fresh fetch. If it fails (offline), the cached view above
      // simply stays as-is — never replaced with an error state.
      if (typeof navigator !== "undefined" && !navigator.onLine) return;

      try {
        const [pricesRes, signalRes, parchiRes] = await Promise.all([
          supabase
            .from("fpo_price_entries")
            .select("price_per_quintal, entered_at")
            .eq("crop_id", selectedCropId)
            .eq("mandi_id", selectedMandiId)
            .order("entered_at", { ascending: false })
            .limit(5),
          supabase
            .from("sowing_signals")
            .select("signal_status, recalculated_at")
            .eq("crop_id", selectedCropId)
            .eq("mandi_id", selectedMandiId)
            .maybeSingle(),
          currentFarmerId
            ? fetch(`/api/parchi/list?farmer_id=${currentFarmerId}&mandi_id=${selectedMandiId}&limit=5`).then((r) => r.json())
            : Promise.resolve({ entries: [] }),
        ]);

        const bubbles: FeedBubble[] = [];

        for (const row of pricesRes.data ?? []) {
          bubbles.push({
            type: "price_update",
            crop_id: selectedCropId,
            mandi_id: selectedMandiId,
            price_per_quintal: row.price_per_quintal,
            source: "FPO entry",
            timestamp: row.entered_at,
          });
        }

        if (signalRes.data) {
          bubbles.push({
            type: "signal_change",
            crop_id: selectedCropId,
            mandi_id: selectedMandiId,
            signal_status: signalRes.data.signal_status,
            timestamp: signalRes.data.recalculated_at,
          });
        }

        for (const parchi of (parchiRes as any).entries ?? []) {
          bubbles.push({ type: "parchi_confirmation", parchi, timestamp: parchi.timestamp });
        }

        bubbles.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        if (!cancelled) {
          const nowIso = new Date().toISOString();
          setSyncedBubbles(bubbles);
          setSyncedAt(nowIso);
          await localforage.setItem(cacheKey(selectedCropId, selectedMandiId), { bubbles, syncedAt: nowIso });
        }
      } catch {
        // Fetch failed — keep showing the cached view, don't surface an error
        // for what is likely just a flaky connection at a mandi.
      }

      // 3. Attempt to flush anything queued from a previous offline session.
      flushQueue(selectedCropId, selectedMandiId, (items) => {
        if (!cancelled) setQueue(items);
      });
    }

    load();

    function handleOnline() {
      flushQueue(selectedCropId, selectedMandiId, (items) => {
        if (!cancelled) setQueue(items);
      });
    }
    window.addEventListener("online", handleOnline);

    return () => {
      cancelled = true;
      window.removeEventListener("online", handleOnline);
    };
  }, [selectedCropId, selectedMandiId, currentFarmerId, refreshQueue]);

  async function handleQuickEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!currentFarmerId) return;

    const payload = {
      farmer_id: currentFarmerId,
      trader_id: traderId,
      crop_id: selectedCropId,
      mandi_id: selectedMandiId,
      gross_weight: Number(grossWeight),
      deduction_percent: Number(deductionPercent),
      price_per_quintal: Number(pricePerQuintal),
    };

    const items = await enqueue(selectedCropId, selectedMandiId, payload);
    setQueue(items);
    setShowEntry(false);
    setGrossWeight("");
    setDeductionPercent("");
    setPricePerQuintal("");
    setTraderId("");

    flushQueue(selectedCropId, selectedMandiId, setQueue);
  }

  const crop = getCropById(selectedCropId);
  const mandi = getMandiById(selectedMandiId);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">{t("feed.title")}</h2>
        {syncedAt && <span className="text-base text-slate-500">{t("feed.lastSynced")} {timeAgo(syncedAt)}</span>}
      </div>

      {syncedBubbles.length === 0 && queue.length === 0 && (
        <p className="text-base text-slate-500">{t("feed.emptyState")}</p>
      )}

      <div className="flex flex-col gap-2">
        {syncedBubbles.map((bubble, i) => (
          <FeedBubbleView key={`${bubble.type}-${bubble.timestamp}-${i}`} bubble={bubble} cropName={crop?.name} mandiName={mandi?.name} />
        ))}

        {queue.map((item) => (
          <div
            key={item.tempId}
            className={`self-end rounded-card border px-3 py-2 text-base ${
              isFailed(item) ? "border-signal-red bg-signal-red/10 text-signal-red" : "border-slate-300 bg-slate-100 text-slate-600"
            }`}
          >
            {isFailed(item) ? (
              <button onClick={() => retryItem(selectedCropId, selectedMandiId, item.tempId, setQueue)} className="underline">
                {t("feed.retryFailed")}
              </button>
            ) : (
              <span>{t("feed.queuedPending")} — {t("feed.sending")}</span>
            )}
          </div>
        ))}
      </div>

      {currentFarmerId && (
        <div className="mt-2">
          {!showEntry ? (
            <button
              onClick={() => setShowEntry(true)}
              className="min-h-touch w-full rounded-card border border-trust-500 px-4 text-base font-medium text-trust-700"
            >
              + Record a sale
            </button>
          ) : (
            <form onSubmit={handleQuickEntry} className="flex flex-col gap-2 rounded-card border border-slate-300 p-3">
              {/* Rough stand-in: a real build would look up the trader by
                  phone/QR rather than asking the farmer to type a raw uuid.
                  The point of this screen is the offline queue behavior
                  below, not this input's UX. */}
              <input
                required
                placeholder="Trader ID"
                value={traderId}
                onChange={(e) => setTraderId(e.target.value)}
                className="min-h-touch rounded-card border border-slate-300 px-3 text-base"
              />
              <input
                required
                type="number"
                min={0}
                placeholder="Gross weight (kg)"
                value={grossWeight}
                onChange={(e) => setGrossWeight(e.target.value)}
                className="min-h-touch rounded-card border border-slate-300 px-3 text-base"
              />
              <input
                required
                type="number"
                min={0}
                max={100}
                placeholder="Deduction %"
                value={deductionPercent}
                onChange={(e) => setDeductionPercent(e.target.value)}
                className="min-h-touch rounded-card border border-slate-300 px-3 text-base"
              />
              <input
                required
                type="number"
                min={0}
                placeholder="Price per quintal (₹)"
                value={pricePerQuintal}
                onChange={(e) => setPricePerQuintal(e.target.value)}
                className="min-h-touch rounded-card border border-slate-300 px-3 text-base"
              />
              <button type="submit" className="min-h-touch rounded-card bg-trust-500 px-4 text-base font-medium text-white">
                Submit
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

function FeedBubbleView({ bubble, cropName, mandiName }: { bubble: FeedBubble; cropName?: string; mandiName?: string }) {
  const time = new Date(bubble.timestamp).toLocaleString();

  if (bubble.type === "price_update") {
    return (
      <div className="max-w-[85%] rounded-card border border-slate-300 bg-white p-3 text-base">
        <p>
          {cropName} price at {mandiName}: <strong>₹{bubble.price_per_quintal}/quintal</strong>
        </p>
        <p className="text-slate-500">{bubble.source} — {time}</p>
      </div>
    );
  }

  if (bubble.type === "signal_change") {
    return (
      <div className="max-w-[85%] rounded-card border border-slate-300 bg-white p-3 text-base">
        <p>
          Sowing Signal for {cropName}: <strong className="uppercase">{bubble.signal_status}</strong>
        </p>
        <p className="text-slate-500">{time}</p>
      </div>
    );
  }

  // parchi_confirmation (queued_pending bubbles are rendered separately by the
  // offline-queue block above, so they never reach this view — return null if
  // one somehow does, rather than rendering a malformed bubble.)
  if (bubble.type !== "parchi_confirmation") return null;
  return (
    <div className="max-w-[85%] rounded-card border border-trust-300 bg-trust-50 p-3 text-base">
      <p>
        Parchi confirmed — ₹{bubble.parchi.total_amount.toFixed(0)} ({bubble.parchi.net_weight}kg net)
      </p>
      <p className="text-slate-500">
        Hash: {bubble.parchi.current_hash.slice(0, 8)}…{bubble.parchi.current_hash.slice(-4)} — {time}
      </p>
    </div>
  );
}
