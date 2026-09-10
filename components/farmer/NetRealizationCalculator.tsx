"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { useTranslation } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { calculateNetRealization, type TransportArranger } from "@/lib/net-realization";
import { formatPerKg } from "@/lib/price-unit";

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

const ARRANGERS: { value: TransportArranger; label: string; icon: string }[] = [
  { value: "farmer", label: "I arrange transport", icon: "🚜" },
  { value: "trader", label: "Trader picks up", icon: "🏪" },
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
      ? `Live · ${formatDate(price.date)}`
      : price?.source === "fpo"
        ? `FPO · ${timeAgo(price.fetchedAt)}`
        : `Seed · ${timeAgo(price?.fetchedAt ?? "")}`;

  return (
    <div className="overflow-hidden rounded-2xl border border-[#d3e4dc] bg-white shadow-sm fade-up">
      {/* Card header */}
      <div className="flex items-center gap-2 border-b border-[#eef4f1] px-4 py-3">
        <span className="text-lg">🧮</span>
        <h2 className="font-semibold text-slate-800">{t("netRealization.title")}</h2>
      </div>

      <div className="px-4 py-4">
        {priceState === "loading" && (
          <div className="skeleton h-24 w-full" />
        )}

        {priceState === "unavailable" && (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <span className="text-3xl">📭</span>
            <p className="text-sm text-slate-500">{t("livePrice.noData")}</p>
          </div>
        )}

        {priceState === "ready" && (
          <>
            {/* Price source chip */}
            <div className="mb-4 flex items-center justify-between rounded-xl bg-[#f4f6f5] px-3 py-2">
              <span className="text-xs text-slate-500">{t("netRealization.priceLabel")}</span>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-[#1c4432]">₹{formatPerKg(price!.price)}/kg</span>
                <span className="rounded-full bg-[#d3e4dc] px-2 py-0.5 text-[10px] font-semibold text-[#1c4432]">
                  {sourceLabel}
                </span>
              </div>
            </div>

            {/* Transport arranger toggle */}
            <div className="mb-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("netRealization.transportArrangerLabel")}
              </p>
              <div role="radiogroup" aria-label={t("netRealization.transportArrangerLabel")} className="grid grid-cols-2 gap-2">
                {ARRANGERS.map((option) => {
                  const active = transportArranger === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setTransportArranger(option.value)}
                      className={[
                        "flex items-center justify-center gap-1.5 rounded-xl border py-3 text-sm font-semibold transition-all",
                        active
                          ? "border-[#2f6f52] bg-[#2f6f52] text-white shadow-md"
                          : "border-[#d3e4dc] bg-[#f4f6f5] text-slate-600 hover:border-[#2f6f52]",
                      ].join(" ")}
                    >
                      <span>{option.icon}</span>
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Inputs row */}
            <div className="mb-4 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  {t("netRealization.transportLabel")} (₹/q)
                </label>
                <input
                  type="number"
                  min={0}
                  value={transportCost}
                  onChange={(e) => setTransportCost(Number(e.target.value))}
                  className="w-full min-h-[44px] rounded-xl border border-[#d3e4dc] bg-[#f4f6f5] px-3 text-right text-base font-semibold text-slate-800 focus:border-[#2f6f52] focus:ring-1 focus:ring-[#2f6f52] transition"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  {t("netRealization.deductionLabel")} (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={deductionPercent}
                  onChange={(e) => setDeductionPercent(Number(e.target.value))}
                  className="w-full min-h-[44px] rounded-xl border border-[#d3e4dc] bg-[#f4f6f5] px-3 text-right text-base font-semibold text-slate-800 focus:border-[#2f6f52] focus:ring-1 focus:ring-[#2f6f52] transition"
                />
              </div>
            </div>

            {/* Result breakdown */}
            <div className="rounded-xl bg-gradient-to-br from-[#eef4f1] to-white border border-[#d3e4dc] overflow-hidden">
              <div className="px-4 py-3 space-y-2">
                <div className="flex items-center justify-between text-sm text-slate-600">
                  <span>{t("netRealization.grossLine")}</span>
                  <span className="font-medium">₹{(result.gross_amount / 100).toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-slate-600">
                  <span>{t("netRealization.deductionLine")} ({deductionPercent}%)</span>
                  <span className="font-medium text-red-600">−₹{(deductionAmount / 100).toFixed(2)}</span>
                </div>
                {result.transport_deducted_from_payout > 0 && (
                  <div className="flex items-center justify-between text-sm text-slate-600">
                    <span>{t("netRealization.transportDeductedLine")}</span>
                    <span className="font-medium text-red-600">−₹{(result.transport_deducted_from_payout / 100).toFixed(2)}</span>
                  </div>
                )}
              </div>
              <div className="border-t border-[#d3e4dc] bg-[#2f6f52] px-4 py-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-[#d3e4dc]">{t("netRealization.netPayoutLine")}</span>
                <span className="text-xl font-bold text-white">₹{(result.net_payout / 100).toFixed(2)}</span>
              </div>
              {result.farmer_own_transport_expense > 0 && (
                <div className="border-t border-[#d3e4dc] bg-[#eef4f1] px-4 py-2 flex items-center justify-between">
                  <span className="text-xs text-[#255a42]">{t("netRealization.ownTransportLine")}</span>
                  <span className="text-sm font-semibold text-[#255a42]">−₹{(result.farmer_own_transport_expense / 100).toFixed(2)}</span>
                </div>
              )}
              {result.farmer_own_transport_expense > 0 && (
                <div className="border-t border-[#d3e4dc] bg-[#1c4432] px-4 py-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#8fb8a6]">{t("netRealization.effectiveTakeHomeLine")}</span>
                  <span className="text-lg font-bold text-white">₹{(result.effective_take_home / 100).toFixed(2)}/kg</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}