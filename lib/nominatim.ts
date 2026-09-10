/**
 * KrishiBandhu — Nominatim (OpenStreetMap) mandi candidate search (server-only).
 *
 * Mandi search is one input to the mandi directory (migration 010): it returns
 * real APMCs, private mandis and wholesale + farmers' markets, but coverage is
 * inconsistent — so the directory is Places-seeded AND user-appendable via
 * `mandi_submissions`. A submitted mandi is NEVER treated as live data until
 * an admin approves it, so crowd-sourced rows can't be presented as verified.
 *
 * Nominatim needs no API key. Results are queried against India
 * (`countrycodes=in`). Per Nominatim's usage policy the request identifies
 * itself with a descriptive User-Agent; callers treat an empty result list as
 * "no data" and fall back to the user's typed values.
 */

export interface PlacesMandiCandidate {
  name: string;
  district: string;
  lat: number;
  lng: number;
  market_type: "apmc" | "private_mandi" | "farmers_market" | "wholesaler";
  contact_number: string | null;
  place_id: string;
}

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

/** Infer a market type from Nominatim's result `type` + display name. */
function inferMarketType(name: string, type: string | undefined): PlacesMandiCandidate["market_type"] {
  const s = `${name} ${type ?? ""}`.toLowerCase();
  if (s.includes("apmc") || s.includes("krishi") || s.includes("mandi")) return "apmc";
  if (type === "marketplace" || type === "market" || s.includes("market")) return "private_mandi";
  return "farmers_market";
}

/** Dot not offer road segments as mandi candidates. */
function isRoadLike(name: string, type: string | undefined): boolean {
  if (type === "service" || type === "residential" || type === "unclassified" || type === "road") return true;
  return /\b(road|link road|lane|nagar|society|complex)$/i.test(name.trim());
}

interface RawResult {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  type?: string;
  name?: string;
  address?: {
    county?: string;
    state_district?: string;
    district?: string;
    municipality?: string;
    city?: string;
    town?: string;
    village?: string;
    state?: string;
  };
}

/** Compact in-memory cache (5 min TTL) so the review UI doesn't re-hit Nominatim per keystroke. */
const candidateCache = new Map<string, { at: number; candidates: PlacesMandiCandidate[] }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Search OpenStreetMap for mandi/market candidates matching `query`.
 *
 * Returns [] when the geocoder errored or was rate-limited — callers degrade to
 * typed coordinates. The district is parsed from the returned address
 * best-effort; an empty string means "user should confirm".
 */
export async function searchMandiCandidates(query: string): Promise<PlacesMandiCandidate[]> {
  const normalized = query.trim();
  if (normalized.length < 3) return [];

  const cached = candidateCache.get(normalized);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.candidates;

  // Maharashtra is KrishiBandhu's operating region; anchoring the query there
  // dramatically improves Nominatim recall for short market names ("vashi" ->
  // APMC Vashi cluster) and surfaces the district in the address.
  const anchored = /(maharashtra|india)$/i.test(normalized) ? normalized : `${normalized}, Maharashtra, India`;

  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("q", anchored);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "5");
  url.searchParams.set("countrycodes", "in");
  url.searchParams.set("accept-language", "en");

  let results: RawResult[];
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      cache: "no-store",
      headers: {
        "User-Agent": "KrishiBandhu/1.0 (farmer market price Android app)",
        Accept: "application/json",
      },
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    results = (await res.json()) as RawResult[];
  } catch {
    return [];
  }
  if (!Array.isArray(results)) return [];

  const candidates: PlacesMandiCandidate[] = [];
  for (const r of results) {
    const lat = parseFloat(r.lat);
    const lng = parseFloat(r.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (isRoadLike(r.name ?? "", r.type)) continue;

    const address = r.address ?? {};
    const district =
      address.county ?? address.state_district ?? address.district ?? address.municipality ?? address.town ?? address.city ?? address.village ?? "";

    candidates.push({
      name: r.name ?? normalized,
      district: String(district),
      lat,
      lng,
      market_type: inferMarketType(r.name ?? "", r.type),
      contact_number: null,
      place_id: String(r.place_id ?? ""),
    });
    if (candidates.length >= 5) break;
  }

  candidateCache.set(normalized, { at: Date.now(), candidates });
  return candidates;
}