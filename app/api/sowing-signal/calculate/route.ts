import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getCropById, getMandiById, SOWING_SIGNAL_THRESHOLDS, SOWING_SIGNAL_SUBSIDY_WEIGHT, SOWING_SIGNAL_SURVEY_WEIGHT } from "@/constants";

const bodySchema = z.object({
  crop_id: z.string(),
  mandi_id: z.string(),
});

function firstOfMonth(date: Date): string {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), 1)).toISOString().slice(0, 10);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_failed", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { crop_id, mandi_id } = parsed.data;
  const crop = getCropById(crop_id);
  const mandi = getMandiById(mandi_id);
  if (!crop || !mandi) {
    return NextResponse.json({ error: "validation_failed", message: "Unknown crop_id or mandi_id." }, { status: 400 });
  }

  // ── Sowing window check ──────────────────────────────────────────────
  // Reads the window from `sowing_signals` (seeded per crop/mandi in
  // Phase 8). If no window is configured yet for this pair, that's a
  // distinct 404 — not the same as "outside the window."
  const { data: existingSignal } = await supabaseAdmin
    .from("sowing_signals")
    .select("sowing_window_start, sowing_window_end")
    .eq("crop_id", crop_id)
    .eq("mandi_id", mandi_id)
    .maybeSingle();

  if (!existingSignal) {
    return NextResponse.json(
      { error: "no_window_configured", message: `No sowing window has been configured yet for ${crop.name} at ${mandi.name}.` },
      { status: 404 }
    );
  }

  const today = new Date();
  const windowStart = new Date(existingSignal.sowing_window_start);
  const windowEnd = new Date(existingSignal.sowing_window_end);
  if (today < windowStart || today > windowEnd) {
    return NextResponse.json(
      {
        error: "outside_sowing_window",
        message: `${crop.name} at ${mandi.name} is outside its active sowing window (${existingSignal.sowing_window_start} to ${existingSignal.sowing_window_end}). Not recalculating to avoid returning a stale or meaningless signal.`,
      },
      { status: 409 }
    );
  }

  // ── Subsidy side ──────────────────────────────────────────────────────
  // NOTE (pilot simplification): subsidy_disbursements is keyed by
  // crop + district + month, matching the mandi's district. This is the
  // systematic signal — it's comprehensive but misses farmers who buy seed
  // privately or replant their own saved seed, which is exactly why it's
  // blended with survey data below rather than used alone.
  const currentMonthKey = firstOfMonth(today);
  const currentMonthNumber = today.getMonth(); // 0-11, used to match "same month, prior years"

  const { data: currentMonthRows } = await supabaseAdmin
    .from("subsidy_disbursements")
    .select("amount")
    .eq("crop_id", crop_id)
    .eq("district", mandi.district)
    .eq("month", currentMonthKey);

  const currentAmount = (currentMonthRows ?? []).reduce((sum, r) => sum + (r.amount as number), 0);

  const { data: historicalRows } = await supabaseAdmin
    .from("subsidy_disbursements")
    .select("amount, month")
    .eq("crop_id", crop_id)
    .eq("district", mandi.district);

  const sameMonthPriorYears = (historicalRows ?? []).filter((r) => {
    const d = new Date(r.month as string);
    return d.getMonth() === currentMonthNumber && d.getFullYear() < today.getFullYear();
  });

  const threeYearAvg =
    sameMonthPriorYears.length > 0
      ? sameMonthPriorYears.reduce((sum, r) => sum + (r.amount as number), 0) / sameMonthPriorYears.length
      : null;

  // If there's no history yet to compare against, we can't compute a
  // meaningful ratio — default to a neutral 1.0 (same as average) rather
  // than dividing by zero or fabricating a red/yellow flag from nothing.
  const subsidyRatio = threeYearAvg && threeYearAvg > 0 ? currentAmount / threeYearAvg : 1;

  // ── Survey side ───────────────────────────────────────────────────────
  // NOTE (pilot simplification): fpo_survey_responses records a village
  // name, not a mandi_id/district — there's no clean village→district join
  // in the pilot schema yet. For now this aggregates at the crop level
  // (state-wide across all FPO surveys for this crop) rather than scoping
  // to the mandi's district specifically. Tighten this once villages are
  // mapped to districts/mandis.
  const currentYear = today.getFullYear();
  const { data: allSurveyRows } = await supabaseAdmin
    .from("fpo_survey_responses")
    .select("crop_id, submitted_at");

  const currentSeasonRows = (allSurveyRows ?? []).filter((r) => new Date(r.submitted_at as string).getFullYear() === currentYear);
  const priorSeasonRows = (allSurveyRows ?? []).filter((r) => new Date(r.submitted_at as string).getFullYear() < currentYear);

  function percentForCrop(rows: typeof currentSeasonRows) {
    if (rows.length === 0) return null;
    const forCrop = rows.filter((r) => r.crop_id === crop_id).length;
    return (forCrop / rows.length) * 100;
  }

  const currentSeasonPercent = percentForCrop(currentSeasonRows);
  const priorAveragePercent = percentForCrop(priorSeasonRows);

  // Same fallback logic as the subsidy side: no prior-season baseline yet
  // means no signal from this side, not a fabricated one.
  const surveyRatio =
    currentSeasonPercent !== null && priorAveragePercent !== null && priorAveragePercent > 0
      ? currentSeasonPercent / priorAveragePercent
      : 1;

  // ── Blend (weights are tunable — see constants.ts, not derived) ────────
  const blendedRatio = SOWING_SIGNAL_SUBSIDY_WEIGHT * subsidyRatio + SOWING_SIGNAL_SURVEY_WEIGHT * surveyRatio;

  const thresholds = SOWING_SIGNAL_THRESHOLDS[crop_id];
  const signalStatus = blendedRatio > thresholds.redAbove ? "red" : blendedRatio > thresholds.yellowAbove ? "yellow" : "green";

  const reasoningText =
    threeYearAvg === null
      ? `Not enough subsidy history yet for ${crop.name} in ${mandi.district} to compare against — showing a neutral baseline. ` +
        `Survey data: ${currentSeasonPercent?.toFixed(0) ?? "0"}% of surveyed farmers this season are planting ${crop.name}.`
      : `Seed-subsidy disbursement for ${crop.name} in ${mandi.district} this month is ${(subsidyRatio * 100).toFixed(0)}% of the ` +
        `same-month 3-year average, blended with FPO survey data showing ${currentSeasonPercent?.toFixed(0) ?? "0"}% of surveyed ` +
        `farmers planting ${crop.name} this season.`;

  const nowIso = new Date().toISOString();

  const { data: updatedSignal, error: upsertErr } = await supabaseAdmin
    .from("sowing_signals")
    .update({
      signal_status: signalStatus,
      reasoning_text: reasoningText,
      updated_at: nowIso,
      recalculated_at: nowIso,
    })
    .eq("crop_id", crop_id)
    .eq("mandi_id", mandi_id)
    .select()
    .single();

  if (upsertErr || !updatedSignal) {
    return NextResponse.json({ error: "update_failed", message: upsertErr?.message }, { status: 500 });
  }

  return NextResponse.json({
    signal_status: updatedSignal.signal_status,
    reasoning_text: updatedSignal.reasoning_text,
    recalculated_at: updatedSignal.recalculated_at,
  });
}
