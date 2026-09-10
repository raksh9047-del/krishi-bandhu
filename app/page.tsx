"use client";

export const dynamic = "force-dynamic";

import { SowingSignalCard } from "@/components/farmer/SowingSignalCard";
import { LivePriceDashboard } from "@/components/farmer/LivePriceDashboard";
import { NetRealizationCalculator } from "@/components/farmer/NetRealizationCalculator";
import { MultiMandiComparison } from "@/components/farmer/MultiMandiComparison";
import { AlertsPanel } from "@/components/farmer/AlertsPanel";
import { useTranslation } from "@/lib/i18n";

/**
 * The farmer home screen — the three numbers that matter most, per the spec:
 * the Sowing Signal (should I even plant this?), today's market price (with
 * its provenance), and the Net Realization estimate (what will I actually
 * take home if I sell today?).
 */
export default function Home() {
  const { t } = useTranslation();
  const hour = new Date().getHours();
  const greetingKey = hour < 12 ? "home.greetingMorning" : hour < 17 ? "home.greetingAfternoon" : "home.greetingEvening";

  return (
    <div className="grid grid-cols-1 gap-4 pt-1 lg:grid-cols-2 lg:gap-6">
      {/* Greeting hero */}
      <div className="rounded-2xl bg-gradient-to-br from-[#2f6f52] to-[#1c4432] px-5 py-5 text-white shadow-md lg:col-span-2 lg:px-6 lg:py-7">
        <p className="text-xs font-medium uppercase tracking-widest text-[#8fb8a6] mb-0.5">
          {t(greetingKey)} 🌾
        </p>
        <h1 className="text-xl font-bold leading-tight lg:text-2xl">{t("home.dashboardTitle")}</h1>
        <p className="mt-1 text-sm text-[#d3e4dc]">
          {t("home.dashboardSubtitle")}
        </p>
      </div>

      {/* Voice assistant hint — large, visible for first-time / low-literacy users */}
      <div className="lg:col-span-2 flex items-center gap-3 rounded-2xl border border-trust-200 bg-trust-50/60 px-4 py-3 text-sm text-trust-700">
        <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 shrink-0 text-trust-500" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="22" />
        </svg>
        <p>{t("voice.hint")}</p>
      </div>

      <SowingSignalCard />
      <LivePriceDashboard />
      <AlertsPanel />
      <NetRealizationCalculator />
      <MultiMandiComparison />
    </div>
  );
}