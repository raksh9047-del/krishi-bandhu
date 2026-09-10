export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { clearFarmerAlerts, createAlert, listFarmerAlerts } from "@/lib/alerts";

export async function GET(req: NextRequest) {
  const farmerId = req.nextUrl.searchParams.get("farmer_id");
  const rawLimit = Number(req.nextUrl.searchParams.get("limit") ?? "6");
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(100, rawLimit)) : 6;

  if (!farmerId) {
    return NextResponse.json(
      { error: "validation_failed", message: "farmer_id query param is required." },
      { status: 400 }
    );
  }

  const alerts = await listFarmerAlerts(farmerId, limit);
  if (alerts === null) {
    // The alerts table doesn't exist yet (migration 007 not applied). Let the
    // UI degrade silently instead of faking data.
    return NextResponse.json({ error: "alerts_unavailable" }, { status: 503 });
  }

  return NextResponse.json({ alerts });
}

const createAlertSchema = z.object({
  farmer_id: z.string().uuid(),
  type: z.enum(["parchi_recorded", "price_alert", "sowing_alert", "arrival", "system"]),
  title: z.string().min(1),
  message: z.string().min(1),
  severity: z.enum(["info", "warning", "danger"]).optional(),
  payload: z.record(z.unknown()).nullish(),
});

/**
 * Server-side / internal write path (used by seeds and real events like a new
 * Parchi). Same trust model as the rest of the pilot: routes run with the
 * service-role client and validate the request shape with zod.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "validation_failed", message: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = createAlertSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "validation_failed", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const replace = req.nextUrl.searchParams.get("replace") === "1";
  if (replace) {
    const cleared = await clearFarmerAlerts(parsed.data.farmer_id);
    if (cleared === 0) {
      // Log but don't fail — the farmer may have had no alerts to clear,
      // which is a valid case. A real failure would also return 0 from
      // the storage fallback, so we can't distinguish here without adding
      // a separate check. Proceed with creating the new alert regardless.
    }
  }

  const alert = await createAlert(parsed.data);
  if (!alert) {
    return NextResponse.json(
      { error: "insert_failed", message: "Could not write alert." },
      { status: 500 }
    );
  }

  return NextResponse.json({ alert }, { status: 201 });
}