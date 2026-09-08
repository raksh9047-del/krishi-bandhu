import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * DELETE /api/fpo/backhaul/:id — remove a truck entry. 404 when the id
 * isn't found rather than silently succeeding, so the admin UI can surface
 * "already deleted / not found" honestly.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { data: deleted, error } = await supabaseAdmin
    .from("backhaul_trucks")
    .delete()
    .eq("id", params.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "delete_failed", message: error.message }, { status: 500 });
  }
  if (!deleted) {
    return NextResponse.json(
      { error: "not_found", message: "No backhaul truck entry exists with that id." },
      { status: 404 }
    );
  }

  return NextResponse.json({ deleted: deleted.id });
}