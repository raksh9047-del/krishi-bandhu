export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/parchi/upload-photo
 *
 * Accepts a multipart/form-data with a "file" field and optional "parchi_id".
 * Uploads the photo to Supabase Storage and returns the public URL.
 *
 * In production, this would also compute a quality hash and store it
 * alongside the Parchi. For the demo, we store the URL and let the
 * Parchi create route handle the hash.
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const parchiId = (formData.get("parchi_id") as string) || `temp_${Date.now()}`;

    if (!file) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Only image files are accepted." }, { status: 400 });
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "File must be under 5MB." }, { status: 400 });
    }

    const { supabaseAdmin } = await import("@/lib/supabase-admin");

    // Generate a unique filename
    const ext = file.name.split(".").pop() || "jpg";
    const filePath = `parchi-photos/${parchiId}_${Date.now()}.${ext}`;

    // Convert File to ArrayBuffer for Supabase upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabaseAdmin.storage
      .from("krishi-media")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      // If bucket doesn't exist or upload fails, return a placeholder URL
      // In production, you'd create the bucket first
      console.warn("[parchi-photo] Upload failed:", uploadError.message);
      return NextResponse.json({
        url: null,
        warning: "Photo upload unavailable — quality passport will use grade only.",
      });
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from("krishi-media")
      .getPublicUrl(filePath);

    return NextResponse.json({ url: urlData.publicUrl });
  } catch (err) {
    console.error("[parchi-photo] Error:", err);
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
}
