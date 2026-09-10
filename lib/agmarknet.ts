import { supabaseAdmin } from "@/lib/supabase-admin";
import { ALL_CROP_IDS, ALL_MANDI_IDS } from "@/constants";

/**
 * Agmarknet live-price sync — server-only (do NOT import this file from a
 * Client Component: it pulls in the service-role Supabase client).
 *
 * Ported from krishibandhu_live_features.py. Agmarknet (data.gov.in) is a
 * daily mandi-price publication, not a real-time feed — the sync is meant to
 * run once per day (a Phase 10 cron/admin button), and anything it can't
 * fetch falls back to FPO manual entries / seed data.
 *
 * DATA SEMANTICS (verified against the live data.gov.in feed 2026-09):
 *   * The data.gov.in resource only serves the LATEST published day — it does
 *     not retain a queryable history. A request with no date filter returns
 *     that day's records; a stale `arrival_date` filter is ignored.
 *   * Records are filterable by state and commodity with exact display names
 *     (e.g. "Onion", "Soyabean", "Jowar(Sorghum)", "Red gram/Arhar/Tur(whole)").
 *     `filters[market]` is fuzzy, so we NEVER attribute a record on the market
 *     filter alone: we filter by state + commodity server-side, then match the
 *     returned record's own `market` field against a per-mandi alias list.
 *   * modal_price is ₹/quintal as published — displayed as-is, never converted.
 */

export const AGMARKNET_RESOURCE_ID = "9ef84268-d588-465a-a308-a864a43d0070";
export const AGMARKNET_BASE_URL = `https://api.data.gov.in/resource/${AGMARKNET_RESOURCE_ID}`;

// Public sample key from the data.gov.in docs — capped at 10 records/call.
// Get a free key at data.gov.in and set DATA_GOV_IN_API_KEY to lift the cap.
export const AGMARKNET_DEMO_API_KEY = "579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b";

/** State filter used for every Maharashtra market-price query. */
export const AGMARKNET_STATE = "Maharashtra";

/**
 * Agmarknet commodity display names for EVERY crop the app supports
 * (slug -> exact Agmarknet commodity string, verified against the national
 * feed). A crop missing here can never be resolved to a live record.
 */
export const AGMARKNET_CROP_NAMES: Record<string, string> = {
  onion: "Onion",
  tomato: "Tomato",
  potato: "Potato",
  cotton: "Cotton",
  soybean: "Soyabean", // Agmarknet's own spelling, not "Soybean"
  sugarcane: "Sugar cane", // reported by some MH APMCs; may be absent on a given day
  jowar: "Jowar(Sorghum)",
  tur: "Red gram/Arhar/Tur(whole)",
  banana: "Banana",
  orange: "Orange",
  pomegranate: "Pomegranate",
  turmeric: "Turmeric",
  grapes: "Grapes",
};

/**
 * Agmarknet market-name aliases per mandi id, as ordered candidate lists.
 * The feed's market naming is inconsistent across releases (Vashi appears as
 * "Vashi" or "New Mumbai"; Pune Gultekdi as "Pune" or "Pune (Gultekdi)"), so
 * a record is attributed to a mandi if its own `market` field matches ANY
 * candidate after normalization — the record's `state` + `market` fields are
 * the ground truth, never the URL filter.
 */
export const AGMARKNET_MANDI_NAMES: Record<string, string[]> = {
  vashi: ["Vashi", "New Mumbai", "Navi Mumbai"],
  lasalgaon: ["Lasalgaon(Niphad)", "Lasalgaon(Vinchur)", "Lasalgaon", "Lasalgoan"],
  "pimpalgaon-baswant": ["Pimpalgaon(Baswant)", "Pimpalgaon Baswant", "Pimpalgaon"],
  "pune-gultekdi": ["Pune (Gultekdi)", "Pune(Gultekdi)", "Pune"],
  "nagpur-kalamna": ["Nagpur(A) Kalamna", "Nagpur (Kalamna)", "Nagpur Kalamna", "Nagpur"],
  amravati: ["Amravati", "Amaravati"],
  jalgaon: ["Jalgaon", "Jalgaon(Bhusaval)"],
  solapur: ["Solapur", "Sholapur"],
  sangli: ["Sangli", "Sangli(Miraj)"],
  kolhapur: ["Kolhapur", "Kolhapur(Vasant Maharaja Mkt)"],
};

/** Which source a prices row can carry — live = Agmarknet, fpo = FPO manual. */
export type PriceSource = "live" | "fpo" | "seed";

/**
 * How old a stored live row may be before the read path attempts a fresh
 * Agmarknet fetch on the next request, and how long a fresh fetch result is
 * cached in the module before being retried.
 */
export const LIVE_REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6h
const LIVE_FETCH_TTL_MS = 5 * 60 * 1000; // 5m module-level memo

export class AgmarknetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgmarknetError";
  }
}

interface AgmarknetRecord {
  commodity?: string;
  market?: string;
  district?: string;
  state?: string;
  variety?: string;
  modal_price?: string | number;
  min_price?: string | number;
  max_price?: string | number;
  arrivals?: string | number;
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
  maxRecords?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Normalize a market/commodity name for alias comparison (case + punctuation-insensitive). */
function normalizeToken(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function mandiMarketAliases(mandiId: string): Set<string> {
  const aliases = new Set<string>();
  for (const raw of AGMARKNET_MANDI_NAMES[mandiId] ?? []) aliases.add(normalizeToken(raw));
  return aliases;
}

function mandiIdForMarket(market: unknown): string | null {
  const token = normalizeToken(market);
  if (!token) return null;
  for (const mandiId of ALL_MANDI_IDS) {
    if (mandiMarketAliases(mandiId).has(token)) return mandiId;
  }
  return null;
}

/**
 * Fetch EVERY matching record across pagination (the feed caps each page at
 * `limit`, so a full Maharashtra day needs multiple pages for some crops).
 */
export async function fetchAgmarknetRecords(
  options: FetchOptions = {}
): Promise<AgmarknetRecord[]> {
  const { commodity, market, state = AGMARKNET_STATE, limit = 500, timeoutMs = 8000, maxRetries = 2, maxRecords = 40_000 } = options;
  const apiKey = process.env.DATA_GOV_IN_API_KEY || AGMARKNET_DEMO_API_KEY;

  const all: AgmarknetRecord[] = [];
  let offset = 0;
  let lastError: unknown;

  while (offset < 40_000) {
    const params = new URLSearchParams({ "api-key": apiKey, format: "json", limit: String(limit), offset: String(offset) });
    if (commodity) params.set("filters[commodity]", commodity);
    if (market) params.set("filters[market]", market);
    if (state) params.set("filters[state]", state);

    const url = `${AGMARKNET_BASE_URL}?${params.toString()}`;

    let page: AgmarknetRecord[] | null = null;
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
        page = json.records ?? [];
        break;
      } catch (exc) {
        lastError = exc;
        if (attempt < maxRetries) await sleep(500 * (attempt + 1));
      }
    }
    if (page === null) {
      throw new AgmarknetError(`Agmarknet fetch failed at offset ${offset}: ${String(lastError)}`);
    }
    all.push(...page);
    if (page.length < limit) break;
    if (all.length >= maxRecords) break;
    offset += limit;
  }

  return all;
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

export interface ResolvedLiveRecord {
  cropId: string;
  mandiId: string;
  price: number;
  date: string;
  market: string;
  district: string;
  state: string;
  commodity: string;
  arrivals: number | null;
}

/**
 * Module-level memo of each commodity's Maharashtra feed snapshot (5 min TTL).
 * One feed call per commodity serves every mandi pair — a full on-demand
 * pass across 13 crops × 10 mandis costs at most 13 API calls, not 130.
 */
const commodityRecordsCache = new Map<string, { at: number; records: AgmarknetRecord[] }>();

async function fetchRecordsForCommodity(commodity: string): Promise<AgmarknetRecord[]> {
  const cached = commodityRecordsCache.get(commodity);
  if (cached && Date.now() - cached.at < LIVE_FETCH_TTL_MS) return cached.records;
  const records = await fetchAgmarknetRecords({ commodity });
  commodityRecordsCache.set(commodity, { at: Date.now(), records });
  return records;
}

/**
 * Resolve today's/latest-published Agmarknet record for a crop+mandi by
 * querying state+commodity and attributing only records whose OWN market
 * field matches this mandi's aliases. Returns the dominant quote (latest
 * arrival date, then heaviest arrival) — never a random record.
 */
export async function resolveLiveRecord(cropId: string, mandiId: string): Promise<ResolvedLiveRecord | null> {
  const commodity = AGMARKNET_CROP_NAMES[cropId];
  if (!commodity) return null;
  const aliases = mandiMarketAliases(mandiId);
  if (aliases.size === 0) return null;

  const records = await fetchRecordsForCommodity(commodity);
  const matching = records.filter((r) => aliases.has(normalizeToken(r.market)));

  if (matching.length === 0) return null;

  // Dominant quote: newest arrival date, then heaviest arrival, then highest modal price.
  const best = matching.sort((a, b) => {
    const ad = String(a.arrival_date ?? "");
    const bd = String(b.arrival_date ?? "");
    if (ad !== bd) return ad < bd ? 1 : -1;
    const aa = toNumber(a.arrivals) ?? 0;
    const ba = toNumber(b.arrivals) ?? 0;
    if (aa !== ba) return ba - aa;
    return (toNumber(b.modal_price) ?? 0) - (toNumber(a.modal_price) ?? 0);
  })[0];

  const price = toNumber(best.modal_price);
  const isoDate = typeof best.arrival_date === "string" ? parseAgmarknetDate(best.arrival_date) : null;
  if (price === null || !isoDate) return null;

  return {
    cropId,
    mandiId,
    price,
    date: isoDate,
    market: String(best.market ?? "").trim(),
    district: String(best.district ?? "").trim(),
    state: String(best.state ?? "").trim(),
    commodity: String(best.commodity ?? commodity).trim(),
    arrivals: toNumber(best.arrivals),
  };
}

/**
 * Pull live prices for every supported crop x mandi pair and upsert into the
 * `prices` table with source='live'. Uses ONE state+commodity query per crop
 * (not one per pair) and attributes returned records to mandis by their own
 * market field — 13 queries cover the whole matrix, so a daily cron stays
 * well inside the API's rate limits. Idempotent via the
 * (crop_id, mandi_id, date, source) unique index.
 */
export async function syncLivePrices(): Promise<{ fetched: number; matched: number; skipped: number }> {
  let fetched = 0;
  let matched = 0;
  let skipped = 0;

  for (const cropId of ALL_CROP_IDS) {
    const commodity = AGMARKNET_CROP_NAMES[cropId];
    if (!commodity) continue;

    let records: AgmarknetRecord[];
    try {
      records = await fetchRecordsForCommodity(commodity);
    } catch (exc) {
      if (exc instanceof AgmarknetError) continue; // unpublishable crop keeper: skip, keep others
      throw exc;
    }

    const rows: {
      crop_id: string;
      mandi_id: string;
      price: number;
      date: string;
      source: "live";
      arrival_volume_tons: number | null;
    }[] = [];

    for (const rec of records) {
      const mandiId = mandiIdForMarket(rec.market);
      if (!mandiId) {
        skipped += 1;
        continue;
      }
      fetched += 1;

      const modalPrice = toNumber(rec.modal_price);
      const isoDate = typeof rec.arrival_date === "string" ? parseAgmarknetDate(rec.arrival_date) : null;
      if (modalPrice === null || !isoDate) {
        skipped += 1;
        continue;
      }

      rows.push({
        crop_id: cropId,
        mandi_id: mandiId,
        price: modalPrice,
        date: isoDate,
        source: "live",
        arrival_volume_tons: toNumber(rec.arrivals),
      });
    }

    if (rows.length === 0) continue;

    const { error } = await supabaseAdmin
      .from("prices")
      .upsert(rows, { onConflict: "crop_id,mandi_id,date,source" });
    if (error) throw error;
    matched += rows.length;
  }

  return { fetched, matched, skipped };
}

/** Median of a numeric array (null when empty). */
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export interface ReferencePricesResult {
  commodities: number;
  rows: number;
}

/**
 * Backfill a clearly-labeled fallback ("NOT LIVE") price for EVERY supported
 * crop x mandi pair so no pair is ever blank. Source rows come from TODAY's
 * real data.gov.in release: the national median modal price of each commodity
 * is written into the `prices` table as `source='seed'` with
 * `arrival_volume_tons = NULL` — that combination is the unambiguous
 * "reference" marker (pilot seed rows always carry an arrival volume), which
 * the read path surfaces as `is_reference` and the UI renders as NOT LIVE.
 *
 * The (crop_id, mandi_id, date, source) unique index makes this idempotent
 * for a given publication day; the day changes, the median refreshes.
 */
export async function populateReferencePrices(): Promise<ReferencePricesResult> {
  let commodities = 0;
  let rows = 0;

  // One national query per commodity (state filter omitted). Capped so the
  // daily sync stays inside the runtime's timeout — a median over ~1000 real
  // market records is statistically indistinguishable from one over all of them.
  for (const cropId of ALL_CROP_IDS) {
    const commodity = AGMARKNET_CROP_NAMES[cropId];
    if (!commodity) continue;

    let records: AgmarknetRecord[];
    try {
      records = await fetchAgmarknetRecords({ commodity, state: "", maxRecords: 1200 });
    } catch (exc) {
      if (exc instanceof AgmarknetError) continue; // unpublishable crop keeper: skip, keep others
      throw exc;
    }

    const prices = records
      .map((r) => toNumber(r.modal_price))
      .filter((p): p is number => p !== null && p > 0);
    const reference = median(prices);
    if (reference === null) continue;

    let latestDate: string | null = null;
    for (const rec of records) {
      if (typeof rec.arrival_date !== "string") continue;
      const iso = parseAgmarknetDate(rec.arrival_date);
      if (iso && (!latestDate || iso > latestDate)) latestDate = iso;
    }
    const date = latestDate ?? new Date().toISOString().slice(0, 10);

    const pairRows = ALL_MANDI_IDS.map((mandiId) => ({
      crop_id: cropId,
      mandi_id: mandiId,
      price: Math.round(reference),
      date,
      source: "seed" as const,
      arrival_volume_tons: null, // NULL volume = reference row, never a live/seed quote
    }));

    const { error } = await supabaseAdmin
      .from("prices")
      .upsert(pairRows, { onConflict: "crop_id,mandi_id,date,source" });
    if (error) throw error;

    commodities += 1;
    rows += pairRows.length;
  }

  return { commodities, rows };
}

export interface CurrentPrice {
  price: number;
  date: string;
  source: PriceSource;
  fetched_at: string;
  /** True for reference rows: source='seed' with no arrival volume. False for live, seed, fpo and null. */
  is_reference?: boolean;
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
 * Latest price for a crop+mandi from the `prices` table only, preferring live
 * over FPO/seed regardless of recency, then the most recent date. Falls back
 * to the latest FPO manual entry when the table has nothing for this pair.
 * Does NOT hit Agmarknet — used by screens that need a cheap deterministic
 * read (heatmap, gov analytics) and as the base read inside the market-price
 * view which layers the live refresh on top.
 */
export async function getCurrentPrice(cropId: string, mandiId: string): Promise<CurrentPrice | null> {
  const { data, error } = await supabaseAdmin
    .from("prices")
    .select("price, date, source, fetched_at, arrival_volume_tons")
    .eq("crop_id", cropId)
    .eq("mandi_id", mandiId)
    .order("date", { ascending: false })
    .limit(200);

  if (error) throw error;

  const rows = (data ?? []).map((r) => {
    const row = r as {
      price: number | string;
      date: string;
      source: PriceSource;
      fetched_at: string;
      arrival_volume_tons: number | null;
    };
    // A stored row with source='seed' and no arrival volume is the reference
    // ("NOT LIVE") dataset; the UI must be able to tell it apart from pilot
    // seed quotes which always carry an arrival volume.
    const isReference = row.source === "seed" && (row.arrival_volume_tons === null || row.arrival_volume_tons === undefined);
    return { ...row, price: toNumber(row.price) ?? 0, is_reference: isReference };
  });
  if (rows.length === 0) return getLatestFpoPrice(cropId, mandiId);

  const live = rows.filter((r) => r.source === "live");
  const preferred = live.length > 0 ? live : rows;
  return preferred[0] ?? getLatestFpoPrice(cropId, mandiId);
}

async function getLatestLive(cropId: string, mandiId: string): Promise<CurrentPrice | null> {
  const { data, error } = await supabaseAdmin
    .from("prices")
    .select("price, date, source, fetched_at")
    .eq("crop_id", cropId)
    .eq("mandi_id", mandiId)
    .eq("source", "live")
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as { price: number | string; date: string; source: PriceSource; fetched_at: string };
  const price = toNumber(row.price);
  if (price === null) return null;
  return { ...row, price, is_reference: false };
}

export interface MarketPriceView {
  price: number | null;
  date: string | null; // Agmarknet arrival (publication) date for the quoted price
  source: PriceSource | null;
  fetched_at: string | null; // when this number was actually fetched/synced
  status: "live" | "fallback";
  is_reference: boolean; // fallback sourced from the reference dataset, never a live/seed quote
  commodity: string | null; // exact Agmarknet commodity name used for the query
  market: string | null;    // exact Agmarknet market name actually matched (null when unverified)
  district: string | null;
  state: string | null;
  last_live: { price: number; date: string; fetched_at: string } | null; // newest genuine live row, even when the quote is fallback
  unit: "quintal";
  /** Latest EPO (Electronic Price Observation) for this pair, if any —
   *  a human-observed price, NEVER labeled live (semantics in migration 009). */
  epo: CurrentPrice | null;
}

/**
 * Latest EPO observation for a crop+mandi. EPO rows are deliberately a
 * separate, honest source: farmer-visible as "observed, not live", and never
 * used as the quoted live price.
 */
async function getLatestEpoObservation(cropId: string, mandiId: string): Promise<CurrentPrice | null> {
  const { data, error } = await supabaseAdmin
    .from("epo_price_entries")
    .select("price_per_quintal, observed_at")
    .eq("crop_id", cropId)
    .eq("mandi_id", mandiId)
    .order("observed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as { price_per_quintal: number | string; observed_at: string };
  const price = toNumber(row.price_per_quintal);
  if (price === null) return null;
  return {
    price,
    date: row.observed_at.slice(0, 10),
    source: "seed",
    fetched_at: row.observed_at,
    is_reference: false,
  };
}

/**
 * The market-price read path used by GET /api/prices/:crop/:mandi.
 *
 *  1. Best stored value (live-first) from the `prices`/FPO tables.
 *  2. If that stored value is stale (older than 6h) or absent, query
 *     Agmarknet for the LATEST published record and verbatim upsert it.
 *  3. Return the result with a strict `status` flag and full provenance
 *     (commodity, matched market, arrival date, fetch time). Seed/FPO values
 *     are ALWAYS `status: "fallback"` — the UI can never present them as live.
 *
 * `price` is null only when there is neither a live nor a manual value for
 * the pair (caller maps that to a 404 "no current market data").
 */
export async function getMarketPriceView(cropId: string, mandiId: string): Promise<MarketPriceView> {
  const commodity = AGMARKNET_CROP_NAMES[cropId] ?? null;
  let best = await getCurrentPrice(cropId, mandiId);

  const shouldRefresh = !best || Date.now() - new Date(best.fetched_at).getTime() > LIVE_REFRESH_INTERVAL_MS;
  let matchedRecord = null as ResolvedLiveRecord | null;

  if (shouldRefresh) {
    try {
      matchedRecord = await resolveLiveRecord(cropId, mandiId);
    } catch {
      matchedRecord = null; // feed unreachable — fall back to stored value, honestly labeled
    }
    if (matchedRecord) {
      const { error } = await supabaseAdmin
        .from("prices")
        .upsert(
          {
            crop_id: cropId,
            mandi_id: mandiId,
            price: matchedRecord.price,
            date: matchedRecord.date,
            source: "live",
            arrival_volume_tons: matchedRecord.arrivals,
          },
          { onConflict: "crop_id,mandi_id,date,source" }
        );
      if (!error) {
        best = {
          price: matchedRecord.price,
          date: matchedRecord.date,
          source: "live",
          fetched_at: new Date().toISOString(),
        };
      }
    }
  }

  const lastLive = await getLatestLive(cropId, mandiId);
  const isLive = best?.source === "live";
  const isReference = best?.is_reference === true;
  const epo = await getLatestEpoObservation(cropId, mandiId);

  return {
    price: best?.price ?? null,
    date: best?.date ?? null,
    source: best?.source ?? null,
    fetched_at: best?.fetched_at ?? null,
    status: isLive ? "live" : "fallback",
    is_reference: isReference,
    commodity,
    market: matchedRecord?.market ?? null,
    district: matchedRecord?.district ?? null,
    state: matchedRecord?.state ?? (isLive ? AGMARKNET_STATE : null),
    last_live: lastLive ? { price: lastLive.price, date: lastLive.date, fetched_at: lastLive.fetched_at } : null,
    unit: "quintal",
    epo,
  };
}