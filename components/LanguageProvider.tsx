"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";

/**
 * Syncs the HTML `lang` attribute with the user's selected language from the
 * Zustand store. This runs on the client because the layout is a Server
 * Component and can't read client-side state.
 */
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const language = useAppStore((s) => s.language);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return <>{children}</>;
}
