import { NextRequest, NextResponse } from "next/server";
import { getCurrentPrice } from "@/lib/agmarknet";
import { getCropById, getMandiById } from "@/constants";

/**
 * GET /api/prices/:crop_id/:mandi_id
 *
 * Current best price for a crop+mandi, preferring an Agmarknet live release
 * over FPO/seed data, then the most recent date. 404 when neither a live nor
 * a manual price exists yet for this pair.
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
    const price = await getCurrentPrice(cropId, mandiId);
    if (!price) {
      return NextResponse.json(
        { error: "no_price", message: "No price available (no live or manual data)." },
        { status: 404 }
      );
    }
    return NextResponse.json(price);
  } catch (error) {
    return NextResponse.json(
      { error: "query_failed", message: error instanceof Error ? error.message : "Unknown error." },
      { status: 500 }
    );
  }
}