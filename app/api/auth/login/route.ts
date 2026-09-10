export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createClient } from "@supabase/supabase-js";

/**
 * Sign in with phone number. Triggers an OTP delivery to the phone via
 * Supabase Auth's anon client.
 *
 * The client stores the resulting session and forwards its JWT to every
 * subsequent server request (see lib/auth.ts).
 */

const loginSchema = z.object({
  phone: z.string().regex(/^[6-9]\d{9}$/, { message: "Enter a valid 10-digit mobile number." }),
});

// GoTrue requires E.164 (+country code). The app stores pilots as plain
// 10-digit numbers, so normalize to +91 and look up either form.
const normalizePhone = (p: string) => "+91" + p;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_failed", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { phone } = parsed.data;
  const e164Phone = normalizePhone(phone);

  // Look up the user's role so the client can route to the right dashboard.
  const { data: userRow, error: lookupError } = await supabaseAdmin
    .from("users")
    .select("id, role, name")
    .in("phone", [e164Phone, phone])
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json({ error: "query_failed", message: lookupError.message }, { status: 500 });
  }
  if (!userRow) {
    return NextResponse.json({ error: "not_registered", message: "This phone number is not registered. Sign up first." }, { status: 404 });
  }

  // Send OTP via the anon client.
  //
  // The correct phone-OTP API in @supabase/supabase-js >= 2.10 is
  // `signInWithOtp({ phone })`. The older `signUp({ phone })` path was a
  // workaround for pre-2.10 SDKs that required a password; on modern SDKs it
  // rejects with "Signup requires a valid password" even though the intent is
  // purely a phone OTP trigger. `signInWithOtp` is the documented, stable call
  // for this flow and is what the verify route (`verifyOtp`, type "sms")
  // expects on the other side.
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { "cache-control": "no-store" } } }
  );

  const { error: otpError } = await anonClient.auth.signInWithOtp({ phone: e164Phone });

  if (otpError) {
    return NextResponse.json({ error: "otp_failed", message: otpError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    role: userRow.role,
    name: userRow.name,
    message: "OTP sent.",
  });
}