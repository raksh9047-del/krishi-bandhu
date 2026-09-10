"use client";

import Link from "next/link";
import { useTranslation } from "@/lib/i18n";

/**
 * Data Hub — the entry point to every data / government / FPO screen.
 */
const LINKS = [
  {
    href: "/map",
    icon: "🗺️",
    titleKey: "mapTitle",
    descKey: "mapDesc",
    color: "from-[#375879] to-[#243c53]",
    badge: "Mandi Map",
  },
  {
    href: "/government",
    icon: "🏛️",
    titleKey: "governmentTitle",
    descKey: "governmentDesc",
    color: "from-[#5a3f6b] to-[#3d2a4a]",
    badge: "Gov Schemes",
  },
  {
    href: "/fpo/prices",
    icon: "₹",
    titleKey: "fpoPricesTitle",
    descKey: "fpoPricesDesc",
    color: "from-[#2f6f52] to-[#1c4432]",
    badge: "FPO Prices",
  },
  {
    href: "/fpo/survey",
    icon: "📋",
    titleKey: "fpoSurveyTitle",
    descKey: "fpoSurveyDesc",
    color: "from-[#c98a12] to-[#9a6800]",
    badge: "Survey",
  },
  {
    href: "/fpo/backhaul",
    icon: "🚚",
    titleKey: "fpoBackhaulTitle",
    descKey: "fpoBackhaulDesc",
    color: "from-[#2f6f52] to-[#375879]",
    badge: "FPO",
  },
  {
    href: "/fpo/epo",
    icon: "👁️",
    title: "EPO Price Observation",
    desc: "Record an observed mandi price — an independent, farmer-visible source.",
    color: "from-[#c2410c] to-[#9a3412]",
    badge: "FPO",
  },
  {
    href: "/markets",
    icon: "🏪",
    title: "Mandi Directory",
    desc: "Browse APMCs & private mandis, and suggest one that's missing.",
    color: "from-[#0f766e] to-[#115e59]",
    badge: "Markets",
  },
] as const;

type DataLink =
  | { href: string; icon: string; titleKey: string; descKey: string; color: string; badge: string }
  | { href: string; icon: string; title: string; desc: string; color: string; badge: string }
  ;

export function DataHub() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4">
      {/* Page header */}
      <div className="rounded-2xl bg-gradient-to-br from-[#243c53] to-[#375879] px-5 py-5 text-white shadow-md">
        <p className="text-xs font-medium uppercase tracking-widest text-[#9fb4c7] mb-0.5">
          Information Hub
        </p>
        <h1 className="text-xl font-bold">{t("dataHub.title")}</h1>
        <p className="mt-1 text-sm text-[#9fb4c7]">{t("dataHub.subtitle")}</p>
      </div>

      {/* Grid of feature cards */}
      <div className="flex flex-col gap-3">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="group flex items-center gap-4 overflow-hidden rounded-2xl border border-[#d3e4dc] bg-white shadow-sm transition hover:shadow-md hover:border-[#8fb8a6] active:scale-[0.99] fade-up"
          >
            {/* Coloured icon block */}
            <div className={`flex h-full min-w-[68px] flex-shrink-0 items-center justify-center bg-gradient-to-br ${link.color} py-5`}>
              <span className="text-2xl">{link.icon}</span>
            </div>

            {/* Text */}
            <div className="flex-1 py-4 pr-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-800">
                  {"title" in link ? link.title : t(`dataHub.${link.titleKey}`)}
                </span>
                <span className="rounded-full bg-[#eef4f1] px-2 py-0.5 text-[10px] font-semibold text-[#1c4432]">
                  {link.badge}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">
                {"desc" in link ? link.desc : t(`dataHub.${link.descKey}`)}
              </p>
            </div>

            {/* Chevron */}
            <div className="pr-4 text-slate-300 group-hover:text-[#2f6f52] transition-colors">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick access shortcuts */}
      <div className="rounded-2xl border border-[#d3e4dc] bg-white p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Quick Access
        </p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { href: "/register", icon: "📝", label: "Register" },
            { href: "/trader", icon: "🤝", label: "Trader" },
            { href: "/map", icon: "🗺️", label: "Map" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-1.5 rounded-xl border border-[#d3e4dc] bg-[#f4f6f5] py-3 text-xs font-semibold text-slate-600 transition hover:bg-[#eef4f1] hover:text-[#1c4432]"
            >
              <span className="text-xl">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}