"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAppStore } from "@/store/useAppStore";
import { useTranslation } from "@/lib/i18n";
import type { SowingSignal } from "@/types";

type ViewState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "no_signal" }
  | { status: "ready"; signal: SowingSignal };

const SIGNAL_CONFIG: Record<
  string,
  { bg: string; border: string; text: string; icon: string; label: string; pill: string }
> = {
  green: {
    bg: "bg-[#edf7f1]",
    border: "border-[#2f8f4e]",
    text: "text-[#1a5c30]",
    icon: "✅",
    label: "Good to Sow",
    pill: "bg-[#2f8f4e] text-white",
  },
  yellow: {
    bg: "bg-amber-50",
    border: "border-amber-400",
    text: "text-amber-800",
    icon: "⚠️",
    label: "Moderate Risk",
    pill: "bg-amber-400 text-white",
  },
  red: {
    bg: "bg-red-50",
    border: "border-red-400",
    text: "text-red-800",
    icon: "🚫",
    label: "High Risk",
    pill: "bg-red-500 text-white",
  },
};

export function SowingSignalCard() {
  const selectedCropId = useAppStore((s) => s.selectedCropId);
  const selectedMandiId = useAppStore((s) => s.selectedMandiId);
  const { t } = useTranslation();
  const [state, setState] = useState<ViewState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });

    // Read through the server route (/api/sowing-signal) rather than the anon
    // client — the table's RLS is scoped to `authenticated`, which the pilot
    // never has, so a direct client read always comes back empty.
    fetch(`/api/sowing-signal?crop_id=${selectedCropId}&mandi_id=${selectedMandiId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("bad response"))))
      .then((data) => {
        if (cancelled) return;
        if (!data.signal) setState({ status: "no_signal" });
        else setState({ status: "ready", signal: data.signal as SowingSignal });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [selectedCropId, selectedMandiId]);

  return (
    <div className="overflow-hidden rounded-2xl border border-[#d3e4dc] bg-white shadow-sm fade-up">
      {/* Card header */}
      <div className="flex items-center gap-2 border-b border-[#eef4f1] px-4 py-3">
        <span className="text-lg">🌱</span>
        <h2 className="font-semibold text-slate-800">{t("sowingSignal.title")}</h2>
      </div>

      <div className="px-4 py-4">
        {state.status === "loading" && (
          <div className="skeleton h-20 w-full" aria-label={t("sowingSignal.loading")} />
        )}

        {state.status === "error" && (
          <div className="flex items-center justify-between rounded-xl bg-red-50 px-4 py-3">
            <span className="text-sm text-red-700">{t("sowingSignal.error")}</span>
            <button
              onClick={() => setState({ status: "loading" })}
              className="min-h-[36px] rounded-xl border border-red-300 bg-white px-3 text-sm font-medium text-red-700 transition hover:bg-red-50"
            >
              {t("sowingSignal.retry")}
            </button>
          </div>
        )}

        {state.status === "no_signal" && (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <span className="text-3xl">📡</span>
            <p className="text-sm text-slate-500">{t("sowingSignal.noSignalYet")}</p>
          </div>
        )}

        {state.status === "ready" && (() => {
          const cfg = SIGNAL_CONFIG[state.signal.signal_status] ?? SIGNAL_CONFIG.green;
          return (
            <div className={`rounded-xl border-2 ${cfg.border} ${cfg.bg} p-4`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{cfg.icon}</span>
                  <div>
                    <span className={`text-xs font-bold uppercase tracking-widest ${cfg.text}`}>
                      Sowing Signal
                    </span>
                    <p className={`text-base font-bold ${cfg.text}`}>{cfg.label}</p>
                  </div>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${cfg.pill}`}>
                  {state.signal.signal_status}
                </span>
              </div>
              <p className="mt-3 text-sm text-slate-600 leading-relaxed">
                {state.signal.reasoning_text}
              </p>
              {(state.signal.signal_status === "yellow" || state.signal.signal_status === "red") && (
                <Link
                  href="/storage"
                  className="mt-3 inline-flex items-center gap-1 rounded-xl bg-[#2f6f52] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#255a42]"
                >
                  <span>🏪</span>
                  {t("sowingSignal.viewStorageLink")}
                </Link>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
