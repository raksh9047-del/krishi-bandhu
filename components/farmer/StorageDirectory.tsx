"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import type { StorageFacility } from "@/types";

const TYPE_CONFIG: Record<string, { label: string; icon: string; bg: string; text: string }> = {
  cold_storage: {
    label: "Cold Storage",
    icon: "🧊",
    bg: "bg-sky-50",
    text: "text-sky-700",
  },
  fpo_warehouse: {
    label: "FPO Warehouse",
    icon: "🏭",
    bg: "bg-orange-50",
    text: "text-orange-700",
  },
};

export function StorageDirectory() {
  const { t } = useTranslation();
  const [facilities, setFacilities] = useState<StorageFacility[]>([]);
  const [hasReference, setHasReference] = useState(false);
  const [districtQuery, setDistrictQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | StorageFacility["facility_type"]>("all");
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);

    // Read via /api/storage/list rather than the anon client — the table's RLS
    // grants only `authenticated`, which this pilot never has in the browser,
    // so a direct read comes back empty.
    fetch("/api/storage/list")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("bad response"))))
      .then((data: { facilities: StorageFacility[]; has_reference: boolean }) => {
        if (!cancelled) {
          setFacilities(data.facilities);
          setHasReference(data.has_reference);
        }
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
  }, []);

  const filtered = facilities.filter((f) => {
    const matchesDistrict = f.district.toLowerCase().includes(districtQuery.trim().toLowerCase());
    const matchesType = typeFilter === "all" || f.facility_type === typeFilter;
    return matchesDistrict && matchesType;
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Page header */}
      <div className="rounded-2xl bg-gradient-to-br from-[#375879] to-[#243c53] px-5 py-5 text-white shadow-md">
        <p className="text-xs font-medium uppercase tracking-widest text-[#9fb4c7] mb-0.5">
          Storage &amp; Warehouses
        </p>
        <h1 className="text-xl font-bold">{t("storageDirectory.title")}</h1>
        <p className="mt-1 text-sm text-[#9fb4c7]">
          Find cold storage &amp; FPO warehouses near you
        </p>
      </div>

      {/* Search + facility type filter */}
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
          </svg>
        </span>
        <input
          value={districtQuery}
          onChange={(e) => setDistrictQuery(e.target.value)}
          placeholder={t("storageDirectory.searchPlaceholder")}
          className="w-full min-h-[44px] rounded-xl border border-[#d3e4dc] bg-white pl-10 pr-4 text-sm text-slate-800 shadow-sm focus:border-[#375879] focus:ring-1 focus:ring-[#375879] transition"
        />
        {districtQuery && (
          <button
            onClick={() => setDistrictQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        )}
      </div>

      {/* Facility type filter */}
      <div className="flex gap-1.5">
        {(["all", "cold_storage", "fpo_warehouse"] as const).map((type) => (
          <button
            key={type}
            onClick={() => setTypeFilter(type)}
            className={[
              "min-h-[38px] rounded-xl border px-3 text-xs font-semibold transition flex-1",
              typeFilter === type
                ? "border-[#2f6f52] bg-[#2f6f52] text-white"
                : "border-[#d3e4dc] bg-white text-slate-600 hover:bg-[#f4f6f5]",
            ].join(" ")}
          >
            {type === "all" ? "All" : TYPE_CONFIG[type]?.label ?? type}
          </button>
        ))}
      </div>

      {/* Stats row */}
      {!loading && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-center">
            <p className="text-2xl font-bold text-sky-700">
              {facilities.filter((f) => f.facility_type === "cold_storage").length}
            </p>
            <p className="text-xs text-sky-600 font-medium mt-0.5">🧊 Cold Storage</p>
          </div>
          <div className="rounded-xl border border-orange-100 bg-orange-50 px-4 py-3 text-center">
            <p className="text-2xl font-bold text-orange-700">
              {facilities.filter((f) => f.facility_type !== "cold_storage").length}
            </p>
            <p className="text-xs text-orange-600 font-medium mt-0.5">🏭 FPO Warehouses</p>
          </div>
        </div>
      )}

      {hasReference && !loading && (
        <p className="text-xs text-slate-400">
          Showing sample reference facilities — live listings appear once the storage directory is seeded.
        </p>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-28 w-full rounded-2xl" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !failed && filtered.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="text-5xl">🔍</span>
          <p className="text-base font-medium text-slate-700">No facilities found</p>
          <p className="text-sm text-slate-400">{t("storageDirectory.emptyState")}</p>
          {districtQuery && (
            <button
              onClick={() => setDistrictQuery("")}
              className="mt-1 rounded-xl bg-[#2f6f52] px-4 py-2 text-sm font-semibold text-white"
            >
              Clear search
            </button>
          )}
        </div>
      )}

      {/* Failed state */}
      {!loading && failed && (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="text-5xl">📡</span>
          <p className="text-base font-medium text-slate-700">Couldn&apos;t load facilities</p>
          <p className="text-sm text-slate-500">Check your connection and try again.</p>
        </div>
      )}

      {/* Facility cards */}
      <div className="flex flex-col gap-3 pb-2">
        {filtered.map((facility) => {
          const typeCfg = TYPE_CONFIG[facility.facility_type] ?? TYPE_CONFIG.fpo_warehouse;
          return (
            <div
              key={facility.id}
              className="overflow-hidden rounded-2xl border border-[#d3e4dc] bg-white shadow-sm fade-up"
            >
              {/* Facility type banner */}
              <div className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold ${typeCfg.bg} ${typeCfg.text}`}>
                <span>{typeCfg.icon}</span>
                {typeCfg.label}
              </div>

              <div className="px-4 py-4">
                <h3 className="text-base font-bold text-slate-800">{facility.facility_name}</h3>

                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <span>📍</span>{facility.district}
                  </span>
                  <span className="flex items-center gap-1">
                    <span>📦</span>
                    {t("storageDirectory.capacityLabel")}: {facility.approx_capacity_tons} tons
                  </span>
                </div>

                <a
                  href={`tel:${facility.contact_number}`}
                  className="mt-3 flex items-center justify-center gap-2 min-h-[44px] rounded-xl bg-[#2f6f52] text-sm font-semibold text-white transition hover:bg-[#255a42] active:scale-95"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                  </svg>
                  {t("common.call")} Facility
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
