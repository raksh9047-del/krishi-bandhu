import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentPrice } from "@/lib/agmarknet";
import { getCropById, MANDIS, PILOT_MANDI_IDS } from "@/constants";

/**
 * GET /api/v1/heatmap?crop_id=...
 *
 * One fetch powering both the Mandi Heatmap and the statewide coverage
 * overlay: each pilot mandi's current Sowing Signal state (or null when none
 * is configured yet) plus its best current price + provenance, resolved
 * server-side so the map screen has zero stale or session-gated reads.
 */
export async function GET(req: NextRequest) {
  const cropId = req.nextUrl.searchParams.get("crop_id") ?? "";
  const crop = getCropById(cropId);
  if (!crop) {
    return NextResponse.json(
      { error: "validation_failed", message: "crop_id query param must match a seeded crop." },
      { status: 400 }
    );
  }

  const { data: signals } = await supabaseAdmin
    .from("sowing_signals")
    .select("mandi_id, signal_status")
    .eq("crop_id", cropId);

  if (signals === null) {
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  const signalByMandi = new Map(signals.map((s) => [s.mandi_id as string, s.signal_status as string]));

  const mandis = await Promise.all(
    PILOT_MANDI_IDS.map(async (mandiId) => {
      const mandi = MANDIS.find((m) => m.id === mandiId);
      let price: { price: number; source: string } | null = null;
      try {
        const current = await getCurrentPrice(cropId, mandiId);
        if (current) price = { price: current.price, source: current.source };
      } catch {
        price = null;
      }
      return {
        mandi_id: mandiId,
        name: mandi?.name ?? mandiId,
        lat: mandi?.lat ?? 0,
        lng: mandi?.lng ?? 0,
        signal_status: signalByMandi.get(mandiId) ?? null,
        price: price?.price ?? null,
        price_source: price?.source ?? null,
      };
    })
  );

  return NextResponse.json({ crop_id: cropId, mandis });
}