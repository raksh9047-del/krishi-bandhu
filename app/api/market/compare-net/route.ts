export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { MANDIS, CROPS } from "@/constants";
import { haversineKm, estimateTransportPerQ } from "@/lib/geo";
import { calculateNetRealization } from "@/lib/net-realization";

/**
 * POST /api/market/compare-net
 *
 * Returns net realization across ALL 10 mandis for a given crop,
 * sorted by best effective take-home. This is what eNAM cannot do —
 * it shows prices but never computes personalized net realization
 * across mandis.
 *
 * Body: { crop_id, deduction_percent, transport_cost_per_q?, farmer_lat?, farmer_lng? }
 *
 * If farmer_lat/lng are provided, transport cost is estimated from
 * Haversine distance. Otherwise the caller must supply transport_cost_per_q.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { crop_id, deduction_percent = 5, transport_cost_per_q, farmer_lat, farmer_lng } = body;

  if (!crop_id || !CROPS.find((c) => c.id === crop_id)) {
    return NextResponse.json({ error: "Invalid crop_id." }, { status: 400 });
  }

  const results = await Promise.all(
    MANDIS.map(async (mandi) => {
      // Fetch price from stored prices table (fast path)
      let pricePerQuintal = 0;
      let source = "unavailable";
      let date = "";

      try {
        // Dynamic import to avoid circular deps
        const { supabaseAdmin } = await import("@/lib/supabase-admin");
        const { data: priceRows } = await supabaseAdmin
          .from("prices")
          .select("price, source, date, arrival_volume_tons")
          .eq("crop_id", crop_id)
          .eq("mandi_id", mandi.id)
          .order("date", { ascending: false })
          .limit(200);

        if (priceRows && priceRows.length > 0) {
          // Same resolution logic as getCurrentPrice in lib/agmarknet.ts:
          // prefer live over seed, fall back to FPO entries if no rows at all
          const live = priceRows.filter((r) => r.source === "live");
          const preferred = live.length > 0 ? live : priceRows;
          const best = preferred[0];
          pricePerQuintal = best.price;
          source = best.source;
          date = best.date;
        } else {
          // Fallback: FPO entries
          const { data: fpoRow } = await supabaseAdmin
            .from("fpo_price_entries")
            .select("price_per_quintal, entered_at")
            .eq("crop_id", crop_id)
            .eq("mandi_id", mandi.id)
            .order("entered_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (fpoRow) {
            pricePerQuintal = fpoRow.price_per_quintal;
            source = "fpo";
            date = fpoRow.entered_at;
          }
        }
      } catch {
        // skip — price stays 0
      }

      // Transport cost: estimate from distance or use provided value
      let transportCost = transport_cost_per_q ?? 0;
      if (farmer_lat != null && farmer_lng != null) {
        const dist = haversineKm(farmer_lat, farmer_lng, mandi.lat, mandi.lng);
        transportCost = estimateTransportPerQ(dist);
      }

      const deductionAmount = pricePerQuintal * (deduction_percent / 100);
      const result = calculateNetRealization(
        pricePerQuintal,
        1,
        [{ label: "deduction", amount: deductionAmount }],
        transportCost,
        "farmer"
      );

      // Distance from farmer (if provided)
      const distanceKm =
        farmer_lat != null && farmer_lng != null
          ? Math.round(haversineKm(farmer_lat, farmer_lng, mandi.lat, mandi.lng))
          : null;

      return {
        mandi_id: mandi.id,
        mandi_name: mandi.name,
        district: mandi.district,
        price_per_quintal: pricePerQuintal,
        source,
        date,
        distance_km: distanceKm,
        transport_cost_per_q: transportCost,
        deduction_percent,
        effective_take_home: result.effective_take_home,
        net_payout: result.net_payout,
      };
    })
  );

  // Sort by effective take-home (best first)
  results.sort((a, b) => b.effective_take_home - a.effective_take_home);

  const crop = CROPS.find((c) => c.id === crop_id);

  return NextResponse.json({
    crop_id,
    crop_name: crop?.name ?? crop_id,
    deduction_percent,
    mandis: results,
    best_mandi_id: results[0]?.mandi_id ?? null,
  });
}
