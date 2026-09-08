import { supabaseAdmin } from "@/lib/supabase-admin";
import { PILOT_CROP_IDS, PILOT_MANDI_IDS } from "@/constants";

/**
 * Agmarknet live-price sync — server-only (do NOT import this file from a
 * Client Component: it pulls in the service-role Supabase client).
 *
 * Ported from krishibandhu_live_features.py. Agmarknet (data.gov.in) is a
 * daily mandi-price publication, not a real-time feed — the sync is meant to
 * run once per day (a Phase 10 cron/admin button), and anything it can't
 * fetch falls back to FPO manual entries / seed data.
 *
 * The external API keys its crops/markets by its own display names, so the
 * 3x3 pilot subset gets an explicit alias table below — the only hardcoded
 * external-name mapping in the app, and deliberately scoped to the pilot.
 */

export const AGMARKNET_RESOURCE_ID = "9ef84268-d588-465a-a308-a864a43d0070";
export const AGMARKNET_BASE_URL = `https://api.data.gov.in/resource/${AGMARKNET_RESOURCE_ID}`;

// Public sample key from the data.gov.in docs — capped at 10 records/call.
// Get a free key at data.gov.in and set DATA_GOV_IN_API_KEY to lift the cap.
export const AGMARKNET_DEMO_API_KEY = "579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b";

/** Agmarknet commodity names for the pilot subset (slug -> Agmarknet commodity). */
export const AGMARKNET_CROP_NAMES: Record<string, string> = {
  onion: "Onion",
  tomato: "Tomato",
  cotton: "Cotton",
};

/**
 * Agmarknet market names, as ordered candidate lists. The feed's market
 * naming is inconsistent across releases (Vashi appears as "Vashi" or
 * "New Mumbai"; Pune Gultekdi as "Pune" or "Pune (Gultekdi)"), so each
 * candidate is tried in order until one returns records. Every returned
 * record is still re-verified against the expected name before it is
 * attributed — see syncLivePrices below.
 */
export const AGMARKNET_MANDI_NAMES: Record<string, string[]> = {
  vashi: ["Vashi", "New Mumbai", "Navi Mumbai"],
  lasalgaon: ["Lasalgaon(Niphad)", "Lasalgaon(Vinchur)", "Lasalgaon", "Lasalgoan"],
  "pune-gultekdi": ["Pune (Gultekdi)", "Pune(Gultekdi)", "Pune"],
};

/** Which source a prices row can carry — live = Agmarknet, fpo = FPO manual. */
export type PriceSource = "live" | "fpo" | "seed";

export class AgmarknetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgmarknetError";
  }
}

interface AgmarknetRecord {
  commodity?: string;
  market?: string;
  state?: string;
  modal_price?: string | number;
  arrival_date?: string;
  [key: string]: unknown;
}

interface FetchOptions {
  commodity?: string;
  market?: string;
  state?: string;
  limit?: number;
  timeoutMs?: number;
  maxRetries?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchAgmarknetRecords(
  options: FetchOptions = {}
): Promise<AgmarknetRecord[]> {
  const { commodity, market, state, limit = 50, timeoutMs = 5000, maxRetries = 2 } = options;
  const apiKey = process.env.DATA_GOV_IN_API_KEY || AGMARKNET_DEMO_API_KEY;

  const params = new URLSearchParams({ "api-key": apiKey, format: "json", limit: String(limit), offset: "0" });
  if (commodity) params.set("filters[commodity]", commodity);
  if (market) params.set("filters[market]", market);
  if (state) params.set("filters[state]", state);

  const url = `${AGMARKNET_BASE_URL}?${params.toString()}`;

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(url, {
        signal: controller.signal,
        cache: "no-store",
        headers: { accept: "application/json" },
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { records?: AgmarknetRecord[] };
      return json.records ?? [];
    } catch (exc) {
      lastError = exc;
      if (attempt < maxRetries) {
        await sleep(500 * (attempt + 1));
      }
    }
  }
  throw new AgmarknetError(`Agmarknet fetch failed after ${maxRetries + 1} attempts: ${String(lastError)}`);
}

/** Agmarknet dates arrive as DD/MM/YYYY; normalize to ISO YYYY-MM-DD. */
export function parseAgmarknetDate(raw: string): string | null {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw.trim());
  if (!match) return null;
  const [, d, m, y] = match;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

/**
 * Pull live prices for every pilot crop x pilot mandi pair and upsert into
 * the `prices` table with source='live'. Idempotent via the
 * (crop_id, mandi_id, date, source) unique index. Returns fetch counts so a
 * caller can show what actually happened.
 */
export async function syncLivePrices(): Promise<{ fetched: number; matched: number; skipped: number }> {
  let fetched = 0;
  let matched = 0;
  let skipped = 0;

  const normalize = (value: unknown): string => String(value ?? "").trim().toLowerCase();

  for (const cropId of PILOT_CROP_IDS) {
    const commodity = AGMARKNET_CROP_NAMES[cropId];
    for (const mandiId of PILOT_MANDI_IDS) {
      const marketCandidates = AGMARKNET_MANDI_NAMES[mandiId] ?? [];

      // Try each known Agmarknet spelling for this mandi until one returns
      // records. A failed API call (AgmarknetError) moves on to the next
      // candidate; only an unexpected error aborts the whole sync.
      let matchedMarket: string | undefined;
      let records: AgmarknetRecord[] = [];
      for (const candidate of marketCandidates) {
        try {
          const attempt = await fetchAgmarknetRecords({ commodity, market: candidate, limit: 50 });
          if (attempt.length > 0) {
            matchedMarket = candidate;
            records = attempt;
            break;
          }
        } catch (exc) {
          if (exc instanceof AgmarknetError) continue;
          throw exc;
        }
      }
      if (records.length === 0) continue;

      const rows: {
        crop_id: string;
        mandi_id: string;
        price: number;
        date: string;
        source: "live";
        arrival_volume_tons: number | null;
      }[] = [];

      for (const rec of records) {
        fetched += 1;

        // Attribute a record ONLY if its own market field is the expected
        // one. The API's market filter has been observed to behave fuzzily;
        // without this guard a neighboring market's price could be filed
        // under this mandi_id and shown to farmers as theirs.
        if (matchedMarket && normalize(rec.market) !== normalize(matchedMarket)) {
          skipped += 1;
          continue;
        }

        const modalPrice = toNumber(rec.modal_price);
        const isoDate = typeof rec.arrival_date === "string" ? parseAgmarknetDate(rec.arrival_date) : null;
        if (modalPrice === null || !isoDate) {
          skipped += 1;
          continue;
        }
        const arrival = toNumber(rec.arrivals) ?? toNumber(rec.arrival_quantity);
        rows.push({
          crop_id: cropId,
          mandi_id: mandiId,
          price: modalPrice,
          date: isoDate,
          source: "live",
          arrival_volume_tons: arrival,
        });
      }

      if (rows.length === 0) continue;

      const { error } = await supabaseAdmin
        .from("prices")
        .upsert(rows, { onConflict: "crop_id,mandi_id,date,source" });
      if (error) throw error;
      matched += rows.length;
    }
  }

  return { fetched, matched, skipped };
}

export interface CurrentPrice {
  price: number;
  date: string;
  source: PriceSource;
  fetched_at: string;
}

/**
 * Final fallback per the integration spec: when the feed has no live or
 * seeded release for this pair, use the latest FPO manual entry from
 * fpo_price_entries. Source is reported as 'fpo' so the UI labels it
 * "FPO entry, updated Xh ago" — never a bare number.
 */
async function getLatestFpoPrice(cropId: string, mandiId: string): Promise<CurrentPrice | null> {
  const { data, error } = await supabaseAdmin
    .from("fpo_price_entries")
    .select("price_per_quintal, entered_at")
    .eq("crop_id", cropId)
    .eq("mandi_id", mandiId)
    .order("entered_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as { price_per_quintal: number | string; entered_at: string };
  const price = toNumber(row.price_per_quintal);
  if (price === null) return null;
  return {
    price,
    date: row.entered_at.slice(0, 10),
    source: "fpo",
    fetched_at: row.entered_at,
  };
}

/**
 * Latest price for a crop+mandi, preferring live over FPO/seed regardless of
 * recency, then the most recent date — mirrors get_current_price() in the
 * Python reference. Falls back to the latest FPO manual entry when the
 * prices table has nothing for this pair.
 */
export async function getCurrentPrice(cropId: string, mandiId: string): Promise<CurrentPrice | null> {
  const { data, error } = await supabaseAdmin
    .from("prices")
    .select("price, date, source, fetched_at")
    .eq("crop_id", cropId)
    .eq("mandi_id", mandiId)
    .order("date", { ascending: false })
    .limit(200);

  if (error) throw error;

  // Postgres numeric columns can surface as strings over the wire — coerce
  // once here so every consumer (API JSON, dashboard .toFixed()) gets a number.
  const rows = (data ?? []).map((r) => {
    const row = r as { price: number | string; date: string; source: PriceSource; fetched_at: string };
    return { ...row, price: toNumber(row.price) ?? 0 };
  });
  if (rows.length === 0) return getLatestFpoPrice(cropId, mandiId);

  const live = rows.filter((r) => r.source === "live");
  const preferred = live.length > 0 ? live : rows;
  return preferred[0] ?? getLatestFpoPrice(cropId, mandiId);
}