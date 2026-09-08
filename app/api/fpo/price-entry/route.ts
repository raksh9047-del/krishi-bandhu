import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getCropById, getMandiById } from "@/constants";

/**
 * POST /api/fpo/price-entry
 *
 * FPO manual price entry — the platform's real, independent price source.
 * Writes go through the admin client (service role) because this table's
 * INSERT policy is scoped to `fpo_id = auth.uid()` and this pilot has no
 * forwarded end-user session; the FPO identity is fetched separately via
 * /api/fpo/demo-user and validated here.
 */
const priceEntrySchema = z.object({
  fpo_id: z.string().uuid(),
  crop_id: z.string(),
  mandi_id: z.string(),
  price_per_quintal: z.number().positive({ message: "Price per quintal must be greater than 0." }),
  arrival_volume_tons: z.number().min(0, { message: "Arrival volume cannot be negative." }),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = priceEntrySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", fields: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { fpo_id, crop_id, mandi_id, price_per_quintal, arrival_volume_tons } = parsed.data;

  const crop = getCropById(crop_id);
  const mandi = getMandiById(mandi_id);
  if (!crop || !mandi) {
    return NextResponse.json(
      {
        error: "validation_failed",
        fields: {
          crop_id: !crop ? ["Unknown crop_id."] : undefined,
          mandi_id: !mandi ? ["Unknown mandi_id."] : undefined,
        },
      },
      { status: 400 }
    );
  }

  const { data: fpo } = await supabaseAdmin
    .from("users")
    .select("id, role")
    .eq("id", fpo_id)
    .maybeSingle();

  if (!fpo || fpo.role !== "fpo") {
    return NextResponse.json(
      { error: "validation_failed", fields: { fpo_id: ["Not a registered FPO coordinator."] } },
      { status: 400 }
    );
  }

  const { data: entry, error } = await supabaseAdmin
    .from("fpo_price_entries")
    .insert({ fpo_id, crop_id, mandi_id, price_per_quintal, arrival_volume_tons })
    .select()
    .single();

  if (error || !entry) {
    return NextResponse.json({ error: "insert_failed", message: error?.message }, { status: 500 });
  }

  return NextResponse.json(entry, { status: 201 });
}