import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { calculateNetRealization } from "@/lib/net-realization";

/**
 * POST /api/net-realization/calculate
 *
 * Same corrected engine the client component uses, exposed as a server route
 * (ported from net_realization.py). Deductions EXCLUDE transport — transport
 * is routed to either the trader's payout (trader-arranged) or the farmer's
 * own-expense line (farmer-arranged), never both.
 */
const deductionSchema = z.object({
  label: z.string().min(1),
  amount: z.number().min(0),
});

const netRealizationSchema = z.object({
  selling_price: z.number().positive(),
  quantity: z.number().positive(),
  deductions: z.array(deductionSchema).default([]),
  transport_cost: z.number().min(0).default(0),
  transport_arranger: z.enum(["farmer", "trader"]),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = netRealizationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", fields: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const result = calculateNetRealization(
    parsed.data.selling_price,
    parsed.data.quantity,
    parsed.data.deductions,
    parsed.data.transport_cost,
    parsed.data.transport_arranger
  );

  return NextResponse.json(result);
}