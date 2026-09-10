/**
 * Extract the caller's Supabase session JWT from a Next request and return a
 * session-scoped server client.
 *
 * Usage in an API route:
 *   import { getServerClient, requireSession } from "@/lib/auth";
 *   export async function POST(req: NextRequest) {
 *     const { user, client } = await requireSession(req);
 *     if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
 *     // `client` is scoped to this user's JWT — RLS applies.
 *     const { data } = await client.from("parchi_ledger").select("*").eq("farmer_id", user.id);
 *   }
 *
 * For routes that need the caller's identity but don't need RLS enforced
 * (e.g. read-only lookups the admin client would also serve), use
 * `getServerClient(accessToken)` directly instead.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase-server";

export interface AuthenticatedContext {
  accessToken: string | null;
  user: { id: string } | null;
  client: ReturnType<typeof getServerClient>;
}

/**
 * Reads the `Authorization: Bearer <jwt>` header (set by the client via
 * `supabase.auth.getSession()`), validates it against Supabase, and returns
 * both the decoded user and a session-scoped client. Returns `user: null`
 * when the header is missing or the token is invalid — never throws.
 */
export async function authenticateRequest(
  req: NextRequest
): Promise<Omit<AuthenticatedContext, "client"> & { client: ReturnType<typeof getServerClient> }> {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  const client = getServerClient(token);
  if (!token) return { accessToken: null, user: null, client };

  const {
    data: { user },
    error,
  } = await client.auth.getUser(token);

  if (error || !user) return { accessToken: token, user: null, client };

  return { accessToken: token, user: { id: user.id }, client };
}

/**
 * Helper for routes that REQUIRE an authenticated caller. Returns a 401
 * response (or null when the caller is authorized) so routes can short-circuit
 * with a single guard clause.
 */
export async function requireSession(
  req: NextRequest
): Promise<{ user: { id: string }; client: ReturnType<typeof getServerClient> } | { response: NextResponse }> {
  const { user, client } = await authenticateRequest(req);
  if (!user) {
    return {
      response: NextResponse.json({ error: "unauthorized", message: "Sign in to continue." }, { status: 401 }),
    };
  }
  return { user, client };
}