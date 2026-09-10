export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getCropById, getMandiById } from "@/constants";

/**
 * POST /api/epo/entry — EPO (Electronic Price Observation) manual entry.
 *
 * Agmarknet is a daily publication and covers far from every crop/mandi pair,
 * so a registered FPO coordinator (or authorized assayer) can submit a human
 * price observation. It becomes an independent, farmer-visible price source
 * alongside 'live' (Agmarknet) and 'fpo' (FPO manual) — labeled "observed,
 * not live" everywhere (see /api/prices read path: epoSource).
 *
 * Authorization for the pilot: the observer passes their users.id, and the
 * route verifies it resolves to a user with role fpo/admin (mirrors the
 * epo_insert_own RLS policy). The write goes through the admin client because
 * the pilot browser never carries a real Supabase Auth session.
 */
const epoEntrySchema = z.object({
  observer_id: z.string().uuid(),
  crop_id: z.string(),
  mandi_id: z.string(),
  price_per_quintal: z.number().positive({ message: "Price per quintal must be greater than 0." }),
  arrival_volume_tons: z.number().min(0).nullable().optional(),
  observed_at: z.string().datetime().nullable().optional(),
  note: z.string().trim().max(400).nullable().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = epoEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", fields: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const input = parsed.data;

  const crop = getCropById(input.crop_id);
  const mandi = getMandiById(input.mandi_id);
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

  const { data: observer, error: observerErr } = await supabaseAdmin
    .from("users")
    .select("id, name, role")
    .eq("id", input.observer_id)
    .maybeSingle();

  if (observerErr || !observer) {
    return NextResponse.json(
      { error: "validation_failed", fields: { observer_id: ["Observer not found."] } },
      { status: 400 }
    );
  }
  if (observer.role !== "fpo" && observer.role !== "admin") {
    return NextResponse.json(
      { error: "forbidden", message: "Only FPO coordinators and admins can record EPO observations." },
      { status: 403 }
    );
  }

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from("epo_price_entries")
    .insert({
      observer_id: input.observer_id,
      crop_id: input.crop_id,
      mandi_id: input.mandi_id,
      price_per_quintal: input.price_per_quintal,
      arrival_volume_tons: input.arrival_volume_tons ?? null,
      observed_at: input.observed_at ?? new Date().toISOString(),
      note: input.note ?? null,
    })
    .select()
    .single();

  if (insertErr || !inserted) {
    return NextResponse.json({ error: "insert_failed", message: insertErr?.message }, { status: 500 });
  }

  return NextResponse.json({ entry: inserted }, { status: 201 });
}