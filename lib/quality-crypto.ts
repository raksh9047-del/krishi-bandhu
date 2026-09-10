/**
 * Visual Quality Passport — separate hash chain for quality metadata.
 *
 * The transaction hash (parchi-crypto.ts) protects the financial record:
 * weight, price, deduction, payment mode. The quality hash protects the
 * physical inspection record: photos, grade, moisture. These are separate
 * chains because:
 *
 * 1. A remote buyer wants to verify grade without seeing financial details
 * 2. A quality dispute doesn't require revealing the sale price
 * 3. The two chains can be verified independently
 */

import type { ParchiRecord } from "@/types";

interface QualityPayload {
  parchi_id: string;
  trader_id: string;
  crop_id: string;
  quality_grade: string;
  photo_url: string | null;
  moisture_percent: number | null;
  timestamp: string;
}

function stableStringify(payload: object): string {
  const sorted = Object.keys(payload)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = (payload as Record<string, unknown>)[key];
      return acc;
    }, {});
  return JSON.stringify(sorted);
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Generate a quality hash from a Parchi's quality metadata.
 * This is separate from the transaction hash — it protects the
 * physical inspection record, not the financial record.
 */
export async function generateQualityHash(
  parchi: Pick<ParchiRecord, "id" | "trader_id" | "crop_id">,
  qualityGrade: string,
  photoUrl: string | null,
  moisturePercent: number | null
): Promise<string> {
  const payload: QualityPayload = {
    parchi_id: parchi.id,
    trader_id: parchi.trader_id,
    crop_id: parchi.crop_id,
    quality_grade: qualityGrade,
    photo_url: photoUrl ?? null,
    moisture_percent: moisturePercent,
    timestamp: new Date().toISOString(),
  };

  const chainInput = stableStringify(payload);
  return sha256Hex(chainInput);
}

/**
 * Verify a quality hash against the stored metadata.
 * Returns true if the hash matches the current data.
 */
export async function verifyQualityHash(
  storedHash: string,
  parchi: Pick<ParchiRecord, "id" | "trader_id" | "crop_id">,
  qualityGrade: string,
  photoUrl: string | null,
  moisturePercent: number | null,
  timestamp: string
): Promise<boolean> {
  const payload: QualityPayload = {
    parchi_id: parchi.id,
    trader_id: parchi.trader_id,
    crop_id: parchi.crop_id,
    quality_grade: qualityGrade,
    photo_url: photoUrl ?? null,
    moisture_percent: moisturePercent,
    timestamp,
  };

  const chainInput = stableStringify(payload);
  const recomputed = await sha256Hex(chainInput);
  return recomputed === storedHash;
}
