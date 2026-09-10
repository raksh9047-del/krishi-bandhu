/**
 * Haversine distance between two lat/lng points in kilometres.
 * Used by the Multi-Mandi Net Realization calculator to estimate
 * transport cost from the farmer's village to each mandi.
 */

const EARTH_RADIUS_KM = 6371;

export function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Estimate transport cost (₹/quintal) from distance.
 * Rough heuristic: ₹8/km for truck loads of 5-10 quintals,
 * amortised per quintal. Real costs vary by road quality, fuel
 * price, and load size — this is a starting point the farmer can override.
 */
export function estimateTransportPerQ(distanceKm: number): number {
  const COST_PER_KM = 8; // ₹8 per km for a small truck
  const AVG_LOAD_Q = 8;  // average 8 quintals per trip
  return Math.round((distanceKm * COST_PER_KM) / AVG_LOAD_Q);
}
