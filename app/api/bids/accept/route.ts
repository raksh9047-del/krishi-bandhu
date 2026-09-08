export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";

const bodySchema = z.object({ bid_id: z.string().uuid() });

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_failed", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { data: bid, error } = await supabaseAdmin
    .from("bids")
    .update({ status: "accepted" })
    .eq("id", parsed.data.bid_id)
    .select()
    .single();

  if (error || !bid) {
    return NextResponse.json({ error: "update_failed", message: error?.message }, { status: 500 });
  }

  return NextResponse.json(bid);
}
