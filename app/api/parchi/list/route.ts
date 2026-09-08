export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * Same root cause as the write-side fix in lib/supabase-admin.ts: RLS on
 * `parchi_ledger` restricts SELECT to `farmer_id = auth.uid()` OR
 * `trader_id = auth.uid()`, but nothing in this pilot forwards a real
 * Supabase Auth session to the browser's anon client. A direct client-side
 * `supabase.from('parchi_ledger').select(...)` would return zero rows even
 * for the record's own farmer/trader. This route reads with the admin
 * client instead, scoped by whichever id the caller supplies — used by the
 * farmer feed (Phase 6) and the trader ledger view (Phase 7).
 */
export async function GET(req: NextRequest) {
  const farmerId = req.nextUrl.searchParams.get("farmer_id");
  const traderId = req.nextUrl.searchParams.get("trader_id");
  const cropId = req.nextUrl.searchParams.get("crop_id");
  const mandiId = req.nextUrl.searchParams.get("mandi_id");
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? "5");

  if (!farmerId && !traderId) {
    return NextResponse.json(
      { error: "validation_failed", message: "Provide at least one of farmer_id or trader_id." },
      { status: 400 }
    );
  }

  let query = supabaseAdmin.from("parchi_ledger").select("*").order("timestamp", { ascending: false }).limit(limit);
  if (farmerId) query = query.eq("farmer_id", farmerId);
  if (traderId) query = query.eq("trader_id", traderId);
  if (cropId) query = query.eq("crop_id", cropId);
  if (mandiId) query = query.eq("mandi_id", mandiId);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: "query_failed", message: error.message }, { status: 500 });
  }

  return NextResponse.json({ entries: data ?? [] });
}
