"use client";

import { useTranslation } from "@/lib/i18n";
import { GovAnalytics } from "@/components/government/GovAnalytics";

export default function GovernmentPage() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3 pt-2">
      <h1 className="text-xl font-semibold text-slate-900">{t("government.title")}</h1>
      <GovAnalytics />
    </div>
  );
}