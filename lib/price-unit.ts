/** ₹/quintal is the storage unit everywhere in this app; farmers read ₹/kg. */

/** Convert stored ₹/quintal to ₹/kg. */
export function pricePerKg(perQuintal: number): number {
  return perQuintal / 100;
}

/** Compact ₹/kg string: 2000/q -> "20", 2850/q -> "28.5", 12/q -> "0.12". */
export function formatPerKg(perQuintal: number): string {
  const kg = pricePerKg(perQuintal);
  if (Number.isInteger(kg)) return String(kg);
  return kg.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

/**
 * Display-unit label for a crop's stored price. Prices are stored ₹/quintal
 * for every crop; the UI reads per display unit (₹/kg for field crops and
 * fish, ₹/liter for milk, ₹/head for livestock, ₹/bird for poultry). A
 * 'quintal' unit still reads as "kg" for the farmer (migration 010 Part C).
 */
export function priceUnitLabel(cropUnit?: string): string {
  if (!cropUnit || cropUnit === "quintal") return "kg";
  return cropUnit;
}