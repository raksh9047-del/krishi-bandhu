export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { markFarmerAlertsRead } from "@/lib/alerts";

const schema = z.object({ farmer_id: z.string().uuid() });

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "validation_failed", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const updated = await markFarmerAlertsRead(parsed.data.farmer_id);
  if (updated === null) {
    return NextResponse.json({ error: "update_failed", message: "Could not mark alerts read (is migration 007 applied?)." }, { status: 500 });
  }

  return NextResponse.json({ updated });
}