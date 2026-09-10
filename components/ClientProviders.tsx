/**
 * Client-only providers wrapper. Loaded via next/dynamic with ssr:false
 * so that the Zustand store (which uses useSyncExternalStoreWithSelector)
 * doesn't try to run during server-side rendering — that's what caused
 * the "o is not a function" prerender error on /.
 *
 * The SessionProvider needs localStorage + useRouter, both of which are
 * browser-only. Wrapping it here also keeps the root layout SSR-safe.
 */

"use client";

import { ReactNode } from "react";
import { LanguageProvider } from "@/components/LanguageProvider";
import { SessionProvider } from "@/components/auth/SessionProvider";
import { ContextSwitcher } from "@/components/ContextSwitcher";
import { BottomNav } from "@/components/BottomNav";
import { VoiceAssistant } from "@/components/VoiceAssistant";

export default function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <LanguageProvider>
      <SessionProvider>
        <ContextSwitcher />
        <main className="mx-auto w-full max-w-lg flex-1 px-3 pb-24 pt-4 lg:max-w-6xl lg:px-6 lg:pb-10 lg:pt-6">
          {children}
        </main>
        <BottomNav />
        <VoiceAssistant />
      </SessionProvider>
    </LanguageProvider>
  );
}