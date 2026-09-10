"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { useTranslation } from "@/lib/i18n";
import type { BackhaulTruck } from "@/types";

function formatDeparture(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("en-IN", { day: "numeric", month: "short", weekday: "short" }),
    time: d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
  };
}

function capacityColor(kg: number) {
  if (kg >= 5000) return { bg: "bg-emerald-50", text: "text-emerald-700", bar: "bg-emerald-500" };
  if (kg >= 2000) return { bg: "bg-amber-50", text: "text-amber-700", bar: "bg-amber-400" };
  return { bg: "bg-red-50", text: "text-red-700", bar: "bg-red-400" };
}

export function BackhaulFarmerView() {
  const selectedMandiId = useAppStore((s) => s.selectedMandiId);
  const { t } = useTranslation();
  const [trucks, setTrucks] = useState<BackhaulTruck[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);

    // Read through the admin-client API: `backhaul_trucks` RLS only grants the
    // `authenticated` role, which this pilot's browser (anon client) never is,
    // so a direct supabase read returns nothing even when trucks exist.
    fetch("/api/fpo/backhaul")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("bad response"))))
      .then((data: { trucks: BackhaulTruck[] }) => {
        if (cancelled) return;
        setTrucks(data.trucks.filter((tr) => tr.from_mandi_id === selectedMandiId));
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedMandiId]);

  return (
    <div className="flex flex-col gap-4">
      {/* Page header */}
      <div className="rounded-2xl bg-gradient-to-br from-[#1c4432] to-[#2f6f52] px-5 py-5 text-white shadow-md">
        <p className="text-xs font-medium uppercase tracking-widest text-[#8fb8a6] mb-0.5">
          Return Transport
        </p>
        <h1 className="text-xl font-bold">{t("backhaul.title")}</h1>
        <p className="mt-1 text-sm text-[#d3e4dc]">
          Share a truck returning from the mandi — save on transport costs
        </p>
      </div>

      {/* Loading skeletons */}
      {loading && (
        <div className="flex flex-col gap-3">
          {[1, 2].map((i) => (
            <div key={i} className="skeleton h-36 w-full rounded-2xl" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !failed && trucks.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-10 text-center rounded-2xl border border-dashed border-[#d3e4dc] bg-white">
          <span className="text-5xl">🚛</span>
          <p className="text-base font-medium text-slate-700">No trucks available</p>
          <p className="text-sm text-slate-400">{t("backhaul.emptyState")}</p>
        </div>
      )}

      {/* Failed state */}
      {!loading && failed && (
        <div className="flex flex-col items-center gap-3 py-10 text-center rounded-2xl border border-dashed border-red-200 bg-red-50">
          <span className="text-5xl">📡</span>
          <p className="text-base font-medium text-slate-700">Couldn&apos;t load trucks</p>
          <p className="text-sm text-slate-500">Check your connection and try again.</p>
        </div>
      )}

      {/* Summary chip */}
      {!loading && trucks.length > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-[#d3e4dc] bg-[#eef4f1] px-4 py-2.5">
          <span className="text-lg">🚚</span>
          <span className="text-sm font-semibold text-[#1c4432]">
            {trucks.length} truck{trucks.length > 1 ? "s" : ""} departing from this mandi
          </span>
        </div>
      )}

      {/* Truck cards */}
      <div className="flex flex-col gap-3 pb-2">
        {trucks.map((truck) => {
          const dep = formatDeparture(truck.departure_time);
          const cap = capacityColor(truck.available_capacity_kg);
          const capPercent = Math.min(100, Math.round((truck.available_capacity_kg / 10000) * 100));

          return (
            <div
              key={truck.id}
              className="overflow-hidden rounded-2xl border border-[#d3e4dc] bg-white shadow-sm fade-up"
            >
              {/* Top: truck number + destination */}
              <div className="flex items-center justify-between border-b border-[#eef4f1] px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🚚</span>
                  <span className="font-bold text-slate-800 text-sm">{truck.truck_number}</span>
                </div>
                <div className="flex items-center gap-1 rounded-full bg-[#eef4f1] px-3 py-1 text-xs font-semibold text-[#1c4432]">
                  <span>→</span>
                  <span>{truck.to_village}</span>
                </div>
              </div>

              <div className="px-4 py-4">
                {/* Departure info */}
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex flex-col items-center justify-center rounded-xl bg-[#f4f6f5] border border-[#d3e4dc] px-3 py-2 min-w-[60px] text-center">
                    <span className="text-lg font-bold text-[#1c4432] leading-none">{dep.time}</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">{dep.date}</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {t("backhaul.departureLabel")}
                    </p>
                    <p className="text-sm font-medium text-slate-700">{dep.date} at {dep.time}</p>
                  </div>
                </div>

                {/* Capacity bar */}
                <div className={`mb-3 rounded-xl px-3 py-2 ${cap.bg}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-xs font-semibold ${cap.text}`}>
                      {t("backhaul.capacityLabel")}
                    </span>
                    <span className={`text-sm font-bold ${cap.text}`}>
                      {truck.available_capacity_kg >= 1000
                        ? `${(truck.available_capacity_kg / 1000).toFixed(1)}t`
                        : `${truck.available_capacity_kg}kg`}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-white/60 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${cap.bar} transition-all`}
                      style={{ width: `${capPercent}%` }}
                    />
                  </div>
                </div>

                {/* Call CTA */}
                <a
                  href={`tel:${truck.contact_number}`}
                  className="flex items-center justify-center gap-2 min-h-[44px] rounded-xl bg-[#2f6f52] text-sm font-semibold text-white transition hover:bg-[#255a42] active:scale-95"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                  </svg>
                  {t("backhaul.callToCoordinate")}
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
