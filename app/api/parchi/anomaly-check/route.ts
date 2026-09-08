export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * Flags, never blocks: this endpoint informs the trader-app UI (Phase 7) so
 * a suspicious pattern can be surfaced, but a Parchi submission is never
 * rejected on the strength of an anomaly score alone.
 */
export async function GET(req: NextRequest) {
  const traderId = req.nextUrl.searchParams.get("trader_id");
  const cropId = req.nextUrl.searchParams.get("crop_id");

  if (!traderId || !cropId) {
    return NextResponse.json(
      { error: "validation_failed", message: "trader_id and crop_id query params are required." },
      { status: 400 }
    );
  }

  const { data: entries, error } = await supabaseAdmin
    .from("parchi_ledger")
    .select("deduction_percent")
    .eq("trader_id", traderId)
    .eq("crop_id", cropId);

  if (error) {
    return NextResponse.json({ error: "query_failed", message: error.message }, { status: 500 });
  }

  const values = (entries ?? []).map((e) => e.deduction_percent as number);

  // Need at least 5 prior entries for a meaningful z-score — below that,
  // return a clear "insufficient_history" reason rather than a noisy false
  // flag on a brand-new trader/commodity pair.
  if (values.length < 5) {
    return NextResponse.json({ flagged: false, reason: "insufficient_history", sampleSize: values.length });
  }

  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  const stdDev = Math.sqrt(variance);

  const latest = values[values.length - 1];
  const zScore = stdDev === 0 ? 0 : (latest - mean) / stdDev;
  const flagged = Math.abs(zScore) > 2; // >2 std devs from this trader/commodity's own average

  return NextResponse.json({
    flagged,
    zScore: Number(zScore.toFixed(2)),
    mean: Number(mean.toFixed(2)),
    stdDev: Number(stdDev.toFixed(2)),
    sampleSize: values.length,
  });
}
