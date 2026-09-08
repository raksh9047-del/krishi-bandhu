export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyChainIntegrity } from "@/lib/parchi-crypto";
import type { ParchiRecord } from "@/types";

/**
 * ⚠️ DEMO-ONLY. This route never reads from or writes to the real
 * `parchi_ledger` table — it only operates on the array passed in the
 * request body, mutates one record's `deduction_percent`, and returns the
 * tampered array plus the verify result on it. Phase 7's ParchiLedgerView
 * calls this to power the "Simulate Kharaba Fraud" demo button.
 */

const chainEntrySchema = z.object({
  id: z.string(),
  farmer_id: z.string(),
  trader_id: z.string(),
  crop_id: z.string(),
  mandi_id: z.string(),
  gross_weight: z.number(),
  deduction_percent: z.number(),
  net_weight: z.number(),
  price_per_quintal: z.number(),
  total_amount: z.number(),
  photo_url: z.string().nullable(),
  quality_grade: z.string().nullable(),
  assayer_override_grade: z.string().nullable(),
  timestamp: z.string(),
  previous_hash: z.string().nullable(),
  current_hash: z.string(),
  is_genesis: z.boolean(),
});

const bodySchema = z.object({ chain: z.array(chainEntrySchema) });

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = bodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "validation_failed", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const chain = parsed.data.chain as ParchiRecord[];

  if (chain.length === 0) {
    return NextResponse.json({ error: "validation_failed", message: "chain must have at least one entry." }, { status: 400 });
  }

  // Pick the middle record — not the first or last — so the "broken from
  // here on" effect reads clearly regardless of which direction the demo
  // scrolls.
  const ordered = [...chain].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const middleIndex = Math.floor(ordered.length / 2);
  const tampered = ordered.map((entry, i) =>
    i === middleIndex
      ? { ...entry, deduction_percent: Math.min(100, entry.deduction_percent + 15) } // visibly different, still in-range
      : entry
  );

  const verifyResult = await verifyChainIntegrity(tampered);

  return NextResponse.json({
    chain: tampered,
    tamperedIndex: middleIndex,
    verifyResult,
  });
}
