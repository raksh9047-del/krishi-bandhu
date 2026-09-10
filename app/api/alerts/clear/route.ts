export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { clearFarmerAlerts } from "@/lib/alerts";

const schema = z.object({ farmer_id: z.string().uuid() });

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "validation_failed", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const removed = await clearFarmerAlerts(parsed.data.farmer_id);
  return NextResponse.json({ removed });
}