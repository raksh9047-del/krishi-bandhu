"use client";

import { useAppStore } from "@/store/useAppStore";
import { CROPS, MANDIS } from "@/constants";
import type { Language } from "@/types";

const LANGUAGES: { code: Language; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "mr", label: "मर" },
  { code: "hi", label: "हि" },
];

/**
 * The single most important UI element in the product. Every screen that
 * shows crop/mandi-scoped data must derive its data from this store's
 * selectedCropId/selectedMandiId — never keep a local copy of "which crop is
 * selected" that can drift out of sync with this header.
 */
export function ContextSwitcher() {
  const { selectedCropId, selectedMandiId, language, setSelectedCropId, setSelectedMandiId, setLanguage } =
    useAppStore();

  return (
    <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-slate-300 bg-white px-3 py-2 shadow-sm">
      <select
        value={selectedCropId}
        onChange={(e) => setSelectedCropId(e.target.value)}
        aria-label="Selected crop"
        className="min-h-touch flex-1 rounded-card border border-slate-300 bg-white px-2 text-base text-slate-900"
      >
        {CROPS.map((crop) => (
          <option key={crop.id} value={crop.id}>
            {crop.name}
          </option>
        ))}
      </select>

      <select
        value={selectedMandiId}
        onChange={(e) => setSelectedMandiId(e.target.value)}
        aria-label="Selected mandi"
        className="min-h-touch flex-1 rounded-card border border-slate-300 bg-white px-2 text-base text-slate-900"
      >
        {MANDIS.map((mandi) => (
          <option key={mandi.id} value={mandi.id}>
            {mandi.name}
          </option>
        ))}
      </select>

      <div role="group" aria-label="Language" className="flex overflow-hidden rounded-card border border-slate-300">
        {LANGUAGES.map((l) => (
          <button
            key={l.code}
            type="button"
            onClick={() => setLanguage(l.code)}
            aria-pressed={language === l.code}
            className={[
              "min-h-touch min-w-touch px-2 text-base font-medium",
              language === l.code ? "bg-trust-500 text-white" : "bg-white text-slate-700",
            ].join(" ")}
          >
            {l.label}
          </button>
        ))}
      </div>
    </header>
  );
}
