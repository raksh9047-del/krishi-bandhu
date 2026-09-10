export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";

const roleSchema = z.enum(["farmer", "trader", "fpo", "admin"]);

/**
 * Minimal directory lookup for the pilot's role-scoped dropdowns (the farmer
 * app needs a trader picker for "Record a sale"; there is no self-serve auth
 * session to scope this by, so it reads the seeded directory via the admin
 * client).
 */
export async function GET(req: NextRequest) {
  const roleParam = req.nextUrl.searchParams.get("role");
  const parsed = roleSchema.safeParse(roleParam);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", message: "role query param must be one of farmer, trader, fpo, admin." },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id, name, phone")
    .eq("role", parsed.data)
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "query_failed", message: error.message }, { status: 500 });
  }

  return NextResponse.json({ users: data ?? [] });
}