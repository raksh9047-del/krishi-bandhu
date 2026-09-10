import { createClient, SupabaseClient } from "@supabase/supabase-js";

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

/**
 * The client is created LAZILY on first use, not at module scope.
 *
 * Next.js evaluates every route module during `next build` ("Collecting page
 * data") to drive its static analysis, and on Vercel the service-role Secret
 * is only injected into the build for the actual bundling step — it is NOT
 * present when route modules are first imported during build. A module-scope
 * `createClient(url, key)` therefore throws "supabaseKey is required" at build
 * time even though the env var is correct at runtime. Deferring construction
 * until first property access keeps the build green while still failing fast
 * if the env is genuinely missing on first request.
 */

let cachedClient: SupabaseClient | null = null;

function getAdminClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "[KrishiBandhu] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars for the admin client."
    );
  }

  cachedClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
    // Never accept a cache-served GET. An HTTP cache on the path between the
    // server and Supabase REST served stale rows for unchanged-URL reads (e.g.
    // a long-lived GET returning old parchi hashes after an out-of-band SQL
    // repair). Reads must always reflect the committed database.
    global: { headers: { "cache-control": "no-store" } },
  });
  return cachedClient;
}

/**
 * Eagerly-memoised accessor that avoids Proxy fragility.
 *
 * The previous Proxy-based approach delegated every property access to the
 * underlying SupabaseClient at runtime, which worked but broke whenever
 * Supabase-js added new symbols (e.g. `Symbol.iterator`) or internal
 * properties that the Proxy didn't enumerate. A simple lazy-init getter
 * that caches the real client after first use is both simpler and immune
 * to those issues — the only constraint is that construction must be
 * deferred (see the original comment about Next.js build-time evaluation).
 */
export const supabaseAdmin: SupabaseClient = (() => {
  const handler: ProxyHandler<SupabaseClient> = {
    get(_target, prop, receiver) {
      const client = getAdminClient();
      // Delegate to the real client for every access including symbols.
      return Reflect.get(client, prop, receiver);
    },
    has(_target, prop) {
      const client = getAdminClient();
      return Reflect.has(client, prop);
    },
    ownKeys() {
      const client = getAdminClient();
      return Reflect.ownKeys(client);
    },
    getOwnPropertyDescriptor(_target, prop) {
      const client = getAdminClient();
      return Reflect.getOwnPropertyDescriptor(client, prop);
    },
  };
  return new Proxy({} as SupabaseClient, handler);
})();