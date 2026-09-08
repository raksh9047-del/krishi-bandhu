"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { useTranslation } from "@/lib/i18n";

/**
 * The live price dashboard: what is today's best market price for this
 * crop+mandi, and where does that number actually come from. Every price
 * displayed here carries a provenance label — Agmarknet live release vs. an
 * FPO manual entry — never a bare number.
 */

type PriceSource = "live" | "fpo" | "seed";

interface PriceData {
  price: number;
  date: string;
  source: PriceSource;
  fetched_at: string;
}

type ViewState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "no_data" }
  | { status: "ready"; price: PriceData };

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
  // Bumped by the Retry button to re-run the fetch effect (the effect's data
  // deps alone are crop/mandi — a bare setState(loading) would never refetch).
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });

    fetch(`/api/prices/${selectedCropId}/${selectedMandiId}`)
      .then((res) => {
        if (!res.ok) {
          if (res.status === 404) throw new Error("no_data");
          throw new Error("error");
        }
        return res.json();
      })
      .then((data: PriceData) => {
        if (!cancelled) setState({ status: "ready", price: data });
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setState(err.message === "no_data" ? { status: "no_data" } : { status: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [selectedCropId, selectedMandiId, refreshTick]);

  let provenance = "";
  let displayDate = "";
  if (state.status === "ready") {
    if (state.price.source === "live") {
      provenance = t("livePrice.liveSource");
      displayDate = formatDate(state.price.date);
    } else {
      provenance = state.price.source === "fpo" ? t("livePrice.fpoSource") : t("livePrice.seedSource");
      displayDate = t("livePrice.updatedAgo").replace("{ago}", timeAgo(state.price.fetched_at));
    }
  }

  return (
    <div className="rounded-card border border-slate-300 p-4">
      <h2 className="mb-2 text-lg font-semibold text-slate-900">{t("livePrice.title")}</h2>

      {state.status === "loading" && (
        <div className="h-16 animate-pulse rounded-card bg-slate-100" aria-label={t("common.loading")} />
      )}

      {state.status === "error" && (
        <div className="flex items-center justify-between">
          <span className="text-base text-slate-500">{t("common.error")}</span>
          <button
            onClick={() => setRefreshTick((tick) => tick + 1)}
            className="min-h-touch rounded-card border border-slate-300 px-3 text-base"
          >
            {t("common.retry")}
          </button>
        </div>
      )}

      {state.status === "no_data" && (
        <p className="text-base text-slate-500">{t("livePrice.noData")}</p>
      )}

      {state.status === "ready" && (
        <>
          <div className="rounded-card bg-trust-50 p-3">
            <p className="text-2xl font-semibold text-trust-700">₹{state.price.price.toFixed(0)}/quintal</p>
            <p className="mt-1 text-base text-trust-700">
              {t("netRealization.sourceLabel")}: {provenance} · {displayDate}
            </p>
          </div>
          <p className="mt-2 text-base text-slate-500">{t("livePrice.dailyNote")}</p>
        </>
      )}
    </div>
  );
}