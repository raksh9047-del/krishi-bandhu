export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { searchMandiCandidates } from "@/lib/nominatim";

/**
 * GET /api/places/search?q=... — Nominatim (OpenStreetMap) mandi search
 * (prefill helper). No API key required.
 *
 * Returns [] — not an error — when the geocoder can't resolve the query, so
 * the submit flow degrades to typed coordinates.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  if (!q || q.trim().length < 3) {
    return NextResponse.json({ error: "validation_failed", message: "q query param (min 3 chars) is required." }, { status: 400 });
  }

  const candidates = await searchMandiCandidates(q);
  return NextResponse.json({ candidates });
}