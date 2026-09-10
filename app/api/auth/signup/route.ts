export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * Sign up a new farmer or trader. Creates BOTH:
 *   1. A Supabase Auth user (phone-based, OTP login).
 *   2. A `users` row whose `id` matches the auth user's UUID.
 *
 * The trigger in supabase/schema.sql keeps them in sync; without it, RLS
 * policies that key off `auth.uid()` would never match because `users.id`
 * (a fresh UUID from the insert) wouldn't equal the auth user's UUID.
 */

const signupSchema = z.object({
  role: z.enum(["farmer", "trader"]),
  name: z.string().min(1),
  phone: z.string().regex(/^[6-9]\d{9}$/, { message: "Enter a valid 10-digit mobile number." }),
  upi_vpa: z
    .string()
    .regex(/^[\w.-]+@[\w]+$/, { message: "Enter a valid UPI ID, like name@bank." })
    .nullable()
    .optional(),
});

// GoTrue requires E.164 (+country code). Store both the normalized form in
// auth and the same normalized form in `users` so role lookups always match.
const normalizePhone = (p: string) => "+91" + p;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_failed", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { role, name, upi_vpa } = parsed.data;
  const phone = normalizePhone(parsed.data.phone);

  // 1. Create the auth user via the admin client. This is the correct API
  //    for phone-only auth in this SDK version — the anon client's `signUp`
  //    type definition requires a password, which we don't want.
  const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
    phone,
    user_metadata: { role, name },
  });

  if (authError || !authUser) {
    if (authError?.code === "user_already_exists") {
      return NextResponse.json({ error: "phone_taken", message: "This phone number is already registered." }, { status: 409 });
    }
    return NextResponse.json({ error: "auth_failed", message: authError?.message ?? "Could not create account." }, { status: 500 });
  }

  // 2. Insert the users row with the SAME UUID so RLS (auth.uid() = users.id) works.
  const { data: userRow, error: insertError } = await supabaseAdmin
    .from("users")
    .insert({ id: authUser.user.id, role, name, phone, upi_vpa: upi_vpa ?? null })
    .select("id")
    .single();

  if (insertError || !userRow) {
    // Roll back the auth user so we don't leave an orphan.
    await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
    if (insertError?.code === "23505") {
      return NextResponse.json({ error: "phone_taken", message: "This phone number is already registered." }, { status: 409 });
    }
    return NextResponse.json({ error: "insert_failed", message: insertError?.message }, { status: 500 });
  }

  return NextResponse.json({ id: userRow.id, role, name }, { status: 201 });
}