export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * GET /api/fpo/price-entries
 *
 * 30-day FPO price history for the FPO dashboard's table + CSV export.
 * Owner-scoped read, so it runs through the admin client rather than relying
 * on client-side RLS (no forwarded session in this pilot).
 */
export async function GET(req: NextRequest) {
  const fpoId = req.nextUrl.searchParams.get("fpo_id");
  const cropId = req.nextUrl.searchParams.get("crop_id");
  const mandiId = req.nextUrl.searchParams.get("mandi_id");

  if (!fpoId) {
    return NextResponse.json(
      { error: "validation_failed", message: "fpo_id query param is required." },
      { status: 400 }
    );
  }

  const since = new Date();
  since.setDate(since.getDate() - 30);

  let query = supabaseAdmin
    .from("fpo_price_entries")
    .select("id, crop_id, mandi_id, price_per_quintal, arrival_volume_tons, entered_at")
    .eq("fpo_id", fpoId)
    .gte("entered_at", since.toISOString())
    .order("entered_at", { ascending: false })
    .limit(100);

  if (cropId) query = query.eq("crop_id", cropId);
  if (mandiId) query = query.eq("mandi_id", mandiId);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: "query_failed", message: error.message }, { status: 500 });
  }

  return NextResponse.json({ entries: data ?? [] });
}