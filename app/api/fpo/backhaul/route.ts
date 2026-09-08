export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getMandiById } from "@/constants";

/**
 * GET  — list all backhaul truck entries (newest departure first), reads via
 *         the admin client because the table's read RLS is authenticated-only
 *         and this pilot has no forwarded session.
 * POST — create or update a backhaul truck entry for the FPO admin UI.
 *         Matching schema.sql validation: available_capacity_kg >= 0.
 */
const backhaulSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  truck_number: z.string().min(1),
  from_mandi_id: z.string(),
  to_village: z.string().min(1),
  departure_time: z.string().datetime({ offset: true }),
  available_capacity_kg: z.number().min(0),
  contact_number: z.string().min(1),
});

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("backhaul_trucks")
    .select("id, truck_number, from_mandi_id, to_village, departure_time, available_capacity_kg, contact_number")
    .order("departure_time", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "query_failed", message: error.message }, { status: 500 });
  }

  return NextResponse.json({ trucks: data ?? [] });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = backhaulSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", fields: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { id, truck_number, from_mandi_id, to_village, departure_time, available_capacity_kg, contact_number } = parsed.data;

  const mandi = getMandiById(from_mandi_id);
  if (!mandi) {
    return NextResponse.json(
      { error: "validation_failed", fields: { from_mandi_id: ["Unknown mandi_id."] } },
      { status: 400 }
    );
  }

  if (id) {
    const { data: updated, error } = await supabaseAdmin
      .from("backhaul_trucks")
      .update({ truck_number, from_mandi_id, to_village, departure_time, available_capacity_kg, contact_number })
      .eq("id", id)
      .select()
      .single();

    if (error || !updated) {
      return NextResponse.json({ error: "update_failed", message: error?.message }, { status: 500 });
    }
    return NextResponse.json(updated);
  }

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from("backhaul_trucks")
    .insert({ truck_number, from_mandi_id, to_village, departure_time, available_capacity_kg, contact_number })
    .select()
    .single();

  if (insertErr || !inserted) {
    return NextResponse.json({ error: "insert_failed", message: insertErr?.message }, { status: 500 });
  }

  return NextResponse.json(inserted, { status: 201 });
}