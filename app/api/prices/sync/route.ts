export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { syncLivePrices, populateReferencePrices } from "@/lib/agmarknet";

/**
 * POST /api/prices/sync — manual trigger (admin button / curl).
 * GET  /api/prices/sync — Vercel Cron trigger. Vercel Cron issues a GET and
 *      sends the `x-vercel-cron` header (its value is the CRON_SECRET env var
 *      when set). Without that header the GET is rejected so the URL can't be
 *      hit like a normal page; POST remains the admin path.
 *
 * Non-Vercel deployments don't need this endpoint called at all: the daily
 * timer in instrumentation.ts runs the same two steps in-process.
 */
async function runSync() {
  const counts = await syncLivePrices();
  // Backfill NOT-LIVE reference row for every crop x mandi pair (national
  // Agmarknet day median) so no pair is ever blank, then return both halves.
  const reference = await populateReferencePrices();
  return NextResponse.json({ status: "ok", ...counts, reference });
}

export async function POST() {
  try {
    return await runSync();
  } catch (error) {
    return NextResponse.json(
      { error: "sync_failed", message: error instanceof Error ? error.message : "Unknown sync error." },
      { status: 502 }
    );
  }
}

export async function GET(req: NextRequest) {
  const cronHeader = req.headers.get("x-vercel-cron");
  const cronSecret = process.env.CRON_SECRET;
  const authorized =
    typeof cronSecret === "string" &&
    cronSecret.length > 0 &&
    cronHeader !== null &&
    cronHeader === cronSecret;
  if (!authorized) {
    return NextResponse.json(
      { error: "method_not_allowed", message: "This endpoint only runs on a Vercel Cron schedule." },
      { status: 405 }
    );
  }
  try {
    return await runSync();
  } catch (error) {
    return NextResponse.json(
      { error: "sync_failed", message: error instanceof Error ? error.message : "Unknown sync error." },
      { status: 502 }
    );
  }
}