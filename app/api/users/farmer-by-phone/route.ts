export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";

const lookupSchema = z.object({
  phone: z.string().regex(/^[6-9]\d{9}$/, { message: "Enter a valid 10-digit mobile number." }),
});

const normalizePhone = (p: string) => "+91" + p;

/**
 * Look up a farmer/FPO by mobile number so a trader at the mandi can attach a
 * parchi to the right person without knowing their UUID. Matches all the phone
 * formats that have accumulated in `users` (10-digit, "+91xxx", "91xxx").
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = lookupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_failed", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { phone } = parsed.data;
  const e164Phone = normalizePhone(phone);

  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id, name, village")
    .in("role", ["farmer", "fpo"])
    .in("phone", [e164Phone, phone, e164Phone.slice(1)])
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "query_failed", message: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json(
      { error: "not_found", message: "No farmer or FPO is registered with this number." },
      { status: 404 }
    );
  }

  return NextResponse.json({ id: data.id, name: data.name, village: data.village ?? null });
}