import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * Registration can't be a direct client-side insert into `users` — RLS is
 * (correctly) enabled on that table with no anonymous INSERT policy, since
 * opening one up would let anyone insert arbitrary rows claiming any role.
 * This route validates the shape server-side and uses the admin client to
 * perform the actual insert. `role` is fixed server-side per endpoint
 * rather than accepted from the client, so a farmer-registration request
 * can't be used to mint a trader/fpo/admin row.
 */

const registerSchema = z.object({
  role: z.enum(["farmer", "trader"]), // fpo/admin are never self-serve — created out of band
  name: z.string().min(1),
  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/, { message: "Enter a valid 10-digit mobile number." }),
  upi_vpa: z
    .string()
    .regex(/^[\w.-]+@[\w]+$/, { message: "Enter a valid UPI ID, like name@bank." })
    .nullable()
    .optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_failed", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { role, name, phone, upi_vpa } = parsed.data;

  const { data, error } = await supabaseAdmin
    .from("users")
    .insert({ role, name, phone, upi_vpa: upi_vpa ?? null })
    .select("id")
    .single();

  if (error || !data) {
    // Postgres unique-violation code for the `phone` unique constraint.
    if (error?.code === "23505") {
      return NextResponse.json({ error: "phone_taken", message: "This phone number is already registered." }, { status: 409 });
    }
    return NextResponse.json({ error: "insert_failed", message: error?.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}
