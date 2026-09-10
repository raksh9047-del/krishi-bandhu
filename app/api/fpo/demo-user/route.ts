export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * GET /api/fpo/demo-user
 *
 * Pilot-scale stand-in for the FPO role, mirroring how farmers/traders
 * self-register against /api/users/register (the register route deliberately
 * refuses to mint fpo rows — FPOs are created out of band, in this case by
 * scripts/seed-pilot.mjs). This look-up keyed on the seeded phone number
 * keeps the FPO tools working before real session auth exists; Phase 10
 * replaces it with forwarded Supabase Auth sessions.
 */
const DEMO_FPO_PHONE = process.env.DEMO_FPO_PHONE;

export async function GET() {
  if (!DEMO_FPO_PHONE) {
    return NextResponse.json(
      { error: "demo_fpo_missing", message: "DEMO_FPO_PHONE env var is not set. Run scripts/seed-pilot.mjs --apply first." },
      { status: 500 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id, name")
    .eq("role", "fpo")
    .eq("phone", DEMO_FPO_PHONE)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "query_failed", message: error.message },
      { status: 500 }
    );
  }
  if (!data) {
    return NextResponse.json(
      {
        error: "demo_fpo_missing",
        message: "Run scripts/seed-pilot.mjs first — it seeds the demo FPO identity.",
      },
      { status: 404 }
    );
  }

  return NextResponse.json({ fpo: data });
}