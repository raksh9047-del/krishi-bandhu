import type { Crop, Mandi } from "@/types";

// Every screen, seed script, and API route reads crop/mandi identity from
// these two arrays via `id` — never a hardcoded display name. The 3x3 pilot
// subset (Onion/Tomato/Cotton x Vashi/Lasalgaon/Pune Gultekdi) is what gets
// seeded and tested against during the build; the remaining rows exist so
// expanding coverage later is a data change, not a rebuild.

export const CROPS: Crop[] = [
  { id: "onion", name: "Onion", nameMr: "कांदा", nameHi: "प्याज़", category: "crop", unit: "quintal" },
  { id: "tomato", name: "Tomato", nameMr: "टोमॅटो", nameHi: "टमाटर", category: "crop", unit: "quintal" },
  { id: "potato", name: "Potato", nameMr: "बटाटा", nameHi: "आलू", category: "crop", unit: "quintal" },
  { id: "cotton", name: "Cotton", nameMr: "कापूस", nameHi: "कपास", category: "crop", unit: "quintal" },
  { id: "soybean", name: "Soybean", nameMr: "सोयाबीन", nameHi: "सोयाबीन", category: "crop", unit: "quintal" },
  { id: "sugarcane", name: "Sugarcane", nameMr: "ऊस", nameHi: "गन्ना", category: "crop", unit: "quintal" },
  { id: "jowar", name: "Jowar", nameMr: "ज्वारी", nameHi: "ज्वार", category: "crop", unit: "quintal" },
  { id: "tur", name: "Tur", nameMr: "तूर", nameHi: "तूर", category: "crop", unit: "quintal" },
  { id: "banana", name: "Banana", nameMr: "केळी", nameHi: "केला", category: "crop", unit: "quintal" },
  { id: "orange", name: "Orange", nameMr: "संत्री", nameHi: "संतरा", category: "crop", unit: "quintal" },
  { id: "pomegranate", name: "Pomegranate", nameMr: "डाळिंब", nameHi: "अनार", category: "crop", unit: "quintal" },
  { id: "turmeric", name: "Turmeric", nameMr: "हळद", nameHi: "हल्दी", category: "crop", unit: "quintal" },
  { id: "grapes", name: "Grapes", nameMr: "द्राक्षे", nameHi: "अंगूर", category: "crop", unit: "quintal" },
  // ── Livestock / dairy / poultry / fishery (Phase 10) ─────────────────────
  // The pilot is crop-only; these rows exist so expanding to large animals and
  // dairy is a data change, not a rebuild. The UI surfaces them only when the
  // user selects one, and the price unit follows `unit` (liter/head/bird/kg).
  { id: "milk", name: "Milk", nameMr: "दूध", nameHi: "दूध", category: "dairy", unit: "liter" },
  { id: "buffalo_milk", name: "Buffalo Milk", nameMr: "बैलाचे दूध", nameHi: "भैंस का दूध", category: "dairy", unit: "liter" },
  { id: "cow", name: "Cattle (Cows)", nameMr: "गाय", nameHi: "गाय", category: "livestock", unit: "head" },
  { id: "buffalo", name: "Buffalo", nameMr: "बैल", nameHi: "भैंस", category: "livestock", unit: "head" },
  { id: "goat", name: "Goat", nameMr: "बकडी", nameHi: "बकरी", category: "livestock", unit: "head" },
  { id: "sheep", name: "Sheep", nameMr: "भेंड", nameHi: "भेड़", category: "livestock", unit: "head" },
  { id: "poultry", name: "Poultry (Broiler)", nameMr: "बाग", nameHi: "मुर्गी", category: "poultry", unit: "bird" },
  { id: "fish", name: "Fish", nameMr: "मासे", nameHi: "मछली", category: "fishery", unit: "kg" },
];

export const MANDIS: Mandi[] = [
  { id: "vashi", name: "Vashi", district: "Thane", lat: 19.07, lng: 73.0 },
  { id: "lasalgaon", name: "Lasalgaon", district: "Nashik", lat: 20.15, lng: 74.24 },
  { id: "pimpalgaon-baswant", name: "Pimpalgaon Baswant", district: "Nashik", lat: 20.17, lng: 73.98 },
  { id: "pune-gultekdi", name: "Pune Gultekdi", district: "Pune", lat: 18.48, lng: 73.87 },
  { id: "nagpur-kalamna", name: "Nagpur Kalamna", district: "Nagpur", lat: 21.17, lng: 79.05 },
  { id: "amravati", name: "Amravati", district: "Amravati", lat: 20.93, lng: 77.75 },
  { id: "jalgaon", name: "Jalgaon", district: "Jalgaon", lat: 21.0, lng: 75.57 },
  { id: "solapur", name: "Solapur", district: "Solapur", lat: 17.66, lng: 75.91 },
  { id: "sangli", name: "Sangli", district: "Sangli", lat: 16.85, lng: 74.57 },
  { id: "kolhapur", name: "Kolhapur", district: "Kolhapur", lat: 16.7, lng: 74.24 },
];

/** The 3x3 pilot subset used for every build-phase seed and manual test. */
export const PILOT_CROP_IDS = ["onion", "tomato", "cotton"];
export const PILOT_MANDI_IDS = ["vashi", "lasalgaon", "pune-gultekdi"];

/** Every supported crop/mandi — the live price sync covers the full list, not just the pilot subset. */
export const ALL_CROP_IDS: string[] = CROPS.map((c) => c.id);
export const ALL_MANDI_IDS: string[] = MANDIS.map((m) => m.id);

export function getCropById(id: string): Crop | undefined {
  return CROPS.find((c) => c.id === id);
}

export function getMandiById(id: string): Mandi | undefined {
  return MANDIS.find((m) => m.id === id);
}

/**
 * Per-crop-category Sowing Signal thresholds (Phase 4). Cotton and onion
 * gluts don't behave identically, so this is keyed per crop rather than one
 * global number. Values are a documented starting point, tunable later.
 */
export const SOWING_SIGNAL_THRESHOLDS: Record<string, { redAbove: number; yellowAbove: number }> = {
  onion: { redAbove: 1.3, yellowAbove: 1.0 },
  tomato: { redAbove: 1.35, yellowAbove: 1.05 },
  potato: { redAbove: 1.3, yellowAbove: 1.0 },
  cotton: { redAbove: 1.5, yellowAbove: 1.15 },
  soybean: { redAbove: 1.4, yellowAbove: 1.1 },
  sugarcane: { redAbove: 1.45, yellowAbove: 1.1 },
  jowar: { redAbove: 1.3, yellowAbove: 1.0 },
  tur: { redAbove: 1.35, yellowAbove: 1.05 },
  banana: { redAbove: 1.3, yellowAbove: 1.0 },
  orange: { redAbove: 1.3, yellowAbove: 1.0 },
  pomegranate: { redAbove: 1.3, yellowAbove: 1.0 },
  turmeric: { redAbove: 1.35, yellowAbove: 1.05 },
  grapes: { redAbove: 1.3, yellowAbove: 1.0 },
};

/** Blend weight for Sowing Signal calculation (Phase 4): tunable, not derived. */
export const SOWING_SIGNAL_SUBSIDY_WEIGHT = 0.6;
export const SOWING_SIGNAL_SURVEY_WEIGHT = 0.4;
