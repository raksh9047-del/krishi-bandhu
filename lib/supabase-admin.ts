import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client for TRUSTED SERVER-SIDE CODE ONLY (app/api/**\/route.ts
 * files) — bypasses Row-Level Security entirely.
 *
 * Why this exists: the API routes built in Phases 3–5 (Parchi create/verify,
 * Sowing Signal calculate, UPI link, disputes) were originally written
 * against the public anon client from `lib/supabase.ts`. That's wrong for a
 * server route — the anon client has no forwarded end-user session, so every
 * RLS policy that checks `auth.uid()` (e.g. "traders can insert Parchi rows
 * where they're trader_id") would silently block these writes in a real
 * deployment. The anon client stays correct for direct CLIENT-SIDE reads of
 * public tables (crops, mandis, storage_directory, fpo_price_entries,
 * backhaul_trucks) — this admin client is for server routes only.
 *
 * Authorization for these routes is therefore enforced by application logic
 * (the zod-validated request shape, and checking that ids in the body match
 * what the caller should be allowed to touch) rather than by RLS. For a real
 * production deployment beyond this pilot, forward the end user's Supabase
 * session JWT to these routes and use a request-scoped client instead — flag
 * this as a Phase 10 hardening item, not a pilot blocker.
 *
 * NEVER import this file into a Client Component or anything bundled to the
 * browser — the service role key must never reach client JS.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

if (!supabaseUrl || !serviceRoleKey) {
  console.warn(
    "[KrishiBandhu] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars for the admin client."
  );
}

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});
