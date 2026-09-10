export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { StorageFacility } from "@/types";
import { STORAGE_REFERENCE } from "@/lib/storage-reference";

/**
 * RLS-safe read of the storage directory. The `storage_directory` public-read
 * policy is scoped to the `authenticated` role, but this pilot's browser (anon
 * client) is never an authenticated session — so a direct client read returns
 * zero rows. Reading through the admin client here keeps the farmer screen
 * showing the facilities (same pattern as /api/sowing-signal).
 *
 * If the table has no rows yet, the endpoint serves the built-in reference
 * dataset with `has_reference: true` so the demo is not an empty screen — same
 * mechanism as the market-price `seed` source. Real DB rows take precedence the
 * moment they exist.
 *
 * NOTE on caching: the admin client (`lib/supabase-admin.ts`) sends
 * `cache-control: no-store` because an HTTP cache between the server and
 * Supabase REST served stale GET bodies — including intermittently empty
 * results for `.order("district")` on this table. With no-store the ordered
 * query is deterministic; keep `no-store` on any client that reads PostgREST.
 */
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("storage_directory")
    .select("*")
    .order("district", { ascending: true })
    .order("facility_name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "query_failed", message: error.message }, { status: 500 });
  }

  const dbRows = (data as StorageFacility[] | null) ?? [];
  if (dbRows.length > 0) {
    return NextResponse.json({ facilities: dbRows, has_reference: false });
  }

  return NextResponse.json({ facilities: STORAGE_REFERENCE, has_reference: true });
}