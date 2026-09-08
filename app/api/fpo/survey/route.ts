import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getCropById } from "@/constants";

/**
 * POST /api/fpo/survey
 *
 * FPO farmer-survey logging (village, crop, area, expected harvest month,
 * optional farmer name) into fpo_survey_responses. Owner-scoped write → admin
 * client, same rationale as /api/fpo/price-entry.
 */
const surveySchema = z.object({
  fpo_id: z.string().uuid(),
  village: z.string().min(1),
  crop_id: z.string(),
  area_hectares: z.number().positive({ message: "Area must be greater than 0." }),
  expected_harvest_month: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Pick a valid date." }),
  farmer_name: z.string().nullable().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = surveySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", fields: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { fpo_id, village, crop_id, area_hectares, expected_harvest_month, farmer_name } = parsed.data;

  const crop = getCropById(crop_id);
  if (!crop) {
    return NextResponse.json(
      { error: "validation_failed", fields: { crop_id: ["Unknown crop_id."] } },
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

  const { data: response, error } = await supabaseAdmin
    .from("fpo_survey_responses")
    .insert({
      fpo_id,
      village,
      crop_id,
      area_hectares,
      expected_harvest_month,
      farmer_name: farmer_name ?? null,
    })
    .select()
    .single();

  if (error || !response) {
    return NextResponse.json({ error: "insert_failed", message: error?.message }, { status: 500 });
  }

  return NextResponse.json(response, { status: 201 });
}