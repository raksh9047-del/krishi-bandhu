import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * `parchi_ledger` only has SELECT and INSERT RLS policies (Phase 2) — there
 * is no UPDATE policy at all, so a direct client-side update (quality grade,
 * photo URL) would be silently rejected. Same root cause as everywhere else
 * in this pilot: no forwarded auth session, so everything server-side goes
 * through the admin client instead of relying on RLS.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const parchiId = form.get("parchi_id");
  const qualityGrade = form.get("quality_grade");
  const assayerGrade = form.get("assayer_override_grade");
  const photo = form.get("photo") as File | null;

  if (typeof parchiId !== "string" || !parchiId) {
    return NextResponse.json({ error: "validation_failed", message: "parchi_id is required." }, { status: 400 });
  }

  let photoUrl: string | null = null;
  if (photo && photo.size > 0) {
    const path = `${parchiId}-${Date.now()}-${photo.name}`;
    const buffer = Buffer.from(await photo.arrayBuffer());
    const { error: uploadErr } = await supabaseAdmin.storage.from("parchi-photos").upload(path, buffer, {
      contentType: photo.type,
    });
    if (uploadErr) {
      return NextResponse.json({ error: "upload_failed", message: uploadErr.message }, { status: 500 });
    }
    const { data: urlData } = supabaseAdmin.storage.from("parchi-photos").getPublicUrl(path);
    photoUrl = urlData.publicUrl;
  }

  const updatePayload: Record<string, unknown> = {
    quality_grade: qualityGrade,
    assayer_override_grade: assayerGrade,
  };
  if (photoUrl) updatePayload.photo_url = photoUrl;

  const { data, error } = await supabaseAdmin
    .from("parchi_ledger")
    .update(updatePayload)
    .eq("id", parchiId)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "update_failed", message: error?.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
