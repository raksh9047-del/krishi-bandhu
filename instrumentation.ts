/**
 * KrishiBandhu — process-level instrumentation hook.
 *
 * Runs once when the Next.js server boots (dev and self-hosted `next start`).
 * Installs a daily price-sync timer for non-Vercel deployments: at 05:30 IST
 * it refreshes the live Agmarknet rows and the NOT-LIVE reference medians so
 * market prices stay current without anyone hitting the sync endpoint.
 *
 * On Vercel this module does nothing — scheduling there happens through the
 * crons in vercel.json, which call GET /api/prices/sync (verified by the
 * x-vercel-cron header against CRON_SECRET). The two paths never overlap.
 */

const SYNC_HOUR = 5;
const SYNC_MINUTE = 30;

function msUntilNextSync(now: Date): number {
  const next = new Date(now);
  next.setHours(SYNC_HOUR, SYNC_MINUTE, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next.getTime() - now.getTime();
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Vercel schedules the sync for us via vercel.json crons.
  if (process.env.VERCEL === "1") return;

  // Dev hot-reload can re-register instrumentation; keep a single timer per
  // process instead of stacking duplicates.
  const g = globalThis as typeof globalThis & { __kbPriceSyncRegistered?: boolean };
  if (g.__kbPriceSyncRegistered) return;
  g.__kbPriceSyncRegistered = true;

  const { syncLivePrices, populateReferencePrices } = await import("./lib/agmarknet");

  async function runOnce() {
    try {
      const counts = await syncLivePrices();
      const reference = await populateReferencePrices();
      console.log(`[price-sync] ${new Date().toISOString()} ok`, counts, reference);
    } catch (error) {
      console.error("[price-sync] failed:", error instanceof Error ? error.message : error);
    }
    setTimeout(runOnce, 24 * 60 * 60 * 1000);
  }

  const delay = msUntilNextSync(new Date());
  console.log(`[price-sync] next run in ${Math.round(delay / 60000)} minutes`);
  setTimeout(runOnce, delay);
}