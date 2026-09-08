// ─── KrishiBandhu Constants ───
// 13 Crops and 10 Mandis — all code references these via stable slug IDs.
// Expanding beyond the 3×3 pilot is a data change (adding rows here), not a rebuild.

import type { Crop, Mandi } from '@/types';

// ─── Pilot Subset (3×3) ───
// Used for build verification. The full list below is the production surface.
export const PILOT_CROP_IDS = ['onion', 'tomato', 'cotton'] as const;
export const PILOT_MANDI_IDS = ['vashi', 'lasalgaon', 'pune-gultekdi'] as const;

// ─── 13 Crops ───
export const CROPS: Crop[] = [
  { id: 'onion', name: 'Onion', category: 'vegetable', icon: '🧅' },
  { id: 'tomato', name: 'Tomato', category: 'vegetable', icon: '🍅' },
  { id: 'potato', name: 'Potato', category: 'vegetable', icon: '🥔' },
  { id: 'cotton', name: 'Cotton', category: 'cash-crop', icon: '🌾' },
  { id: 'soybean', name: 'Soybean', category: 'cash-crop', icon: '🫘' },
  { id: 'sugarcane', name: 'Sugarcane', category: 'cash-crop', icon: '🍬' },
  { id: 'jowar', name: 'Jowar', category: 'cereal', icon: '🌿' },
  { id: 'tur', name: 'Tur', category: 'cereal', icon: '🌱' },
  { id: 'banana', name: 'Banana', category: 'fruit', icon: '🍌' },
  { id: 'orange', name: 'Orange', category: 'fruit', icon: '🍊' },
  { id: 'pomegranate', name: 'Pomegranate', category: 'fruit', icon: '🔴' },
  { id: 'turmeric', name: 'Turmeric', category: 'spice', icon: '🟡' },
  { id: 'grapes', name: 'Grapes', category: 'fruit', icon: '🍇' },
];

// ─── 10 Mandis ───
export const MANDIS: Mandi[] = [
  {
    id: 'vashi',
    name: 'Vashi',
    district: 'Navi Mumbai',
    state: 'Maharashtra',
    latitude: 19.07,
    longitude: 73.0,
  },
  {
    id: 'lasalgaon',
    name: 'Lasalgaon',
    district: 'Nashik',
    state: 'Maharashtra',
    latitude: 20.15,
    longitude: 74.24,
  },
  {
    id: 'pimpalgaon-baswant',
    name: 'Pimpalgaon Baswant',
    district: 'Nashik',
    state: 'Maharashtra',
    latitude: 20.18,
    longitude: 74.13,
  },
  {
    id: 'pune-gultekdi',
    name: 'Pune Gultekdi',
    district: 'Pune',
    state: 'Maharashtra',
    latitude: 18.48,
    longitude: 73.87,
  },
  {
    id: 'nagpur-kalamna',
    name: 'Nagpur Kalamna',
    district: 'Nagpur',
    state: 'Maharashtra',
    latitude: 21.15,
    longitude: 79.08,
  },
  {
    id: 'amravati',
    name: 'Amravati',
    district: 'Amravati',
    state: 'Maharashtra',
    latitude: 20.93,
    longitude: 77.75,
  },
  {
    id: 'jalgaon',
    name: 'Jalgaon',
    district: 'Jalgaon',
    state: 'Maharashtra',
    latitude: 21.01,
    longitude: 75.56,
  },
  {
    id: 'solapur',
    name: 'Solapur',
    district: 'Solapur',
    state: 'Maharashtra',
    latitude: 17.66,
    longitude: 75.91,
  },
  {
    id: 'sangli',
    name: 'Sangli',
    district: 'Sangli',
    state: 'Maharashtra',
    latitude: 16.85,
    longitude: 74.56,
  },
  {
    id: 'kolhapur',
    name: 'Kolhapur',
    district: 'Kolhapur',
    state: 'Maharashtra',
    latitude: 16.7,
    longitude: 74.22,
  },
];

// ─── Sowing Signal Thresholds (per crop category) ───
// These are the tunable thresholds for the Sowing Signal calculation.
// RED: when blended subsidy+survey data exceeds redAbove × 3-year average
// YELLOW: when it exceeds yellowAbove × 3-year average
// GREEN: otherwise
export interface SignalThreshold {
  redAbove: number; // multiplier above 3-year avg to trigger RED
  yellowAbove: number; // multiplier above 3-year avg to trigger YELLOW
}

// Keyed by crop_id — each crop category may have different glut profiles.
// Cotton gluts behave differently from onion gluts.
export const SIGNAL_THRESHOLDS: Record<string, SignalThreshold> = {
  onion: { redAbove: 1.3, yellowAbove: 1.0 },
  tomato: { redAbove: 1.3, yellowAbove: 1.0 },
  potato: { redAbove: 1.3, yellowAbove: 1.0 },
  cotton: { redAbove: 1.5, yellowAbove: 1.1 },
  soybean: { redAbove: 1.4, yellowAbove: 1.05 },
  sugarcane: { redAbove: 1.4, yellowAbove: 1.05 },
  jowar: { redAbove: 1.35, yellowAbove: 1.0 },
  tur: { redAbove: 1.35, yellowAbove: 1.0 },
  banana: { redAbove: 1.3, yellowAbove: 1.0 },
  orange: { redAbove: 1.3, yellowAbove: 1.0 },
  pomegranate: { redAbove: 1.3, yellowAbove: 1.0 },
  turmeric: { redAbove: 1.4, yellowAbove: 1.05 },
  grapes: { redAbove: 1.3, yellowAbove: 1.0 },
};

// ─── Default Crop & Mandi (first pilot pair) ───
export const DEFAULT_CROP_ID = 'onion';
export const DEFAULT_MANDI_ID = 'lasalgaon';

// ─── Sowing Signal Blend Weights ───
// Subsidy data is systematic but misses private seed buyers.
// Survey data is direct but small-sample.
// Neither alone is ground truth — blend them.
export const SIGNAL_BLEND_WEIGHTS = {
  subsidy: 0.6, // 60% weight to subsidy disbursement data
  survey: 0.4, // 40% weight to FPO survey responses
} as const;
