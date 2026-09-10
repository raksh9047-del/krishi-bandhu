"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { useTranslation } from "@/lib/i18n";
import type { FarmerAlert } from "@/types";

const severityStyles: Record<string, string> = {
  danger: "border-signal-red bg-signal-red/10 text-signal-red",
  warning: "border-signal-yellow/70 bg-signal-yellow/10 text-signal-yellow",
  info: "border-trust-300 bg-trust-50 text-trust-900",
};

const typeIcons: Record<string, string> = {
  parchi_recorded: "🧾",
  price_alert: "📈",
  sowing_alert: "🌱",
  arrival: "🚚",
  system: "🔔",
};

/**
 * Farmer alert inbox — recent alert messages (parchi confirmations, price /
 * sowing notices) with severity colors, an unread badge, and mark-all-read.
 * Renders nothing when the farmer is unsigned-in or the alerts table isn't
 * configured yet (migration 007 pending), so the rest of the dashboard never
 * breaks because of it.
 */
export function AlertsPanel() {
  const currentFarmerId = useAppStore((s) => s.currentFarmerId);
  const { t } = useTranslation();

  const [alerts, setAlerts] = useState<FarmerAlert[] | null>(null);
  const [marking, setMarking] = useState(false);

  async function load() {
    if (!currentFarmerId) {
      setAlerts(null);
      return;
    }
    try {
      const res = await fetch(`/api/alerts?farmer_id=${currentFarmerId}&limit=5`);
      if (res.status === 503) {
        setAlerts([]);
        return;
      }
      const data = await res.json();
      setAlerts(data.alerts ?? []);
    } catch {
      setAlerts((prev) => prev ?? []);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFarmerId]);

  async function markAllRead() {
    if (!currentFarmerId || marking) return;
    setMarking(true);
    try {
      await fetch("/api/alerts/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ farmer_id: currentFarmerId }),
      });
      await load();
    } finally {
      setMarking(false);
    }
  }

  if (!currentFarmerId || alerts === null) return null;

  const unread = alerts.filter((a) => !a.is_read).length;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">
          {t("alerts.title")}
          {unread > 0 && (
            <span className="ml-2 rounded-full bg-signal-red px-2 py-0.5 text-sm text-white">{unread}</span>
          )}
        </h2>
        {unread > 0 && (
          <button
            onClick={markAllRead}
            disabled={marking}
            className="text-base text-trust-600 underline disabled:opacity-50"
          >
            {t("alerts.markAllRead")}
          </button>
        )}
      </div>

      {alerts.length === 0 && <p className="text-base text-slate-500">{t("alerts.emptyState")}</p>}

      <div className="flex flex-col gap-2">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={`flex gap-2 rounded-card border p-3 ${
              severityStyles[alert.severity] ?? severityStyles.info
            } ${alert.is_read ? "opacity-70" : ""}`}
          >
            <span className="text-lg leading-none">{typeIcons[alert.type] ?? "🔔"}</span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{alert.title}</p>
              <p className="text-sm opacity-90">{alert.message}</p>
              <p className="mt-0.5 text-xs opacity-70">{new Date(alert.created_at).toLocaleString()}</p>
            </div>
            {!alert.is_read && <span className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full bg-signal-red" />}
          </div>
        ))}
      </div>
    </div>
  );
}