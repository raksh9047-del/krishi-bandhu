"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { useTranslation } from "@/lib/i18n";
import { MANDIS } from "@/constants";

interface MandiResult {
  mandi_id: string;
  mandi_name: string;
  district: string;
  price_per_quintal: number;
  source: string;
  distance_km: number | null;
  transport_cost_per_q: number;
  deduction_percent: number;
  effective_take_home: number;
  net_payout: number;
}

interface CompareResponse {
  crop_id: string;
  crop_name: string;
  deduction_percent: number;
  mandis: MandiResult[];
  best_mandi_id: string | null;
}

export function MultiMandiComparison() {
  const selectedCropId = useAppStore((s) => s.selectedCropId);
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CompareResponse | null>(null);
  const [transportCost, setTransportCost] = useState<number>(0);
  const [deductionPercent, setDeductionPercent] = useState<number>(5);
  const [useAutoDistance, setUseAutoDistance] = useState<boolean>(false);
  const [farmerLat, setFarmerLat] = useState<string>("");
  const [farmerLng, setFarmerLng] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    async function fetchComparison() {
      const body: Record<string, unknown> = {
        crop_id: selectedCropId,
        deduction_percent: deductionPercent,
      };

      if (useAutoDistance && farmerLat && farmerLng) {
        body.farmer_lat = parseFloat(farmerLat);
        body.farmer_lng = parseFloat(farmerLng);
      } else {
        body.transport_cost_per_q = transportCost;
      }

      try {
        const res = await fetch("/api/market/compare-net", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok && !cancelled) {
          setData(await res.json());
        }
      } catch {
        // keep stale data
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchComparison();
    return () => { cancelled = true; };
  }, [selectedCropId, deductionPercent, transportCost, useAutoDistance, farmerLat, farmerLng]);

  const bestTakeHome = data?.mandis[0]?.effective_take_home ?? 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-[#d3e4dc] bg-white shadow-sm fade-up">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-[#eef4f1] px-4 py-3">
        <span className="text-lg">🗺️</span>
        <h2 className="font-semibold text-slate-800">
          {t("multiMandi.title") ?? "Sell Anywhere — Net Realization"}
        </h2>
      </div>

      <div className="px-4 py-4">
        {/* Inputs */}
        <div className="mb-4 space-y-3">
          {/* Transport mode toggle */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setUseAutoDistance(false)}
              className={[
                "rounded-xl border py-2.5 text-sm font-semibold transition-all",
                !useAutoDistance
                  ? "border-[#2f6f52] bg-[#2f6f52] text-white shadow-md"
                  : "border-[#d3e4dc] bg-[#f4f6f5] text-slate-600 hover:border-[#2f6f52]",
              ].join(" ")}
            >
              🚛 Manual Transport Cost
            </button>
            <button
              type="button"
              onClick={() => setUseAutoDistance(true)}
              className={[
                "rounded-xl border py-2.5 text-sm font-semibold transition-all",
                useAutoDistance
                  ? "border-[#2f6f52] bg-[#2f6f52] text-white shadow-md"
                  : "border-[#d3e4dc] bg-[#f4f6f5] text-slate-600 hover:border-[#2f6f52]",
              ].join(" ")}
            >
              📍 Estimate from Village
            </button>
          </div>

          {!useAutoDistance ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Transport (₹/q)
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
                  Deduction (%)
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
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Your Lat
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={farmerLat}
                  onChange={(e) => setFarmerLat(e.target.value)}
                  placeholder="e.g. 19.88"
                  className="w-full min-h-[44px] rounded-xl border border-[#d3e4dc] bg-[#f4f6f5] px-3 text-right text-base font-semibold text-slate-800 focus:border-[#2f6f52] focus:ring-1 focus:ring-[#2f6f52] transition"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Your Lng
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={farmerLng}
                  onChange={(e) => setFarmerLng(e.target.value)}
                  placeholder="e.g. 73.85"
                  className="w-full min-h-[44px] rounded-xl border border-[#d3e4dc] bg-[#f4f6f5] px-3 text-right text-base font-semibold text-slate-800 focus:border-[#2f6f52] focus:ring-1 focus:ring-[#2f6f52] transition"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Deduction (%)
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
          )}
        </div>

        {/* Results */}
        {loading ? (
          <div className="skeleton h-48 w-full" />
        ) : !data || data.mandis.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <span className="text-3xl">📭</span>
            <p className="text-sm text-slate-500">{t("livePrice.noData") ?? "No price data available."}</p>
          </div>
        ) : (
          <>
            {/* Best mandi highlight */}
            {data.mandis.length > 0 && (
              <div className="mb-4 rounded-xl bg-gradient-to-br from-[#2f6f52] to-[#1c4432] p-4 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-widest text-[#8fb8a6]">
                      Best mandi for {data.crop_name}
                    </p>
                    <p className="mt-1 text-lg font-bold">{data.mandis[0].mandi_name}</p>
                    <p className="text-xs text-[#d3e4dc]">{data.mandis[0].district} district</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">
                      ₹{(data.mandis[0].effective_take_home / 100).toFixed(2)}/kg
                    </p>
                    <p className="text-xs text-[#8fb8a6]">effective take-home</p>
                  </div>
                </div>
                {data.mandis[0].distance_km != null && (
                  <p className="mt-2 text-xs text-[#d3e4dc]">
                    📍 {data.mandis[0].distance_km} km away · transport ₹{data.mandis[0].transport_cost_per_q}/q
                  </p>
                )}
              </div>
            )}

            {/* All mandis table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#eef4f1] text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="pb-2 pr-2">Mandi</th>
                    <th className="pb-2 pr-2 text-right">Price/q</th>
                    <th className="pb-2 pr-2 text-right">Transport</th>
                    <th className="pb-2 text-right font-bold text-[#2f6f52]">Net/kg</th>
                  </tr>
                </thead>
                <tbody>
                  {data.mandis.map((m, i) => {
                    const isBest = i === 0;
                    const isCurrentMandi = m.mandi_id === useAppStore.getState().selectedMandiId;
                    return (
                      <tr
                        key={m.mandi_id}
                        className={[
                          "border-b border-[#f0f4f2] transition-colors",
                          isBest ? "bg-[#eef4f1]" : "",
                          isCurrentMandi ? "ring-1 ring-[#2f6f52] ring-inset" : "",
                        ].join(" ")}
                      >
                        <td className="py-2.5 pr-2">
                          <div className="flex items-center gap-1.5">
                            {isBest && <span className="text-xs">👑</span>}
                            <div>
                              <p className="font-medium text-slate-800">{m.mandi_name}</p>
                              <p className="text-xs text-slate-400">{m.district}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 pr-2 text-right">
                          <span className="font-medium text-slate-700">
                            ₹{(m.price_per_quintal / 100).toFixed(2)}
                          </span>
                          {m.source !== "live" && (
                            <span className="ml-1 rounded bg-amber-100 px-1 py-0.5 text-[9px] font-semibold text-amber-700">
                              {m.source.toUpperCase()}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 pr-2 text-right text-slate-500">
                          ₹{m.transport_cost_per_q}
                        </td>
                        <td className="py-2.5 text-right">
                          <span className={[
                            "font-bold",
                            isBest ? "text-[#2f6f52]" : "text-slate-800",
                          ].join(" ")}>
                            ₹{(m.effective_take_home / 100).toFixed(2)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Savings callout */}
            {data.mandis.length >= 2 && (
              <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                <p className="font-semibold">
                  💡 Selling at {data.mandis[0].mandi_name} instead of {data.mandis[data.mandis.length - 1].mandi_name} nets you{" "}
                  ₹{((data.mandis[0].effective_take_home - data.mandis[data.mandis.length - 1].effective_take_home) / 100).toFixed(2)}/kg more.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
