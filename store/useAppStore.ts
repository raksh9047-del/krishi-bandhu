import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Language } from "@/types";
import { CROPS, MANDIS } from "@/constants";

interface AppState {
  selectedCropId: string;
  selectedMandiId: string;
  language: Language;
  /**
   * Set once by FarmerRegistration on success. This is a pilot-scale stand-in
   * for a real session — a production build should replace this with actual
   * Supabase Auth session state (see the Phase 10 hardening note in
   * lib/supabase-admin.ts about forwarding user sessions to API routes).
   */
  currentFarmerId: string | null;
  currentTraderId: string | null;
  currentFpoId: string | null;
  setSelectedCropId: (id: string) => void;
  setSelectedMandiId: (id: string) => void;
  setLanguage: (lang: Language) => void;
  setCurrentFarmerId: (id: string | null) => void;
  setCurrentTraderId: (id: string | null) => void;
  setCurrentFpoId: (id: string | null) => void;
}

/**
 * The single most important piece of shared state in the product. Every
 * later screen that fetches crop/mandi-scoped data should key its data-fetch
 * hook (SWR/React Query key, or a useEffect dependency array) on
 * [selectedCropId, selectedMandiId] so switching the ContextSwitcher
 * auto-invalidates and refetches — screens should not need to manually
 * subscribe to this store just to trigger a refetch.
 */
export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      selectedCropId: CROPS[0].id,
      selectedMandiId: MANDIS[0].id,
      language: "en",
      currentFarmerId: null,
      currentTraderId: null,
      currentFpoId: null,
      setSelectedCropId: (id) => set({ selectedCropId: id }),
      setSelectedMandiId: (id) => set({ selectedMandiId: id }),
      setLanguage: (lang) => set({ language: lang }),
      setCurrentFarmerId: (id) => set({ currentFarmerId: id }),
      setCurrentTraderId: (id) => set({ currentTraderId: id }),
      setCurrentFpoId: (id) => set({ currentFpoId: id }),
    }),
    { name: "krishibandhu-app-store" }
  )
);
