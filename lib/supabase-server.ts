import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Request-scoped Supabase client keyed to the caller's authenticated session.
 *
 * Unlike `lib/supabase-admin.ts` (service role, bypasses RLS), this client
 * forwards the end user's JWT so Row-Level Security policies actually apply.
 * Every API route that acts ON BEHALF of a specific user should use this
 * client — it is the difference between "RLS silently blocks the write" and
 * "the write is authorized by the policy engine".
 *
 * Construction is lazy and cached per-request (the token is read once per
 * request, not on every query). Pass `null` for `accessToken` to get an
 * unauthenticated client (equivalent to the anon client, useful for public
 * reads that don't need a session).
 */

let cachedClient: SupabaseClient | null = null;
let cachedToken: string | null | undefined = undefined;

export function getServerClient(accessToken?: string | null): SupabaseClient {
  // Token intentionally changed — invalidate the cache.
  if (cachedToken !== accessToken) {
    cachedClient = null;
    cachedToken = accessToken;
  }

  if (cachedClient) return cachedClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "[KrishiBandhu] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY env vars."
    );
  }

  cachedClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
    global: {
      headers: {
        "cache-control": "no-store",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
    },
  });

  return cachedClient;
}