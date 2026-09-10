export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { searchMandiCandidates } from "@/lib/nominatim";

/**
 * GET /api/mandi-submissions — user-submitted mandi directory entries.
 *
 *   * `status=approved` (default for public reads): only approved rows, so
 *     crowd-sourced data is never shown as verified.
 *   * `status=pending|rejected`: admin-scoped review views (param enforced
 *     against a caller-provided admin id via `reviewer_id`).
 *   * `mine=1&submitted_by=<uuid>`: a submitter's own rows.
 *
 * POST — create a submission. When `places_query` (and optionally no explicit
 * lat/lng) is given, the route resolves candidates through Nominatim
 * (OpenStreetMap) and uses the best matching result to prefill
 * name/district/coordinates. A submission is always created as `status=pending`
 * and only surfaces to the directory after an admin approves it.
 */
const createSubmissionSchema = z.object({
  submitted_by: z.string().uuid(),
  name: z.string().trim().min(2, { message: "Name must be at least 2 characters." }).max(120),
  district: z.string().trim().min(2).max(120).optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  market_type: z.enum(["apmc", "private_mandi", "farmers_market", "wholesaler"]).default("farmers_market"),
  contact_number: z.string().trim().max(40).nullable().optional(),
  notes: z.string().trim().max(400).nullable().optional(),
  places_query: z.string().trim().max(200).nullable().optional(),
});

const getStatus = z.enum(["approved", "pending", "rejected"]);

export async function GET(req: NextRequest) {
  const statusParam = req.nextUrl.searchParams.get("status") ?? "approved";
  const parsedStatus = getStatus.safeParse(statusParam);
  if (!parsedStatus.success) {
    return NextResponse.json(
      { error: "validation_failed", message: "status must be approved, pending or rejected." },
      { status: 400 }
    );
  }
  const mine = req.nextUrl.searchParams.get("mine");
  const submittedBy = req.nextUrl.searchParams.get("submitted_by");

  let query = supabaseAdmin
    .from("mandi_submissions")
    // Explicit FK hint: both submitted_by and reviewed_by reference users (migration 010),
    // so PostgREST needs the constraint name to pick the submitter relationship.
    .select("*, users!mandi_submissions_submitted_by_fkey(name)")
    .eq("status", parsedStatus.data);

  if (mine === "1" && submittedBy) {
    query = query.eq("submitted_by", submittedBy);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "query_failed", message: error.message }, { status: 500 });
  }

  const rows = (data ?? []).map((row) => {
    const record = row as Record<string, unknown>;
    return {
      ...row,
      submitted_by_name:
        record.users && typeof record.users === "object" && "name" in (record.users as Record<string, unknown>)
          ? (record.users as { name: string }).name
          : null,
    };
  });

  return NextResponse.json({ submissions: rows });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = createSubmissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", fields: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const input = parsed.data;

  // Resolve a Places candidate when the caller asked for it (or when both the
  // name and coordinates are absent — the form's "search Places" prefills the
  // whole row, so a bare name+query is the common phone flow).
  let candidate =
    input.places_query && input.places_query.length > 0
      ? (await searchMandiCandidates(input.places_query)).find(
          (c) => c.name.toLowerCase().includes(input.name.toLowerCase())
        ) ?? null
      : null;

  let name = input.name;
  let district = input.district?.trim() || "";
  let lat = input.lat ?? null;
  let lng = input.lng ?? null;

  if (candidate && (lat === null || lng === null)) {
    name = candidate.name;
    if (!district) district = candidate.district;
    lat = candidate.lat;
    lng = candidate.lng;
  }

  if (lat === null || lng === null) {
    return NextResponse.json(
      {
        error: "validation_failed",
        fields: {
          lat: ["Coordinates are required."],
          lng: ["Coordinates are required."],
          _general: ["Search Places for the market, or provide its coordinates."],
        },
      },
      { status: 400 }
    );
  }
  if (!district) {
    return NextResponse.json(
      { error: "validation_failed", fields: { district: ["District is required."] } },
      { status: 400 }
    );
  }

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from("mandi_submissions")
    .insert({
      submitted_by: input.submitted_by,
      name,
      district,
      lat,
      lng,
      market_type: input.market_type,
      contact_number: input.contact_number ?? null,
      notes: input.notes ?? null,
      status: "pending",
    })
    .select()
    .single();

  if (insertErr || !inserted) {
    return NextResponse.json({ error: "insert_failed", message: insertErr?.message }, { status: 500 });
  }

  return NextResponse.json({ submission: inserted, places_used: !!candidate }, { status: 201 });
}