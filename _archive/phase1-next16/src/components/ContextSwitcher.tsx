'use client';

import { useAppStore } from '@/store/useAppStore';
import { CROPS, MANDIS } from '@/constants';
import type { Language } from '@/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'en', label: 'EN' },
  { value: 'mr', label: 'MR' },
  { value: 'hi', label: 'HI' },
];

/**
 * ContextSwitcher — the single most important UI element in KrishiBandhu.
 *
 * Sticky header with: crop dropdown + mandi dropdown + language toggle.
 * Switching crop or mandi re-triggers every dependent query app-wide.
 * Implementation: expose selectedCropId/selectedMandiId as query keys
 * that data-fetching hooks depend on (e.g. SWR/React Query key includes
 * both ids), so a store change auto-invalidates every dependent fetch.
 */
export function ContextSwitcher() {
  const { selectedCropId, selectedMandiId, language, setSelectedCrop, setSelectedMandi, setLanguage } =
    useAppStore();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
        {/* Brand */}
        <div className="mr-2 flex items-center gap-1.5 text-sm font-semibold text-trust-green">
          <span role="img" aria-hidden="true">🌱</span>
          <span className="hidden sm:inline">KrishiBandhu</span>
        </div>

        {/* Crop Selector */}
        <div className="flex items-center gap-1.5">
          <label htmlFor="crop-select" className="text-xs font-medium text-muted-foreground">
            Crop
          </label>
          <Select value={selectedCropId} onValueChange={setSelectedCrop}>
            <SelectTrigger id="crop-select" size="sm" className="w-[130px]">
              <SelectValue placeholder="Select crop" />
            </SelectTrigger>
            <SelectContent>
              {CROPS.map((crop) => (
                <SelectItem key={crop.id} value={crop.id}>
                  <span role="img" aria-hidden="true" className="mr-1">{crop.icon}</span>
                  {crop.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Mandi Selector */}
        <div className="flex items-center gap-1.5">
          <label htmlFor="mandi-select" className="text-xs font-medium text-muted-foreground">
            Mandi
          </label>
          <Select value={selectedMandiId} onValueChange={setSelectedMandi}>
            <SelectTrigger id="mandi-select" size="sm" className="w-[160px]">
              <SelectValue placeholder="Select mandi" />
            </SelectTrigger>
            <SelectContent>
              {MANDIS.map((mandi) => (
                <SelectItem key={mandi.id} value={mandi.id}>
                  {mandi.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Language Toggle */}
        <div className="flex items-center gap-1" role="radiogroup" aria-label="Language">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.value}
              type="button"
              role="radio"
              aria-checked={language === lang.value}
              onClick={() => setLanguage(lang.value)}
              className={`
                inline-flex h-9 min-w-[36px] items-center justify-center rounded-md
                px-2 text-xs font-medium transition-colors
                ${
                  language === lang.value
                    ? 'bg-trust-green text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }
              `}
            >
              {lang.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
