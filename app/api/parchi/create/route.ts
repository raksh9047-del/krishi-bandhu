export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { generateParchiHash, generateGenesisAnchor } from "@/lib/parchi-crypto";
import { generateQualityHash } from "@/lib/quality-crypto";
import { createAlert } from "@/lib/alerts";
import { getCropById, getMandiById } from "@/constants";

const createParchiSchema = z.object({
  farmer_id: z.string().uuid(),
  trader_id: z.string().uuid(),
  crop_id: z.string(),
  mandi_id: z.string(),
  gross_weight: z.number().positive({ message: "Gross weight must be greater than 0." }),
  deduction_percent: z
    .number()
    .min(0, { message: "Deduction % cannot be negative." })
    .max(100, { message: "Deduction % cannot exceed 100." }),
  price_per_quintal: z.number().positive({ message: "Price per quintal must be greater than 0." }),
  photo_url: z.string().url().nullable().optional(),
  quality_grade: z.string().nullable().optional(),
  /**
   * How money moved for this sale. The research finding is that forcing a
   * digital payment rail breaks the farmer-trader informal-credit loop, so
   * the Parchi records a sale identically regardless of payment mode — the
   * mode is hashed in (lib/parchi-crypto.ts) so verification is genuinely
   * agnostic to it, not just indifferent to it.
   */
  payment_mode: z
    .enum(["cash", "upi", "bank_transfer", "credit"], {
      errorMap: () => ({ message: "Payment mode must be cash, upi, bank_transfer or credit." }),
    })
    .default("cash"),
  payment_reference: z.string().trim().max(120).nullable().optional(),
  /**
   * For credit sales: the trader is often also the farmer's lender, and this
   * sale offsets an existing informal loan. `credit_note` records what the
   * debt is being offset against, so the farmer's own copy shows the real
   * economic substance of the transaction.
   */
  credit_note: z.string().trim().max(240).nullable().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = createParchiSchema.safeParse(body);

  if (!parsed.success) {
    // Field-level errors, not a generic "something went wrong" — the trader
    // app's ParchiEntryForm (Phase 7) surfaces these inline per field.
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
      { error: "validation_failed", fields: { crop_id: !crop ? ["Unknown crop_id."] : undefined, mandi_id: !mandi ? ["Unknown mandi_id."] : undefined } },
      { status: 400 }
    );
  }

  // Fetch farmer + mandi info needed for the genesis SMS/log text, and the
  // latest hash in this farmer/mandi chain (if any).
  const { data: farmer, error: farmerErr } = await supabaseAdmin
    .from("users")
    .select("id, name")
    .eq("id", input.farmer_id)
    .single();

  if (farmerErr || !farmer) {
    return NextResponse.json({ error: "validation_failed", fields: { farmer_id: ["Farmer not found."] } }, { status: 400 });
  }

  const { data: latestEntry } = await supabaseAdmin
    .from("parchi_ledger")
    .select("current_hash")
    .eq("farmer_id", input.farmer_id)
    .eq("mandi_id", input.mandi_id)
    .order("timestamp", { ascending: false })
    .limit(1)
    .maybeSingle();

  const timestamp = new Date().toISOString();
  const netWeight = input.gross_weight * (1 - input.deduction_percent / 100);
  const totalAmount = (netWeight / 100) * input.price_per_quintal;
  const isGenesis = !latestEntry;

  const hashPayload = {
    farmer_id: input.farmer_id,
    trader_id: input.trader_id,
    crop_id: input.crop_id,
    mandi_id: input.mandi_id,
    gross_weight: input.gross_weight,
    deduction_percent: input.deduction_percent,
    price_per_quintal: input.price_per_quintal,
    payment_mode: input.payment_mode,
    payment_reference: input.payment_reference ?? null,
    credit_note: input.credit_note ?? null,
    timestamp,
  };

  const currentHash = await generateParchiHash(hashPayload, isGenesis ? null : latestEntry!.current_hash);

  // Compute quality hash if grade or photo is provided
  let qualityHash: string | null = null;
  if (input.quality_grade || input.photo_url) {
    // We need the inserted Parchi's ID for the quality hash,
    // so we compute it after insert. Store params for later.
  }

  let genesisAnchor = null;
  if (isGenesis) {
    genesisAnchor = await generateGenesisAnchor({
      ...hashPayload,
      farmer_name: farmer.name,
      mandi_name: mandi.name,
      crop_name: crop.name,
    });
  }

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from("parchi_ledger")
    .insert({
      farmer_id: input.farmer_id,
      trader_id: input.trader_id,
      crop_id: input.crop_id,
      mandi_id: input.mandi_id,
      gross_weight: input.gross_weight,
      deduction_percent: input.deduction_percent,
      net_weight: netWeight,
      price_per_quintal: input.price_per_quintal,
      total_amount: totalAmount,
      photo_url: input.photo_url ?? null,
      quality_grade: input.quality_grade ?? null,
      payment_mode: input.payment_mode,
      payment_reference: input.payment_reference ?? null,
      credit_note: input.credit_note ?? null,
      timestamp,
      previous_hash: isGenesis ? null : latestEntry!.current_hash,
      current_hash: currentHash,
      is_genesis: isGenesis,
    })
    .select()
    .single();

  if (insertErr || !inserted) {
    return NextResponse.json({ error: "insert_failed", message: insertErr?.message }, { status: 500 });
  }

  // Compute quality hash after insert (we need the Parchi ID)
  if (input.quality_grade || input.photo_url) {
    try {
      qualityHash = await generateQualityHash(
        { id: inserted.id, trader_id: input.trader_id, crop_id: input.crop_id },
        input.quality_grade ?? "",
        input.photo_url ?? null,
        null // moisture_percent not yet in schema — add when needed
      );
      // Store quality_hash on the Parchi record
      await supabaseAdmin
        .from("parchi_ledger")
        .update({ quality_hash: qualityHash })
        .eq("id", inserted.id);
    } catch {
      // quality hash is best-effort — never fails the parchi
    }
  }

  // Push a "Parchi recorded" alert to the farmer's inbox. Best-effort: an
  // alert write must never fail the parchi itself. The alert carries the
  // farmer's own hash + a shareable copy URL so the farmer has a record
  // independent of the agent — the fix for "agents control the record".
  try {
    await createAlert({
      farmer_id: input.farmer_id,
      type: "parchi_recorded",
      severity: "info",
      title: "New Parchi recorded",
      message: `₹${totalAmount.toFixed(0)} for ${netWeight.toFixed(1)}kg of ${crop.name} at ${mandi.name}.`,
      payload: {
        parchi_id: inserted.id,
        crop_id: input.crop_id,
        mandi_id: input.mandi_id,
        amount: totalAmount,
        hash: inserted.current_hash,
        payment_mode: input.payment_mode,
        payment_reference: input.payment_reference ?? null,
        credit_note: input.credit_note ?? null,
      },
    });
  } catch {
    // keep the parchi response intact even if the alert table is unavailable
  }

  return NextResponse.json({ ...inserted, quality_hash: qualityHash, genesis_anchor: genesisAnchor }, { status: 201 });
}
