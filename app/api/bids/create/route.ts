import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";

const bodySchema = z.object({
  trader_id: z.string().uuid(),
  farmer_id: z.string().uuid().nullable().optional(),
  crop_id: z.string(),
  mandi_id: z.string(),
  listed_price: z.number().positive(),
  bid_amount: z.number().positive(),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_failed", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const input = parsed.data;

  // Flag, don't block: a below-ask bid is allowed, just worth surfacing to
  // the caller so the trader UI can show a soft warning before they confirm.
  const belowAsk = input.bid_amount < input.listed_price;

  const { data: bid, error } = await supabaseAdmin
    .from("bids")
    .insert({
      trader_id: input.trader_id,
      farmer_id: input.farmer_id ?? null,
      crop_id: input.crop_id,
      mandi_id: input.mandi_id,
      listed_price: input.listed_price,
      bid_amount: input.bid_amount,
      status: "pending",
    })
    .select()
    .single();

  if (error || !bid) {
    return NextResponse.json({ error: "insert_failed", message: error?.message }, { status: 500 });
  }

  return NextResponse.json({ ...bid, belowAsk }, { status: 201 });
}
