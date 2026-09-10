export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { FeedBubble, ParchiRecord, SowingSignal } from "@/types";

/**
 * Server-side composition of the farmer feed's bubbles (FPO price entries,
 * the current sowing signal, and the farmer's Parchi confirmations). Same
 * RLS justification as /api/sowing-signal: these reads need the admin client
 * because none of the pilot sessions are real Supabase Auth sessions.
 */
export async function GET(req: NextRequest) {
  const cropId = req.nextUrl.searchParams.get("crop_id");
  const mandiId = req.nextUrl.searchParams.get("mandi_id");
  const farmerId = req.nextUrl.searchParams.get("farmer_id");
  const rawLimit = Number(req.nextUrl.searchParams.get("limit") ?? "20");
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(100, rawLimit)) : 20;

  if (!cropId || !mandiId) {
    return NextResponse.json(
      { error: "validation_failed", message: "crop_id and mandi_id query params are required." },
      { status: 400 }
    );
  }

  const [pricesRes, signalRes, parchiRes, epoRes] = await Promise.all([
    supabaseAdmin
      .from("fpo_price_entries")
      .select("price_per_quintal, entered_at")
      .eq("crop_id", cropId)
      .eq("mandi_id", mandiId)
      .order("entered_at", { ascending: false })
      .limit(5),
    supabaseAdmin
      .from("sowing_signals")
      .select("signal_status, recalculated_at")
      .eq("crop_id", cropId)
      .eq("mandi_id", mandiId)
      .maybeSingle(),
    farmerId
      ? supabaseAdmin
          .from("parchi_ledger")
          .select("*")
          .eq("farmer_id", farmerId)
          .eq("mandi_id", mandiId)
          .order("timestamp", { ascending: false })
          .limit(limit)
      : Promise.resolve({ data: [], error: null }),
    // EPO observations — human-observed prices for this pair. Carried as
    // epi_observation bubbles with the observer's name (migration 009).
    supabaseAdmin
      .from("epo_price_entries")
      .select("*, users(name)")
      .eq("crop_id", cropId)
      .eq("mandi_id", mandiId)
      .order("observed_at", { ascending: false })
      .limit(5),
  ]);

  if (pricesRes.error || signalRes.error || parchiRes.error || epoRes.error) {
    const msg = [pricesRes.error?.message, signalRes.error?.message, parchiRes.error?.message, epoRes.error?.message]
      .filter(Boolean)
      .join("; ");
    return NextResponse.json({ error: "query_failed", message: msg }, { status: 500 });
  }

  const bubbles: FeedBubble[] = [];

  for (const row of pricesRes.data ?? []) {
    bubbles.push({
      type: "price_update",
      crop_id: cropId,
      mandi_id: mandiId,
      price_per_quintal: row.price_per_quintal as number,
      source: "FPO entry",
      timestamp: row.entered_at as string,
    });
  }

  for (const row of epoRes.data ?? []) {
    const entry = row as {
      price_per_quintal: number | string;
      observed_at: string;
      users?: { name?: string } | null;
    };
    bubbles.push({
      type: "epo_observation",
      crop_id: cropId,
      mandi_id: mandiId,
      price_per_quintal: Number(entry.price_per_quintal),
      observer: entry.users?.name ?? "FPO observer",
      timestamp: entry.observed_at,
    });
  }

  const signal = signalRes.data as SowingSignal | null;
  if (signal) {
    bubbles.push({
      type: "signal_change",
      crop_id: cropId,
      mandi_id: mandiId,
      signal_status: signal.signal_status,
      timestamp: signal.recalculated_at,
    });
  }

  for (const parchi of (parchiRes.data ?? []) as ParchiRecord[]) {
    bubbles.push({ type: "parchi_confirmation", parchi, timestamp: parchi.timestamp });
  }

  bubbles.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return NextResponse.json({ bubbles });
}