export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "node:crypto";
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
    phone: normalizePhone(phone),
    token,
    type: "sms",
  });

  let session = data?.session ?? null;

  // Pilot fallback: the demo login route issues its own OTP (and sets it as a
  // temporary password) when no SMS provider is configured. If GoTrue's real
  // verifyOtp rejects the code, check our login_otps record and, on match,
  // mint a genuine session via signInWithPassword. With an SMS provider
  // configured, this code path is never reached.
  if (error || !session) {
    const { data: rec } = await supabaseAdmin
      .from("login_otps")
      .select("otp_hash, expires_at")
      .eq("phone", normalizePhone(phone))
      .maybeSingle();

    const valid =
      rec &&
      new Date(rec.expires_at).getTime() > Date.now() &&
      createHash("sha256").update(token).digest("hex") === rec.otp_hash;

    if (!valid) {
      return NextResponse.json({ error: "invalid_otp", message: "Invalid or expired code." }, { status: 401 });
    }

    const { data: pwData, error: pwError } = await anonClient.auth.signInWithPassword({
      phone: normalizePhone(phone),
      password: token,
    });

    if (pwError || !pwData.session) {
      return NextResponse.json({ error: "invalid_otp", message: "Invalid or expired code." }, { status: 401 });
    }
    session = pwData.session;
    await supabaseAdmin.from("login_otps").delete().eq("phone", normalizePhone(phone));
  }

  if (!session) {
    return NextResponse.json({ error: "invalid_otp", message: "Invalid or expired code." }, { status: 401 });
  }

  // Look up the user's role for client-side routing.
  const { data: userRow } = await supabaseAdmin
    .from("users")
    .select("role, name")
    .eq("id", session.user.id)
    .maybeSingle();

  return NextResponse.json({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in,
    user: { id: session.user.id, role: userRow?.role ?? "farmer", name: userRow?.name ?? "" },
  });
}