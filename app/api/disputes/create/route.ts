export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";

const bodySchema = z.object({
  parchi_id: z.string().uuid(),
  raised_by: z.string().uuid(),
  reason: z.string().min(10, { message: "Reason must be at least 10 characters — a real explanation, not a placeholder." }),
});

/**
 * On creation, BOTH escalation channels fire simultaneously — APMC Secretary
 * and the state Kisan Call Centre — rather than routing through a single
 * authority first. That's the deliberate fix for "single point of failure"
 * in a one-authority dispute path: if one channel is slow or unresponsive,
 * the other is already in motion.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_failed", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { parchi_id, raised_by, reason } = parsed.data;

  const { data: parchi, error: parchiErr } = await supabaseAdmin
    .from("parchi_ledger")
    .select("id")
    .eq("id", parchi_id)
    .single();

  if (parchiErr || !parchi) {
    return NextResponse.json({ error: "not_found", message: "Parchi record not found." }, { status: 404 });
  }

  const nowIso = new Date().toISOString();

  const { data: dispute, error: insertErr } = await supabaseAdmin
    .from("disputes")
    .insert({
      parchi_id,
      raised_by,
      reason,
      status: "open",
      escalated_to_apmc: true,
      escalated_to_kisan_call_centre: true,
      escalation_timer_started_at: nowIso,
    })
    .select()
    .single();

  if (insertErr || !dispute) {
    return NextResponse.json({ error: "insert_failed", message: insertErr?.message }, { status: 500 });
  }

  return NextResponse.json(dispute, { status: 201 });
}
