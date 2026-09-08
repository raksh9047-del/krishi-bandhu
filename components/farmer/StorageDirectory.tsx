"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import type { StorageFacility } from "@/types";

export function StorageDirectory() {
  const { t } = useTranslation();
  const [facilities, setFacilities] = useState<StorageFacility[]>([]);
  const [districtQuery, setDistrictQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("storage_directory")
      .select("*")
      .then(({ data }) => {
        setFacilities((data ?? []) as StorageFacility[]);
        setLoading(false);
      });
  }, []);

  const filtered = facilities.filter((f) =>
    f.district.toLowerCase().includes(districtQuery.trim().toLowerCase())
  );

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-slate-900">{t("storageDirectory.title")}</h2>

      <input
        value={districtQuery}
        onChange={(e) => setDistrictQuery(e.target.value)}
        placeholder={t("storageDirectory.searchPlaceholder")}
        className="min-h-touch rounded-card border border-slate-300 px-3 text-lg"
      />

      {loading && <p className="text-base text-slate-500">{t("common.loading")}</p>}

      {!loading && filtered.length === 0 && (
        <p className="text-base text-slate-500">{t("storageDirectory.emptyState")}</p>
      )}

      <div className="flex flex-col gap-2">
        {filtered.map((facility) => (
          <div key={facility.id} className="rounded-card border border-slate-300 p-3">
            <p className="text-lg font-medium text-slate-900">{facility.facility_name}</p>
            <p className="text-base text-slate-600">
              {facility.district} · {facility.facility_type === "cold_storage" ? "Cold Storage" : "FPO Warehouse"}
            </p>
            <p className="text-base text-slate-600">
              {t("storageDirectory.capacityLabel")}: {facility.approx_capacity_tons} tons
            </p>
            <a
              href={`tel:${facility.contact_number}`}
              className="mt-2 inline-block min-h-touch rounded-card border border-trust-500 px-4 py-2 text-base font-medium text-trust-700"
            >
              {t("common.call")}
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
