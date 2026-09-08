import type { Crop, Mandi } from "@/types";

// Every screen, seed script, and API route reads crop/mandi identity from
// these two arrays via `id` — never a hardcoded display name. The 3x3 pilot
// subset (Onion/Tomato/Cotton x Vashi/Lasalgaon/Pune Gultekdi) is what gets
// seeded and tested against during the build; the remaining rows exist so
// expanding coverage later is a data change, not a rebuild.

export const CROPS: Crop[] = [
  { id: "onion", name: "Onion", nameMr: "कांदा", nameHi: "प्याज़" },
  { id: "tomato", name: "Tomato", nameMr: "टोमॅटो", nameHi: "टमाटर" },
  { id: "potato", name: "Potato", nameMr: "बटाटा", nameHi: "आलू" },
  { id: "cotton", name: "Cotton", nameMr: "कापूस", nameHi: "कपास" },
  { id: "soybean", name: "Soybean", nameMr: "सोयाबीन", nameHi: "सोयाबीन" },
  { id: "sugarcane", name: "Sugarcane", nameMr: "ऊस", nameHi: "गन्ना" },
  { id: "jowar", name: "Jowar", nameMr: "ज्वारी", nameHi: "ज्वार" },
  { id: "tur", name: "Tur", nameMr: "तूर", nameHi: "तूर" },
  { id: "banana", name: "Banana", nameMr: "केळी", nameHi: "केला" },
  { id: "orange", name: "Orange", nameMr: "संत्री", nameHi: "संतरा" },
  { id: "pomegranate", name: "Pomegranate", nameMr: "डाळिंब", nameHi: "अनार" },
  { id: "turmeric", name: "Turmeric", nameMr: "हळद", nameHi: "हल्दी" },
  { id: "grapes", name: "Grapes", nameMr: "द्राक्षे", nameHi: "अंगूर" },
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
