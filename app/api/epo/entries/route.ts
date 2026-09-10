export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { EpoPriceEntry } from "@/types";

/**
 * GET /api/epo/entries — recent EPO observations.
 *
 * Query params:
 *   * crop_id + mandi_id — filter to a pair (used by the price read path)
 *   * observer_id          — filter to one observer (used by the FPO panel)
 *   * limit                — 1..100, default 20
 */
export async function GET(req: NextRequest) {
  const cropId = req.nextUrl.searchParams.get("crop_id");
  const mandiId = req.nextUrl.searchParams.get("mandi_id");
  const observerId = req.nextUrl.searchParams.get("observer_id");
  const rawLimit = Number(req.nextUrl.searchParams.get("limit") ?? "20");
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(100, rawLimit)) : 20;

  let query = supabaseAdmin
    .from("epo_price_entries")
    .select("*, users(name)")
    .order("observed_at", { ascending: false })
    .limit(limit);

  if (cropId) query = query.eq("crop_id", cropId);
  if (mandiId) query = query.eq("mandi_id", mandiId);
  if (observerId) query = query.eq("observer_id", observerId);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: "query_failed", message: error.message }, { status: 500 });
  }

  const rows = (data ?? []).map((row) => {
    const entry = row as EpoPriceEntry & { users?: { name: string } | null };
    return { ...entry, observer_name: entry.users?.name ?? null };
  });

  return NextResponse.json({ entries: rows });
}