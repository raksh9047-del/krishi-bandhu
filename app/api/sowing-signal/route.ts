export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { SowingSignal } from "@/types";

/**
 * RLS-safe read of a sowing signal. The `sowing_signals` table's public-read
 * policy is scoped to the `authenticated` role, but this pilot never forwards
 * a real Supabase session to the browser — so a direct client-side read
 * silently returns nothing. Reading through the admin client here keeps the
 * card working exactly as designed.
 */
export async function GET(req: NextRequest) {
  const cropId = req.nextUrl.searchParams.get("crop_id");
  const mandiId = req.nextUrl.searchParams.get("mandi_id");

  if (!cropId || !mandiId) {
    return NextResponse.json(
      { error: "validation_failed", message: "crop_id and mandi_id query params are required." },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("sowing_signals")
    .select("*")
    .eq("crop_id", cropId)
    .eq("mandi_id", mandiId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "query_failed", message: error.message }, { status: 500 });
  }

  return NextResponse.json({ signal: (data as SowingSignal) ?? null });
}