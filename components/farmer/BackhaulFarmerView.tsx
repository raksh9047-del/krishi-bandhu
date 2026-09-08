"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { useTranslation } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import type { BackhaulTruck } from "@/types";

export function BackhaulFarmerView() {
  const selectedMandiId = useAppStore((s) => s.selectedMandiId);
  const { t } = useTranslation();
  const [trucks, setTrucks] = useState<BackhaulTruck[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supabase
      .from("backhaul_trucks")
      .select("*")
      .eq("from_mandi_id", selectedMandiId)
      .order("departure_time", { ascending: true })
      .then(({ data }) => {
        setTrucks((data ?? []) as BackhaulTruck[]);
        setLoading(false);
      });
  }, [selectedMandiId]);

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-slate-900">{t("backhaul.title")}</h2>

      {loading && <p className="text-base text-slate-500">{t("common.loading")}</p>}

      {!loading && trucks.length === 0 && <p className="text-base text-slate-500">{t("backhaul.emptyState")}</p>}

      <div className="flex flex-col gap-2">
        {trucks.map((truck) => (
          <div key={truck.id} className="rounded-card border border-slate-300 p-3">
            <p className="text-lg font-medium text-slate-900">{truck.truck_number} → {truck.to_village}</p>
            <p className="text-base text-slate-600">
              {t("backhaul.departureLabel")}: {new Date(truck.departure_time).toLocaleString()}
            </p>
            <p className="text-base text-slate-600">
              {t("backhaul.capacityLabel")}: {truck.available_capacity_kg}kg
            </p>
            <a
              href={`tel:${truck.contact_number}`}
              className="mt-2 inline-block min-h-touch rounded-card border border-trust-500 px-4 py-2 text-base font-medium text-trust-700"
            >
              {t("backhaul.callToCoordinate")}
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
