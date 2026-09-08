"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { useTranslation } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { calculateNetRealization, type TransportArranger } from "@/lib/net-realization";

/**
 * Net realization estimator with CORRECTED transport handling.
 *
 * The naive model always subtracts transport cost from the payout. That's
 * wrong: transport only reduces the payout when the TRADER arranged pickup
 * (they recover that cost by paying the farmer less). When the farmer
 * arranges their own transport, they already paid it separately — it shows
 * as their own expense line, never as a trader deduction.
 *
 * The price read prefers the new /api/prices/:crop/:mandi route (Agmarknet
 * live over FPO/seed), and falls back to the direct `fpo_price_entries` read
 * if that route is unavailable — so the screen still works before the
 * `prices` migration is applied or when offline.
 */

type PriceSource = "live" | "fpo" | "seed";

interface ResolvedPrice {
  price: number;
  source: PriceSource;
  date: string;
  fetchedAt: string;
}

interface PriceRow {
  price_per_quintal: number;
  entered_at: string;
}

function timeAgo(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const ARRANGERS: { value: TransportArranger; labelKey: string }[] = [
  { value: "farmer", labelKey: "netRealization.transportFarmer" },
  { value: "trader", labelKey: "netRealization.transportTrader" },
];

export function NetRealizationCalculator() {
  const selectedCropId = useAppStore((s) => s.selectedCropId);
  const selectedMandiId = useAppStore((s) => s.selectedMandiId);
  const { t } = useTranslation();

  const [priceState, setPriceState] = useState<"loading" | "unavailable" | "ready">("loading");
  const [price, setPrice] = useState<ResolvedPrice | null>(null);
  const [transportCost, setTransportCost] = useState<number>(0);
  const [transportArranger, setTransportArranger] = useState<TransportArranger>("farmer");
  const [deductionPercent, setDeductionPercent] = useState<number>(5);

  useEffect(() => {
    let cancelled = false;
    setPriceState("loading");

    async function fetchPrice() {
      try {
        const res = await fetch(`/api/prices/${selectedCropId}/${selectedMandiId}`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) {
            setPrice({
              price: data.price,
              source: data.source,
              date: data.date,
              fetchedAt: data.fetched_at,
            });
            setPriceState("ready");
            return;
          }
        }
      } catch {
        // fall through to the direct FPO read below
      }

      const { data } = await supabase
        .from("fpo_price_entries")
        .select("price_per_quintal, entered_at")
        .eq("crop_id", selectedCropId)
        .eq("mandi_id", selectedMandiId)
        .order("entered_at", { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data, error }) => ({ data: (error ? null : data) as PriceRow | null, error }));

      if (!cancelled) {
        if (data) {
          setPrice({ price: data.price_per_quintal, source: "fpo", date: "", fetchedAt: data.entered_at });
          setPriceState("ready");
        } else {
          setPriceState("unavailable");
        }
      }
    }

    fetchPrice();
    return () => {
      cancelled = true;
    };
  }, [selectedCropId, selectedMandiId]);

  const pricePerQuintal = price?.price ?? 0;
  const deductionAmount = deductionPercent === 0 ? 0 : pricePerQuintal * (deductionPercent / 100);
  const result = calculateNetRealization(pricePerQuintal, 1, [{ label: "deduction", amount: deductionAmount }], transportCost, transportArranger);

  const sourceLabel =
    price?.source === "live"
      ? `${t("livePrice.liveSource")}, ${formatDate(price.date)}`
      : price?.source === "fpo"
        ? `${t("livePrice.fpoSource")}, updated ${timeAgo(price.fetchedAt)}`
        : `${t("livePrice.seedSource")}, updated ${timeAgo(price?.fetchedAt ?? "")}`;

  return (
    <div className="rounded-card border border-slate-300 p-4">
      <h2 className="mb-2 text-lg font-semibold text-slate-900">{t("netRealization.title")}</h2>

      {priceState === "loading" && <p className="text-base text-slate-500">{t("common.loading")}</p>}
      {priceState === "unavailable" && (
        <p className="text-base text-slate-500">{t("livePrice.noData")}</p>
      )}

      {priceState === "ready" && (
        <>
          <p className="mb-3 text-base text-slate-600">
            {t("netRealization.priceLabel")}: ₹{price!.price.toFixed(0)}/quintal —{" "}
            <span className="text-slate-500">{t("netRealization.sourceLabel")}: {sourceLabel}</span>
          </p>

          <div role="radiogroup" aria-label={t("netRealization.transportArrangerLabel")} className="mb-3">
            <p className="mb-1 text-base text-slate-700">{t("netRealization.transportArrangerLabel")}</p>
            <div className="flex gap-2">
              {ARRANGERS.map((option) => {
                const active = transportArranger === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setTransportArranger(option.value)}
                    className={`min-h-touch flex-1 rounded-card border px-3 text-base ${
                      active ? "border-trust-600 bg-trust-600 text-white" : "border-slate-300 text-slate-700"
                    }`}
                  >
                    {t(option.labelKey)}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="mb-2 flex items-center justify-between gap-2">
            <span className="text-base text-slate-700">{t("netRealization.transportLabel")} (₹/quintal)</span>
            <input
              type="number"
              min={0}
              value={transportCost}
              onChange={(e) => setTransportCost(Number(e.target.value))}
              className="min-h-touch w-24 rounded-card border border-slate-300 px-2 text-right text-lg"
            />
          </label>

          <label className="mb-3 flex items-center justify-between gap-2">
            <span className="text-base text-slate-700">{t("netRealization.deductionLabel")} (%)</span>
            <input
              type="number"
              min={0}
              max={100}
              value={deductionPercent}
              onChange={(e) => setDeductionPercent(Number(e.target.value))}
              className="min-h-touch w-24 rounded-card border border-slate-300 px-2 text-right text-lg"
            />
          </label>

          <div className="rounded-card bg-trust-50 p-3">
            <dl className="space-y-1">
              <div className="flex justify-between text-base text-slate-700">
                <dt>{t("netRealization.grossLine")}</dt>
                <dd>₹{result.gross_amount.toFixed(0)}</dd>
              </div>
              <div className="flex justify-between text-base text-slate-700">
                <dt>{t("netRealization.deductionLine")} ({deductionPercent}%)</dt>
                <dd>-₹{deductionAmount.toFixed(0)}</dd>
              </div>
              {result.transport_deducted_from_payout > 0 && (
                <div className="flex justify-between text-base text-slate-700">
                  <dt>{t("netRealization.transportDeductedLine")}</dt>
                  <dd>-₹{result.transport_deducted_from_payout.toFixed(0)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-200 pt-1 text-base font-semibold text-trust-700">
                <dt>{t("netRealization.netPayoutLine")}</dt>
                <dd>₹{result.net_payout.toFixed(0)}</dd>
              </div>
              {result.farmer_own_transport_expense > 0 && (
                <div className="flex justify-between text-base text-slate-700">
                  <dt>{t("netRealization.ownTransportLine")}</dt>
                  <dd>-₹{result.farmer_own_transport_expense.toFixed(0)}</dd>
                </div>
              )}
            </dl>
            {result.farmer_own_transport_expense > 0 && (
              <p className="mt-2 text-lg font-semibold text-trust-700">
                {t("netRealization.effectiveTakeHomeLine")}: ₹{result.effective_take_home.toFixed(0)}/quintal
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}