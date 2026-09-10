/**
 * KrishiBandhu — Phase 3 Part A: Hash-Chain Trust Engine.
 *
 * These are pure functions with no I/O, deliberately — Phase 7's tamper-demo
 * screen calls `verifyChainIntegrity` directly against a mutated in-memory
 * array without hitting the network, and that only works if this file never
 * reaches out to Supabase or anything else itself.
 */

import type { ParchiRecord } from "@/types";

/** Genesis records hash this literal string in place of a previous hash. */
export const GENESIS_SEED = "GENESIS";

/** The fields that make up a Parchi's hashed payload — everything that, if
 * altered after the fact, should break the chain. Deliberately excludes
 * `current_hash` itself and `photo_url`/`quality_grade` (those are trust-
 * layer metadata, not the weighbridge transaction the hash protects).
 *
 * `payment_mode` / `payment_reference` / `credit_note` ARE hashed in: the
 * research finding is that forcing a digital payment rail breaks the
 * farmer-trader informal-credit loop, so the Parchi must record a sale
 * identically regardless of how money moved. Including the mode in the hash
 * is what makes verification genuinely agnostic to it — the mode is part of
 * the tamper-evident record, not a side channel outside it. */
function toHashPayload(record: Pick<
  ParchiRecord,
  "farmer_id" | "trader_id" | "crop_id" | "mandi_id" | "gross_weight" | "deduction_percent" | "price_per_quintal" | "timestamp" | "payment_mode" | "payment_reference" | "credit_note"
>): Record<string, unknown> {
  return {
    farmer_id: record.farmer_id,
    trader_id: record.trader_id,
    crop_id: record.crop_id,
    mandi_id: record.mandi_id,
    gross_weight: record.gross_weight,
    deduction_percent: record.deduction_percent,
    price_per_quintal: record.price_per_quintal,
    payment_mode: record.payment_mode,
    payment_reference: record.payment_reference ?? null,
    credit_note: record.credit_note ?? null,
    // Canonicalize so hashing and verifying agree byte-for-byte: the create
    // route hashes `new Date().toISOString()` ("...Z"), while PostgREST reads
    // the same instant back as "...+00:00". Those are two different strings
    // and would silently break every chain verification.
    timestamp: new Date(record.timestamp).toISOString(),
  };
}

/** Deterministically stringify by sorting keys alphabetically, so identical
 * data always produces the same hash regardless of insertion order. */
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
 * SHA-256 of the payload chained to `previousHash`. For a genesis record,
 * pass `previousHash = null` — the genesis constant `GENESIS_SEED` is hashed
 * in its place, and every downstream verification must expect that at
 * index 0 rather than treating a null previous hash as an error.
 */
export async function generateParchiHash(
  payload: object,
  previousHash: string | null
): Promise<string> {
  const chainInput = stableStringify(payload) + (previousHash ?? GENESIS_SEED);
  return sha256Hex(chainInput);
}

export interface ChainVerificationResult {
  isValid: boolean;
  brokenAtIndex: number | null;
}

/**
 * Walks the chain in timestamp order, recomputing each entry's hash from its
 * payload + the previous entry's stored hash, and compares against what's
 * stored. Stops at the FIRST mismatch — every entry after a break will also
 * mismatch by construction, so continuing to scan only wastes work and
 * produces a confusing "multiple breaks" result for what is really one break.
 */
export async function verifyChainIntegrity(
  entries: ParchiRecord[]
): Promise<ChainVerificationResult> {
  const ordered = [...entries].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  for (let i = 0; i < ordered.length; i++) {
    const entry = ordered[i];
    const previousHash = i === 0 ? null : ordered[i - 1].current_hash;
    const recomputed = await generateParchiHash(toHashPayload(entry), previousHash);
    if (recomputed !== entry.current_hash) {
      return { isValid: false, brokenAtIndex: i };
    }
  }

  return { isValid: true, brokenAtIndex: null };
}

export interface GenesisAnchor {
  hash: string;
  mockSmsPayload: string;
  mockFpoLogEntry: { farmer_id: string; mandi_id: string; hash: string; loggedAt: string };
}

/**
 * For a farmer/mandi's first-ever Parchi, anchors the genesis hash OUTSIDE
 * the database — a mock SMS receipt and a mock "FPO physical log" entry.
 * This closes the "corrupt DB admin rewrites the whole chain" gap: doing so
 * undetected would require compromising the database, the telecom record,
 * AND the paper log simultaneously.
 */
export async function generateGenesisAnchor(
  payload: { farmer_id: string; farmer_name: string; mandi_id: string; mandi_name: string; crop_name: string } & Parameters<typeof toHashPayload>[0]
): Promise<GenesisAnchor> {
  const hash = await generateParchiHash(toHashPayload(payload), null);
  const loggedAt = new Date().toISOString();
  const hashPrefix = hash.slice(0, 8);

  return {
    hash,
    mockSmsPayload: `KrishiBandhu Parchi #${hashPrefix} confirmed for ${payload.farmer_name}, ${payload.crop_name} at ${payload.mandi_name}, ${loggedAt}`,
    mockFpoLogEntry: {
      farmer_id: payload.farmer_id,
      mandi_id: payload.mandi_id,
      hash,
      loggedAt,
    },
  };
}
