"use client";

import dynamic from "next/dynamic";
import { useTranslation } from "@/lib/i18n";

const MandiHeatmap = dynamic(() => import("@/components/MandiHeatmap").then((m) => m.MandiHeatmap), { ssr: false });

export default function MapPage() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3 pt-2">
      <h1 className="text-xl font-semibold text-slate-900">{t("map.title")}</h1>
      <p className="text-base text-slate-600">{t("map.subtitle")}</p>
      <MandiHeatmap />
    </div>
  );
}