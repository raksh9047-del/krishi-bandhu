"use client";

import { useCallback, useEffect, useState } from "react";
import localforage from "localforage";
import { useAppStore } from "@/store/useAppStore";
import { useTranslation } from "@/lib/i18n";
import { getCropById, getMandiById } from "@/constants";
import type { FeedBubble, ParchiRecord } from "@/types";
import { formatPerKg } from "@/lib/price-unit";
import {
  enqueue,
  flushQueue,
  isFailed,
  loadQueue,
  retryItem,
  discardItem,
  type QueueItem,
} from "@/lib/offline-queue";

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

  // Quick "record a sale" entry, queued when offline. The trader picker loads
  // from the seeded directory so the submitted payload always has a real
  // trader_id (a raw-UUID free-text field was how "couldn't send" happened).
  const [showEntry, setShowEntry] = useState(false);
  const [grossWeight, setGrossWeight] = useState("");
  const [deductionPercent, setDeductionPercent] = useState("");
  const [pricePerQuintal, setPricePerQuintal] = useState("");
  const [traders, setTraders] = useState<Array<{ id: string; name: string }>>([]);
  const [traderId, setTraderId] = useState("");

  // The farmer's own Parchi records for the current crop/mandi ("My sale
  // records" table).
  const [records, setRecords] = useState<ParchiRecord[]>([]);

  // Real chain-integrity check against the DB, powered by /api/parchi/verify.
  const [chainCheck, setChainCheck] = useState<{
    isValid: boolean;
    brokenAtIndex: number | null;
    entriesChecked: number;
  } | null>(null);
  const [checkingChain, setCheckingChain] = useState(false);

  async function verifyChain() {
    if (!currentFarmerId || checkingChain) return;
    setCheckingChain(true);
    try {
      const res = await fetch(`/api/parchi/verify?farmer_id=${currentFarmerId}&mandi_id=${selectedMandiId}`);
      const data = await res.json();
      setChainCheck(data);
    } finally {
      setCheckingChain(false);
    }
  }

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
        const params = new URLSearchParams({
          crop_id: selectedCropId,
          mandi_id: selectedMandiId,
          limit: "20",
        });
        if (currentFarmerId) params.set("farmer_id", currentFarmerId);

        const res = await fetch(`/api/feed/bubbles?${params.toString()}`);
        const { bubbles } = (await res.json()) as { bubbles: FeedBubble[] };

        // "My sale records" table — always kept in sync with the bubbles.
        if (currentFarmerId) {
          const listRes = await fetch(
            `/api/parchi/list?farmer_id=${currentFarmerId}&mandi_id=${selectedMandiId}&limit=20`
          );
          const { entries } = (await listRes.json()) as { entries: ParchiRecord[] };
          if (!cancelled) setRecords(entries);
        } else {
          setRecords([]);
        }

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

  // Load the seeded trader directory so "Record a sale" always submits a real
  // trader_id (a raw-uuid text field is how the fail-to-send happened).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/users/role?role=trader")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("bad response"))))
      .then(({ users }: { users: Array<{ id: string; name: string }> }) => {
        if (cancelled) return;
        setTraders(users);
        if (users.length > 0) setTraderId((prev) => prev || users[0].id);
      })
      .catch(() => {
        /* non-blocking: entry form falls back to whatever trader is selected */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleQuickEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!currentFarmerId || !traderId) return;

    const payload = {
      farmer_id: currentFarmerId,
      trader_id: traderId,
      crop_id: selectedCropId,
      mandi_id: selectedMandiId,
      gross_weight: Number(grossWeight),
      deduction_percent: Number(deductionPercent),
      // The form asks for ₹/kg; storage (and the hash chain) is ₹/quintal.
      price_per_quintal: Number(pricePerQuintal) * 100,
    };

    const items = await enqueue(selectedCropId, selectedMandiId, payload);
    setQueue(items);
    setShowEntry(false);
    setGrossWeight("");
    setDeductionPercent("");
    setPricePerQuintal("");

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
              <div className="flex items-center gap-2">
                <button onClick={() => retryItem(selectedCropId, selectedMandiId, item.tempId, setQueue)} className="underline">
                  {t("feed.retryFailed")}
                </button>
                <button
                  onClick={() => discardItem(selectedCropId, selectedMandiId, item.tempId, setQueue)}
                  className="rounded-full border border-slate-300 px-2 text-slate-500"
                  title={t("feed.discardFailed")}
                >
                  ✕
                </button>
              </div>
            ) : (
              <span>{t("feed.queuedPending")} — {t("feed.sending")}</span>
            )}
          </div>
        ))}
      </div>

      {currentFarmerId && (
        <>
          <div className="mt-2 flex flex-col gap-2 rounded-card border border-slate-200 p-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">{t("feed.mySales")}</h3>
              <button
                onClick={verifyChain}
                disabled={checkingChain}
                className="min-h-touch rounded-card border border-trust-500 px-4 text-base font-medium text-trust-700 disabled:opacity-50"
              >
                🔗 {t("feed.verifyChain")}
              </button>
            </div>
            {checkingChain && <p className="text-base text-slate-500">{t("feed.chainChecking")}</p>}
            {!checkingChain && chainCheck && chainCheck.entriesChecked === 0 && (
              <p className="text-base text-slate-500">{t("feed.chainEmpty")}</p>
            )}
            {!checkingChain && chainCheck && chainCheck.entriesChecked > 0 && (
              chainCheck.isValid ? (
                <p className="text-base font-medium text-signal-green">
                  ✓ {t("feed.chainValid").replace("{count}", String(chainCheck.entriesChecked))}
                </p>
              ) : (
                <p className="text-base font-medium text-signal-red">
                  ✗ {t("feed.chainBroken").replace("{index}", String((chainCheck.brokenAtIndex ?? 0) + 1))}
                </p>
              )
            )}
            {records.length === 0 ? (
              <p className="text-base text-slate-500">{t("feed.recordsEmpty")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-sm text-slate-700">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-500">
                      <th className="py-1 pr-2 font-medium">#</th>
                      <th className="py-1 pr-2 font-medium">{t("feed.colDate")}</th>
                      <th className="py-1 pr-2 font-medium">{t("feed.colNet")}</th>
                      <th className="py-1 pr-2 font-medium">{t("feed.colAmount")}</th>
                      <th className="py-1 font-medium">{t("feed.colHash")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...records]
                      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                      .map((r, i) => (
                        <tr key={r.id} className="border-b border-slate-100">
                          <td className="py-1 pr-2 align-top text-slate-500">{i + 1}</td>
                          <td className="py-1 pr-2 align-top">{new Date(r.timestamp).toLocaleDateString()}</td>
                          <td className="py-1 pr-2 align-top">{r.net_weight} kg</td>
                          <td className="py-1 pr-2 align-top">₹{r.total_amount.toFixed(0)}</td>
                          <td className="py-1 font-mono align-top text-xs">
                            {r.current_hash.slice(0, 8)}…{r.current_hash.slice(-4)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
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
              <select
                required
                value={traderId}
                onChange={(e) => setTraderId(e.target.value)}
                className="min-h-touch rounded-card border border-slate-300 bg-white px-3 text-base"
              >
                {traders.length === 0 && <option value="">{t("feed.noTraders")}</option>}
                {traders.map((tr) => (
                  <option key={tr.id} value={tr.id}>
                    {tr.name}
                  </option>
                ))}
              </select>
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
                placeholder="Price per kg (₹)"
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
        </>
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
          {cropName} price at {mandiName}: <strong>₹{formatPerKg(bubble.price_per_quintal)}/kg</strong>
        </p>
        <p className="text-slate-500">{bubble.source} — {time}</p>
      </div>
    );
  }

  if (bubble.type === "epo_observation") {
    return (
      <div className="max-w-[85%] rounded-card border border-teal-300 bg-teal-50 p-3 text-base">
        <p>
          👁️ {cropName} observed at {mandiName}:{" "}
          <strong>₹{formatPerKg(bubble.price_per_quintal)}/kg</strong>
        </p>
        <p className="text-slate-500">
          Observed by {bubble.observer} · not live — {time}
        </p>
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
