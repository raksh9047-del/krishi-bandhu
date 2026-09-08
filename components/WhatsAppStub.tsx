"use client";

import { useTranslation } from "@/lib/i18n";
import { StatusBadge } from "@/components/StatusBadge";

/**
 * WhatsApp routing stub (Phase 8, Part 7). Chat-header banner with a disabled
 * input. The real WhatsApp Business API integration lands in Phase 2 pending
 * Meta approval — this never fakes success, it just explains where things
 * stand and refuses input (per the "one rule that never bends").
 */
export function WhatsAppStub() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-3 rounded-card border border-slate-300 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-lg font-medium text-slate-900">{t("whatsapp.title")}</span>
        <StatusBadge
          status="comingSoon"
          label={t("whatsapp.comingSoon")}
          tooltip={t("whatsapp.tooltip")}
        />
      </div>
      <p className="text-base text-slate-600">{t("whatsapp.description")}</p>
      <div className="flex items-center gap-2 rounded-card border border-slate-300 bg-slate-50 p-3">
        <span className="flex-1 text-base text-slate-500">{t("whatsapp.inputPlaceholder")}</span>
        <button
          type="button"
          disabled
          className="min-h-touch rounded-card bg-slate-300 px-4 text-base text-slate-600 disabled:opacity-60"
        >
          {t("whatsapp.send")}
        </button>
      </div>
    </div>
  );
}