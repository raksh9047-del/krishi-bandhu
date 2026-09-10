export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { verifyChainIntegrity } from "@/lib/parchi-crypto";
import type { ParchiRecord } from "@/types";

export async function GET(req: NextRequest) {
  const farmerId = req.nextUrl.searchParams.get("farmer_id");
  const mandiId = req.nextUrl.searchParams.get("mandi_id");
  const traderId = req.nextUrl.searchParams.get("trader_id");

  // Trader-wide mode: pull every farmer/mandi chain this trader has ever
  // recorded and verify each one. Powers the trader ledger's integrity strip.
  if (traderId) {
    const { data, error } = await supabaseAdmin
      .from("parchi_ledger")
      .select("*")
      .eq("trader_id", traderId)
      .order("timestamp", { ascending: true });

    if (error) {
      return NextResponse.json({ error: "query_failed", message: error.message }, { status: 500 });
    }

    const chains = new Map<string, ParchiRecord[]>();
    for (const row of data ?? []) {
      const key = `${row.farmer_id}:${row.mandi_id}`;
      if (!chains.has(key)) chains.set(key, []);
      chains.get(key)!.push(row);
    }

    const chainResults: Array<{
      farmer_id: string;
      mandi_id: string;
      entriesChecked: number;
      isValid: boolean;
      brokenAtIndex: number | null;
    }> = [];

    for (const [key, entries] of chains) {
      const [fid, mid] = key.split(":");
      const result = await verifyChainIntegrity(entries);
      chainResults.push({
        farmer_id: fid,
        mandi_id: mid,
        entriesChecked: entries.length,
        ...result,
      });
    }

    chainResults.sort((a, b) => b.entriesChecked - a.entriesChecked);

    return NextResponse.json({
      mode: "trader",
      chains: chainResults,
      allValid: chainResults.every((c) => c.isValid),
    });
  }

  if (!farmerId || !mandiId) {
    return NextResponse.json(
      { error: "validation_failed", message: "farmer_id and mandi_id (or trader_id) query params are required." },
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
