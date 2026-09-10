export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createClient } from "@supabase/supabase-js";

/**
 * Verify an OTP the user received on sign-in. Returns the session access
 * token + refresh token so the client can store them and forward the JWT
 * to every subsequent server request.
 */

const verifySchema = z.object({
  phone: z.string().regex(/^[6-9]\d{9}$/, { message: "Enter a valid 10-digit mobile number." }),
  token: z.string().min(1),
});

const normalizePhone = (p: string) => "+91" + p;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = verifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_failed", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { phone, token } = parsed.data;

  // Verify the OTP via the anon client (the admin client can't verify).
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { "cache-control": "no-store" } } }
  );

  const { data, error } = await anonClient.auth.verifyOtp({
// Prefix with the +91 country code — GoTrue stores and verifies E.164.
    phone: normalizePhone(phone),
    token,
    type: "sms",
  });

  if (error || !data.session || !data.user) {
    return NextResponse.json({ error: "invalid_otp", message: error?.message ?? "Invalid or expired code." }, { status: 401 });
  }

  // Look up the user's role for client-side routing.
  const { data: userRow } = await supabaseAdmin
    .from("users")
    .select("role, name")
    .eq("id", data.user.id)
    .maybeSingle();

  return NextResponse.json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_in: data.session.expires_in,
    user: { id: data.user.id, role: userRow?.role ?? "farmer", name: userRow?.name ?? "" },
  });
}