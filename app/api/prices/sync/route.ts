export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { syncLivePrices } from "@/lib/agmarknet";

/**
 * POST /api/prices/sync — manual trigger (admin button / curl).
 * GET  /api/prices/sync — Vercel Cron trigger. Vercel Cron issues a GET and
 *      sends the `x-vercel-cron` header (its value is the CRON_SECRET env var
 *      when set). Without that header the GET is rejected so the URL can't be
 *      hit like a normal page; POST remains the admin path.
 */
async function runSync() {
  const counts = await syncLivePrices();
  return NextResponse.json({ status: "ok", ...counts });
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
  const authorized = cronHeader !== null && (cronSecret ? cronHeader === cronSecret : true);
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