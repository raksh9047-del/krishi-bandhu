"use client";

import { useAppStore } from "@/store/useAppStore";
import { CROPS, MANDIS } from "@/constants";
import type { Language } from "@/types";
import { useSession } from "@/components/auth/SessionProvider";
import { DesktopNav } from "@/components/DesktopNav";
import Link from "next/link";

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
function SessionIndicator() {
  const { session, isLoading, logout } = useSession();
  if (isLoading) return null;
  if (!session) {
    return (
      <Link href="/login" className="rounded-lg bg-[#2f6f52] px-2.5 py-1 text-xs font-semibold text-white">
        Sign in
      </Link>
    );
  }
  return (
    <button
      onClick={logout}
      title={`Signed in as ${session.name} (${session.role})`}
      className="rounded-lg border border-[#d3e4dc] bg-[#f4f6f5] px-2.5 py-1 text-xs font-semibold text-[#1c4432] hover:bg-[#eef4f1]"
    >
      {session.role === "trader" ? "🏪" : "🌾"} {session.name.split(" ")[0]}
    </button>
  );
}

export function ContextSwitcher() {
  const { selectedCropId, selectedMandiId, language, setSelectedCropId, setSelectedMandiId, setLanguage } =
    useAppStore();

  return (
    <header className="sticky top-0 z-30 border-b border-[#d3e4dc] bg-white shadow-[0_1px_8px_rgba(47,111,82,0.08)]">
      {/* Brand strip */}
      <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-3 py-2 lg:px-6">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#2f6f52]">
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-white" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2C7 2 3 7 3 12s4 10 9 10 9-4.477 9-10S17 2 12 2z" />
            <path d="M12 12 C10 8 6 7 5 9" />
            <path d="M12 12 C14 8 18 7 19 9" />
            <path d="M12 12v7" />
          </svg>
        </div>
        <span className="font-semibold text-[#1c4432] text-sm tracking-wide">KrishiBandhu</span>
        <SessionIndicator />
      </div>

      {/* Crop + Mandi + Language row */}
      <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-3 py-2 lg:px-6">
        <div className="relative flex-1 lg:max-w-sm">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#2f6f52]">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M10 2a8 8 0 100 16A8 8 0 0010 2zm0 14a6 6 0 110-12 6 6 0 010 12z" opacity=".2"/>
              <path fillRule="evenodd" d="M10 1a9 9 0 100 18A9 9 0 0010 1zm-1 4a1 1 0 112 0v4.586l2.707 2.707a1 1 0 01-1.414 1.414l-3-3A1 1 0 019 10V5z" clipRule="evenodd" opacity="0"/>
              <path d="M10 2C6.686 2 4 4.686 4 8c0 4.5 6 10 6 10s6-5.5 6-10c0-3.314-2.686-6-6-6zm0 8.5A2.5 2.5 0 1110 5.5a2.5 2.5 0 010 5z"/>
            </svg>
          </span>
          <select
            value={selectedCropId}
            onChange={(e) => setSelectedCropId(e.target.value)}
            aria-label="Selected crop"
            className="w-full min-h-[40px] rounded-xl border border-[#d3e4dc] bg-[#f4f6f5] pl-8 pr-2 text-sm font-medium text-slate-800 appearance-none focus:border-[#2f6f52] focus:ring-1 focus:ring-[#2f6f52] transition-colors"
          >
            {CROPS.map((crop) => (
              <option key={crop.id} value={crop.id}>
                {crop.name}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
              <path d="M4.5 6L8 9.5 11.5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
          </span>
        </div>

        <div className="relative flex-1 lg:max-w-sm">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#375879]">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd"/>
            </svg>
          </span>
          <select
            value={selectedMandiId}
            onChange={(e) => setSelectedMandiId(e.target.value)}
            aria-label="Selected mandi"
            className="w-full min-h-[40px] rounded-xl border border-[#d3e4dc] bg-[#f4f6f5] pl-8 pr-2 text-sm font-medium text-slate-800 appearance-none focus:border-[#375879] focus:ring-1 focus:ring-[#375879] transition-colors"
          >
            {MANDIS.map((mandi) => (
              <option key={mandi.id} value={mandi.id}>
                {mandi.name}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
              <path d="M4.5 6L8 9.5 11.5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
          </span>
        </div>

        <div role="group" aria-label="Language" className="flex overflow-hidden rounded-xl border border-[#d3e4dc] bg-[#f4f6f5]">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => setLanguage(l.code)}
              aria-pressed={language === l.code}
              className={[
                "min-h-[40px] min-w-[36px] px-2 text-xs font-semibold transition-colors",
                language === l.code
                  ? "bg-[#2f6f52] text-white"
                  : "text-slate-600 hover:bg-[#eef4f1]",
              ].join(" ")}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <DesktopNav />
    </header>
  );
}
