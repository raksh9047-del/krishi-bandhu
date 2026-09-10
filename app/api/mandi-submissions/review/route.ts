export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * POST /api/mandi-submissions/review — admin approve/reject.
 *
 * A submitted mandi is NEVER surfaced as live data until an admin approves it.
 * The `reviewed_by` id must resolve to a role='admin' user (mirrors the
 * mandi_submissions_admin_update RLS policy). `reviewed_at` is stamped server-side.
 */
const reviewSchema = z.object({
  id: z.string().uuid(),
  reviewed_by: z.string().uuid(),
  status: z.enum(["approved", "rejected"]),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", fields: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const input = parsed.data;

  const { data: reviewer, error: reviewerErr } = await supabaseAdmin
    .from("users")
    .select("id, role")
    .eq("id", input.reviewed_by)
    .maybeSingle();

  if (reviewerErr || !reviewer) {
    return NextResponse.json(
      { error: "validation_failed", fields: { reviewed_by: ["Reviewer not found."] } },
      { status: 400 }
    );
  }
  if (reviewer.role !== "admin") {
    return NextResponse.json(
      { error: "forbidden", message: "Only admins can review mandi submissions." },
      { status: 403 }
    );
  }

  const { data: updated, error: updateErr } = await supabaseAdmin
    .from("mandi_submissions")
    .update({
      status: input.status,
      reviewed_by: input.reviewed_by,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .select()
    .single();

  if (updateErr || !updated) {
    return NextResponse.json({ error: "update_failed", message: updateErr?.message }, { status: 500 });
  }

  return NextResponse.json({ submission: updated });
}