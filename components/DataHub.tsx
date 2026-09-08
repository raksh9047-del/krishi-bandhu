"use client";

import Link from "next/link";
import { useTranslation } from "@/lib/i18n";

/**
 * Data Hub (Phase 8) — the entry point to every data / government / FPO
 * screen the build adds. Kept as a plain client component so it reads the
 * active language like every other screen.
 */
const LINKS = [
  { href: "/map", icon: "🗺️", titleKey: "mapTitle", descKey: "mapDesc" },
  { href: "/government", icon: "🏛️", titleKey: "governmentTitle", descKey: "governmentDesc" },
  { href: "/fpo/prices", icon: "₹", titleKey: "fpoPricesTitle", descKey: "fpoPricesDesc" },
  { href: "/fpo/survey", icon: "📋", titleKey: "fpoSurveyTitle", descKey: "fpoSurveyDesc" },
  { href: "/fpo/backhaul", icon: "🚚", titleKey: "fpoBackhaulTitle", descKey: "fpoBackhaulDesc" },
] as const;

export function DataHub() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{t("dataHub.title")}</h1>
        <p className="text-base text-slate-600">{t("dataHub.subtitle")}</p>
      </div>

      <div className="flex flex-col gap-3">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex flex-col gap-1 rounded-card border border-slate-300 p-4"
          >
            <span className="flex items-center gap-2 text-lg font-medium text-slate-900">
              <span aria-hidden="true">{link.icon}</span>
              {t(`dataHub.${link.titleKey}`)}
            </span>
            <span className="text-base text-slate-600">{t(`dataHub.${link.descKey}`)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}