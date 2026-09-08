"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { useTranslation } from "@/lib/i18n";

/**
 * Pilot-scale identity gate for the FPO screens, mirroring how the farmer and
 * trader apps resolve their ids. Fetches the seeded demo FPO once via
 * /api/fpo/demo-user and caches it in the store; real Supabase Auth sessions
 * replace this in Phase 10.
 */
export function FpoIdentity({ children }: { children: React.ReactNode }) {
  const currentFpoId = useAppStore((s) => s.currentFpoId);
  const setCurrentFpoId = useAppStore((s) => s.setCurrentFpoId);
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (currentFpoId) return;
    let cancelled = false;

    fetch("/api/fpo/demo-user")
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) {
          if (!cancelled) setCurrentFpoId(data.fpo.id);
        } else if (!cancelled) {
          setError(data.message ?? t("fpo.identityError"));
        }
      })
      .catch(() => {
        if (!cancelled) setError(t("common.error"));
      });

    return () => {
      cancelled = true;
    };
  }, [currentFpoId, setCurrentFpoId, t]);

  if (currentFpoId) return <>{children}</>;

  return (
    <div className="rounded-card border border-slate-300 p-4 text-base text-slate-700">
      {error ? (
        <p className="text-signal-red">{error}</p>
      ) : (
        <p>{t("common.loading")}</p>
      )}
    </div>
  );
}