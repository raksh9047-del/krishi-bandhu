"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { useTranslation } from "@/lib/i18n";
import { getCachedPrice, setCachedPrice } from "@/lib/offline-price-cache";
import { formatPerKg, priceUnitLabel } from "@/lib/price-unit";
import { getCropById } from "@/constants";

/**
 * The live price dashboard: what is today's best market price for this
 * crop+mandi, and where does that number actually come from. Every price
 * carries an explicit LIVE vs FALLBACK status.
 */

type PriceSource = "live" | "fpo" | "seed";

interface PriceData {
  price: number;
  date: string | null;
  source: PriceSource | null;
  fetched_at: string | null;
  status: "live" | "fallback";
  is_reference: boolean;
  commodity: string | null;
  market: string | null;
  district: string | null;
  state: string | null;
  last_live: { price: number; date: string; fetched_at: string } | null;
  unit: "quintal";
  /** Latest EPO observation — human-observed, always labeled "not live". */
  epo: { price: number; date: string; fetched_at: string } | null;
}

type ViewState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "no_data" }
  | { status: "ready"; price: PriceData; offline: boolean; cachedAt: string | null };

function timeAgo(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function LivePriceDashboard() {
  const selectedCropId = useAppStore((s) => s.selectedCropId);
  const selectedMandiId = useAppStore((s) => s.selectedMandiId);
  const { t } = useTranslation();
  const [state, setState] = useState<ViewState>({ status: "loading" });
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });

    // 1) Try the network first (the service worker may already serve this URL
    //    from its own cache). On success we persist to our localStorage cache.
    fetch(`/api/prices/${selectedCropId}/${selectedMandiId}`)
      .then((res) => {
        if (!res.ok) {
          if (res.status === 404) throw new Error("no_data");
          throw new Error("error");
        }
        return res.json();
      })
      .then((data: PriceData) => {
        if (cancelled) return;
        setCachedPrice(selectedCropId, selectedMandiId, data);
        setState({ status: "ready", price: data, offline: false, cachedAt: null });
      })
      .catch((err: Error) => {
        if (cancelled) return;
        // 2) Offline / network failure — fall back to the localStorage cache so
        //    the farmer still sees the last-known price (with a clear marker).
        if (err.message === "no_data") {
          setState({ status: "no_data" });
          return;
        }
        const cached = getCachedPrice<PriceData>(selectedCropId, selectedMandiId);
        if (cached) {
          setState({
            status: "ready",
            price: cached.data,
            offline: true,
            cachedAt: cached.savedAt,
          });
        } else {
          setState({ status: "error" });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedCropId, selectedMandiId, refreshTick]);

  const price = state.status === "ready" ? state.price : null;
  const isLive = price?.status === "live";
  const isReference = price?.is_reference === true;
  const isOffline = state.status === "ready" && state.offline;
  const cropUnit = getCropById(selectedCropId)?.unit ?? "quintal";
  const displayUnit = priceUnitLabel(cropUnit);

  return (
    <div className="overflow-hidden rounded-2xl border border-[#d3e4dc] bg-white shadow-sm fade-up">
      {/* Card header */}
      <div className="flex items-center justify-between border-b border-[#eef4f1] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">📊</span>
          <h2 className="font-semibold text-slate-800">{t("livePrice.title")}</h2>
        </div>

        {price && (
          isLive ? (
            <span className="flex items-center gap-1.5 rounded-full bg-[#2f8f4e] px-2.5 py-1 text-xs font-bold text-white">
              <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-white inline-block" />
              {t("livePrice.liveBadge")}
            </span>
          ) : isReference ? (
            <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
              {t("livePrice.notLiveBadge")}
            </span>
          ) : (
            <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
              {t("livePrice.fallbackBadge")}
            </span>
          )
        )}
      </div>

      <div className="px-4 py-4">
        {state.status === "loading" && (
          <div className="skeleton h-24 w-full" aria-label={t("common.loading")} />
        )}

        {state.status === "error" && (
          <div className="flex items-center justify-between rounded-xl bg-red-50 px-4 py-3">
            <span className="text-sm text-red-700">{t("common.error")}</span>
            <button
              onClick={() => setRefreshTick((tick) => tick + 1)}
              className="min-h-[36px] rounded-xl border border-red-300 bg-white px-3 text-sm font-medium text-red-700 transition hover:bg-red-50"
            >
              {t("common.retry")}
            </button>
          </div>
        )}

        {state.status === "no_data" && (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <span className="text-3xl">📭</span>
            <p className="text-sm text-slate-500">{t("livePrice.noData")}</p>
          </div>
        )}

        {isOffline && (
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2">
            <span>📴</span>
            <span className="text-xs font-medium text-amber-800">
              {t("livePrice.offlineNote").replace(
                "{ago}",
                state.cachedAt ? timeAgo(state.cachedAt) : "—"
              )}
            </span>
          </div>
        )}

        {price && (
          <div className={isLive
            ? "rounded-xl bg-gradient-to-br from-[#eef4f1] to-white border border-[#d3e4dc] p-4"
            : "rounded-xl bg-slate-50 border border-slate-200 p-4"
          }>
            {/* Big price number */}
            <div className="flex items-baseline gap-1">
              <span className={`text-3xl font-bold ${isLive ? "text-[#1c4432]" : "text-slate-700"}`}>
                ₹{formatPerKg(price.price)}
              </span>
              <span className={`text-sm font-medium ${isLive ? "text-[#2f6f52]" : "text-slate-500"}`}>
                / {displayUnit}
              </span>
            </div>

            {/* Provenance details */}
            <div className="mt-3 space-y-1.5">
              {isLive ? (
                <>
                  <div className="flex items-center gap-2 text-xs text-[#255a42]">
                    <span>🏛️</span>
                    <span>Source: Agmarknet · data.gov.in</span>
                  </div>
                  {price.market && (
                    <div className="flex items-center gap-2 text-xs text-[#255a42]">
                      <span>📍</span>
                      <span>{t("livePrice.marketLine").replace("{market}", price.market)}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs text-[#255a42]">
                    <span>📅</span>
                    <span>{t("livePrice.arrivalDate").replace("{date}", price.date ? formatDate(price.date) : "—")}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#255a42]">
                    <span>🔄</span>
                    <span>Synced {price.fetched_at ? timeAgo(price.fetched_at) : "—"} ago</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>📌</span>
                    <span>
                      Source:{" "}
                      {isReference
                        ? t("livePrice.refSource")
                        : price.source === "fpo"
                        ? t("livePrice.fpoSource")
                        : t("livePrice.seedSource")}
                      {" · "}Updated {price.fetched_at ? timeAgo(price.fetched_at) : "—"} ago
                    </span>
                  </div>
                  {price.last_live && (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>📈</span>
                      <span>
                        {t("livePrice.lastLiveLine")
                          .replace("{price}", formatPerKg(price.last_live.price))
                          .replace("{date}", formatDate(price.last_live.date))}
                      </span>
                    </div>
                  )}
                  <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                    ⚠️ {t("livePrice.noLiveNote")}
                  </div>
                </>
              )}
              {price.epo && (
                <div className="flex items-center gap-2 text-xs text-[#0f766e]">
                  <span>👁️</span>
                  <span>
                    Observed by EPO at the mandi: ₹{formatPerKg(price.epo.price)}/{displayUnit} ·{" "}
                    {timeAgo(price.epo.fetched_at)} ago — not live.
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Refresh button */}
        {state.status === "ready" && (
          <button
            onClick={() => setRefreshTick((tick) => tick + 1)}
            className="mt-3 flex w-full items-center justify-center gap-1 rounded-xl border border-[#d3e4dc] bg-[#f4f6f5] py-2 text-xs font-medium text-[#2f6f52] transition hover:bg-[#eef4f1]"
          >
            🔄 Refresh price
          </button>
        )}

        <p className="mt-2 text-center text-xs text-slate-400">{t("livePrice.dailyNote")}</p>
      </div>
    </div>
  );
}