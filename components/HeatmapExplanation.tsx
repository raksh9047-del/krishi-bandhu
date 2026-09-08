"use client";

import { useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { useTranslation } from "@/lib/i18n";
import type { Language } from "@/types";

const LANGUAGES: { code: Language; label: string }[] = [
  { code: "en", label: "English" },
  { code: "mr", label: "मराठी" },
  { code: "hi", label: "हिन्दी" },
];

interface ExplanationBlockProps {
  icon: string;
  tone: string;
  title: string;
  lines: string[];
}

function ExplanationBlock({ icon, tone, title, lines }: ExplanationBlockProps) {
  return (
    <div className={`rounded-card border p-3 ${tone}`}>
      <p className="text-base font-semibold">
        <span className="mr-2">{icon}</span>
        {title}
      </p>
      <ul className="mt-1 flex flex-col gap-1 text-base text-slate-700">
        {lines.map((line) => (
          <li key={line} className="flex gap-2">
            <span aria-hidden="true">•</span>
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HeatmapExplanation() {
  const [open, setOpen] = useState(false);
  const language = useAppStore((s) => s.language);
  const setLanguage = useAppStore((s) => s.setLanguage);
  const { t } = useTranslation();

  return (
    <div className="rounded-card border border-slate-300 bg-white p-4 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-touch w-full items-center justify-between gap-2 text-lg font-bold text-slate-900"
      >
        <span>{t("heatmapGuide.open")}</span>
        <span className="text-trust-600" aria-hidden="true">
          {open ? "−" : "+"}
        </span>
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-4">
          <div role="group" aria-label="Explanation language" className="flex overflow-hidden rounded-card border border-slate-300">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => setLanguage(l.code)}
                aria-pressed={language === l.code}
                className={[
                  "min-h-touch flex-1 px-2 text-base font-medium",
                  language === l.code ? "bg-trust-500 text-white" : "bg-white text-slate-700",
                ].join(" ")}
              >
                {l.label}
              </button>
            ))}
          </div>

          <div>
            <h3 className="text-lg font-bold text-slate-900">{t("heatmapGuide.title")}</h3>
            <p className="mt-1 text-base text-slate-600">{t("heatmapGuide.description")}</p>
          </div>

          <div className="flex flex-col gap-2">
            <h4 className="text-base font-semibold text-slate-900">{t("heatmapGuide.signalsTitle")}</h4>
            <ExplanationBlock
              icon="🟢"
              tone="border-signal-green bg-signal-green/10 text-signal-green"
              title={t("heatmapGuide.greenTitle")}
              lines={[t("heatmapGuide.greenDesc1"), t("heatmapGuide.greenDesc2"), t("heatmapGuide.greenDesc3")]}
            />
            <ExplanationBlock
              icon="🟡"
              tone="border-signal-yellow bg-signal-yellow/10 text-signal-yellow"
              title={t("heatmapGuide.yellowTitle")}
              lines={[t("heatmapGuide.yellowDesc1"), t("heatmapGuide.yellowDesc2"), t("heatmapGuide.yellowDesc3")]}
            />
            <ExplanationBlock
              icon="🔴"
              tone="border-signal-red bg-signal-red/10 text-signal-red"
              title={t("heatmapGuide.redTitle")}
              lines={[t("heatmapGuide.redDesc1"), t("heatmapGuide.redDesc2"), t("heatmapGuide.redDesc3")]}
            />
          </div>

          <div className="flex flex-col gap-1">
            <h4 className="text-base font-semibold text-slate-900">{t("heatmapGuide.otherTitle")}</h4>
            <ul className="flex flex-col gap-1 text-base text-slate-700">
              {[t("heatmapGuide.liveMandi"), t("heatmapGuide.pilotMandi"), t("heatmapGuide.notCovered")].map((item) => (
                <li key={item} className="flex gap-2">
                  <span aria-hidden="true">●</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}