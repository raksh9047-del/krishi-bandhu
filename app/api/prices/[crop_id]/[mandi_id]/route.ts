export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getMarketPriceView } from "@/lib/agmarknet";
import { getCropById, getMandiById } from "@/constants";

/**
 * GET /api/prices/:crop_id/:mandi_id
 *
 * Current market price for a crop+mandi, resolved live:
 *   * A stored Agmarknet row fresher than 6h is returned as-is.
 *   * Otherwise the latest-published Agmarknet record for the selected
 *     crop + Maharashtra mandi is fetched on request and persisted.
 *   * If the feed has no record for this pair, the best stored value
 *     (seed/FPO) is returned with `status: "fallback"` so the UI can never
 *     present fallback data as "Live".
 *   * 404 "no current market data" only when there is no value at all.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { crop_id: string; mandi_id: string } }
) {
  const { crop_id: cropId, mandi_id: mandiId } = params;

  const crop = getCropById(cropId);
  const mandi = getMandiById(mandiId);
  if (!crop || !mandi) {
    return NextResponse.json(
      {
        error: "validation_failed",
        message: "crop_id or mandi_id is outside the seeded set.",
      },
      { status: 400 }
    );
  }

  try {
    const view = await getMarketPriceView(cropId, mandiId);
    if (view.price === null || !view.source) {
      return NextResponse.json(
        { error: "no_price", message: "No current market data available for this crop and mandi." },
        { status: 404 }
      );
    }
    return NextResponse.json(view);
  } catch (error) {
    return NextResponse.json(
      { error: "query_failed", message: error instanceof Error ? error.message : "Unknown error." },
      { status: 500 }
    );
  }
}