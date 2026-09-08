"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAppStore } from "@/store/useAppStore";
import { useTranslation } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import type { SowingSignal } from "@/types";

type ViewState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "no_signal" }
  | { status: "ready"; signal: SowingSignal };

const SIGNAL_STYLES: Record<string, string> = {
  green: "bg-signal-green/10 border-signal-green text-signal-green",
  yellow: "bg-signal-yellow/10 border-signal-yellow text-signal-yellow",
  red: "bg-signal-red/10 border-signal-red text-signal-red",
};

export function SowingSignalCard() {
  const selectedCropId = useAppStore((s) => s.selectedCropId);
  const selectedMandiId = useAppStore((s) => s.selectedMandiId);
  const { t } = useTranslation();
  const [state, setState] = useState<ViewState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });

    supabase
      .from("sowing_signals")
      .select("*")
      .eq("crop_id", selectedCropId)
      .eq("mandi_id", selectedMandiId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setState({ status: "error" });
        } else if (!data) {
          setState({ status: "no_signal" });
        } else {
          setState({ status: "ready", signal: data as SowingSignal });
        }
      });

    return () => {
      cancelled = true;
    };
    // Re-fetches whenever the ContextSwitcher changes crop/mandi — this is
    // the pattern every crop/mandi-scoped screen should follow.
  }, [selectedCropId, selectedMandiId]);

  return (
    <div className="rounded-card border border-slate-300 p-4">
      <h2 className="mb-2 text-lg font-semibold text-slate-900">{t("sowingSignal.title")}</h2>

      {state.status === "loading" && (
        <div className="h-16 animate-pulse rounded-card bg-slate-100" aria-label={t("sowingSignal.loading")} />
      )}

      {state.status === "error" && (
        <div className="flex items-center justify-between">
          <span className="text-base text-signal-red">{t("sowingSignal.error")}</span>
          <button
            onClick={() => setState({ status: "loading" })}
            className="min-h-touch rounded-card border border-slate-300 px-3 text-base"
          >
            {t("sowingSignal.retry")}
          </button>
        </div>
      )}

      {state.status === "no_signal" && (
        <p className="text-base text-slate-500">{t("sowingSignal.noSignalYet")}</p>
      )}

      {state.status === "ready" && (
        <div className={`rounded-card border p-3 ${SIGNAL_STYLES[state.signal.signal_status]}`}>
          <p className="text-lg font-semibold uppercase">{state.signal.signal_status}</p>
          <p className="mt-1 text-base text-slate-700">{state.signal.reasoning_text}</p>
          {(state.signal.signal_status === "yellow" || state.signal.signal_status === "red") && (
            <Link href="/storage" className="mt-2 inline-block text-base font-medium text-trust-600 underline">
              {t("sowingSignal.viewStorageLink")}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
