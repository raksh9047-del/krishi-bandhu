import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";

const bodySchema = z.object({
  parchi_id: z.string().uuid(),
});

/**
 * Builds a `upi://pay` deep link per the NPCI UPI URI spec:
 *   pa = payee address (the farmer's VPA)
 *   pn = payee name
 *   am = amount
 *   cu = currency
 *   tn = transaction note
 * All values are URL-encoded. Phase 7's PaymentAction component opens this
 * directly on mobile (native app selector) or renders it as a QR code via
 * qrcode.react on desktop, since desktop can't open a UPI app directly.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_failed", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { parchi_id } = parsed.data;

  const { data: parchi, error: parchiErr } = await supabaseAdmin
    .from("parchi_ledger")
    .select("id, farmer_id, total_amount")
    .eq("id", parchi_id)
    .single();

  if (parchiErr || !parchi) {
    return NextResponse.json({ error: "not_found", message: "Parchi record not found." }, { status: 404 });
  }

  const { data: farmer, error: farmerErr } = await supabaseAdmin
    .from("users")
    .select("name, upi_vpa")
    .eq("id", parchi.farmer_id)
    .single();

  if (farmerErr || !farmer) {
    return NextResponse.json({ error: "not_found", message: "Farmer record not found." }, { status: 404 });
  }

  if (!farmer.upi_vpa) {
    return NextResponse.json(
      { error: "no_upi_vpa", message: "This farmer has no UPI VPA on file yet. Ask them to add one before paying out." },
      { status: 422 }
    );
  }

  const params = new URLSearchParams({
    pa: farmer.upi_vpa,
    pn: farmer.name,
    am: String(parchi.total_amount),
    cu: "INR",
    tn: `KrishiBandhu Parchi ${parchi.id}`,
  });

  const upiUri = `upi://pay?${params.toString()}`;

  return NextResponse.json({ upi_uri: upiUri, amount: parchi.total_amount, payee_name: farmer.name });
}
