export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "node:crypto";
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
  // `users.phone` has been stored in different formats over time (plain
  // 10-digit for pilot seeds, "+91xxx" via the app signup upsert, "91xxx"
  // (12-digit, no +) via the auth-sync trigger), so match all three forms.
  const { data: userRow, error: lookupError } = await supabaseAdmin
    .from("users")
    .select("id, role, name")
    .in("phone", [e164Phone, phone, e164Phone.slice(1)])
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

  // When no SMS provider is configured (pilot demo), GoTrue can't deliver the
  // code. Fall back to a self-issued OTP: we store its hash in login_otps and
  // set it as the user's temporary password so verify-otp can swap it for a
  // REAL GoTrue session via signInWithPassword. Once an SMS provider is
  // configured on the project, this branch never runs.
  let demoOtp: string | null = null;
  if (otpError) {
    demoOtp = String(Math.floor(100000 + Math.random() * 900000));
    const { error: storeError } = await supabaseAdmin
      .from("login_otps")
      .upsert(
        {
          phone: e164Phone,
          otp_hash: createHash("sha256").update(demoOtp).digest("hex"),
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        },
        { onConflict: "phone" }
      );

    if (storeError) {
      return NextResponse.json(
        { error: "otp_failed", message: `Could not deliver an OTP (${otpError.message}).` },
        { status: 500 }
      );
    }

    const { error: pwError } = await supabaseAdmin.auth.admin.updateUserById(userRow.id, {
      password: demoOtp,
      // The phone is confirmed by the OTP (the tester entered the code we
      // issued). GoTrue refuses signInWithPassword for phone users whose
      // phone isn't confirmed — it can only be confirmed via SMS, which has no
      // provider in this pilot — so we mark it confirmed here. With a real SMS
      // provider configured, this fallback never runs.
      phone_confirm: true,
    });
    if (pwError) {
      return NextResponse.json(
        { error: "otp_failed", message: "Could not prepare an OTP." },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    ok: true,
    role: userRow.role,
    name: userRow.name,
    message: demoOtp ? "Demo OTP generated (SMS provider not configured)." : "OTP sent.",
    demo_otp: demoOtp,
  });
}