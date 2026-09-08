export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { verifyChainIntegrity } from "@/lib/parchi-crypto";
import type { ParchiRecord } from "@/types";

export async function GET(req: NextRequest) {
  const farmerId = req.nextUrl.searchParams.get("farmer_id");
  const mandiId = req.nextUrl.searchParams.get("mandi_id");

  if (!farmerId || !mandiId) {
    return NextResponse.json(
      { error: "validation_failed", message: "farmer_id and mandi_id query params are required." },
      { status: 400 }
    );
  }

  const { data: entries, error } = await supabaseAdmin
    .from("parchi_ledger")
    .select("*")
    .eq("farmer_id", farmerId)
    .eq("mandi_id", mandiId)
    .order("timestamp", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "query_failed", message: error.message }, { status: 500 });
  }

  const result = await verifyChainIntegrity((entries ?? []) as ParchiRecord[]);

  return NextResponse.json({
    ...result,
    entriesChecked: entries?.length ?? 0,
  });
}
