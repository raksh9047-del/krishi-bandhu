import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * GET /api/fpo/survey-stats
 *
 * Seasonal aggregation for the FPO survey module: the share of surveyed
 * farmers planting each crop this season vs the same share historically.
 * Mirrors the crop-level aggregation the Sowing Signal route uses for its
 * survey side (state-wide, pilot simplification) so the two numbers agree.
 */
export async function GET() {
  const currentYear = new Date().getFullYear();

  const { data: rows, error } = await supabaseAdmin
    .from("fpo_survey_responses")
    .select("crop_id, submitted_at");

  if (error) {
    return NextResponse.json({ error: "query_failed", message: error.message }, { status: 500 });
  }

  const current = rows?.filter((r) => new Date(r.submitted_at).getFullYear() === currentYear) ?? [];
  const prior = rows?.filter((r) => new Date(r.submitted_at).getFullYear() < currentYear) ?? [];

  function shares(list: typeof current) {
    const byCrop = new Map<string, number>();
    for (const row of list) {
      byCrop.set(row.crop_id, (byCrop.get(row.crop_id) ?? 0) + 1);
    }
    const total = list.length || 0;
    return {
      total,
      byCrop: Object.fromEntries(
        [...byCrop.entries()].map(([crop_id, count]) => [crop_id, { count, pct: total ? (count / total) * 100 : 0 }])
      ),
    };
  }

  return NextResponse.json({
    currentSeason: shares(current),
    priorSeason: shares(prior),
  });
}