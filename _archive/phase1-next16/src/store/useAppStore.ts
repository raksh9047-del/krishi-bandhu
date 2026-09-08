'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Crop, Mandi, Language } from '@/types';
import { DEFAULT_CROP_ID, DEFAULT_MANDI_ID } from '@/constants';

interface AppState {
  // Current context selection — switching these must re-trigger every dependent query app-wide.
  selectedCropId: Crop['id'];
  selectedMandiId: Mandi['id'];
  language: Language;

  // Setters
  setSelectedCrop: (cropId: Crop['id']) => void;
  setSelectedMandi: (mandiId: Mandi['id']) => void;
  setLanguage: (lang: Language) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      selectedCropId: DEFAULT_CROP_ID,
      selectedMandiId: DEFAULT_MANDI_ID,
      language: 'en',

      setSelectedCrop: (cropId) => set({ selectedCropId: cropId }),
      setSelectedMandi: (mandiId) => set({ selectedMandiId: mandiId }),
      setLanguage: (lang) => set({ language: lang }),
    }),
    {
      name: 'krishibandhu-app-store', // localStorage key
    }
  )
);
