// ─── KrishiBandhu Shared Type Definitions ───
// Every type is crop_id/mandi_id-driven. Nothing is hardcoded to a specific crop or mandi.

// ─── Crop ───
export interface Crop {
  id: string; // slug, e.g. 'onion', 'tomato', 'cotton'
  name: string; // display name, e.g. 'Onion', 'Tomato', 'Cotton'
  category: 'vegetable' | 'cereal' | 'cash-crop' | 'fruit' | 'spice';
  icon: string; // emoji for UI display
}

// ─── Mandi ───
export interface Mandi {
  id: string; // slug, e.g. 'vashi', 'lasalgaon', 'pune-gultekdi'
  name: string; // display name, e.g. 'Vashi', 'Lasalgaon', 'Pune Gultekdi'
  district: string;
  state: string; // default 'Maharashtra'
  latitude: number;
  longitude: number;
}

// ─── User Roles ───
export type UserRole = 'farmer' | 'trader' | 'fpo' | 'admin';

// ─── Sowing Signal ───
export type SowingSignal = 'green' | 'yellow' | 'red';

// ─── Build Status (for Phase/Feature stubs) ───
export type BuildStatus = 'live' | 'prototype' | 'comingSoon';

// ─── Language ───
export type Language = 'en' | 'mr' | 'hi';

// ─── Parchi Record (hash-chained digital receipt) ───
export interface ParchiRecord {
  id: string;
  farmer_id: string;
  trader_id: string;
  crop_id: string;
  mandi_id: string;
  gross_weight: number; // in kg
  deduction_percent: number; // 0-100
  net_weight: number; // gross_weight * (1 - deduction_percent/100)
  price_per_quintal: number;
  total_amount: number;
  photo_url: string | null;
  quality_grade: string;
  assayer_override_grade: string | null;
  timestamp: string; // ISO timestamptz
  previous_hash: string | null; // null only for genesis record
  current_hash: string; // SHA-256 hash, unique, not null
  is_genesis: boolean;
}

// ─── StatusBadge Props ───
export interface StatusBadgeProps {
  status: BuildStatus;
  label: string;
  onTap?: () => void;
}

// ─── Sowing Signal Entry ───
export interface SowingSignalEntry {
  crop_id: string;
  mandi_id: string;
  signal_status: SowingSignal;
  reasoning_text: string;
  updated_at: string;
  recalculated_at: string;
  sowing_window_start: string; // date
  sowing_window_end: string; // date
}

// ─── Dispute ───
export interface Dispute {
  id: string;
  parchi_id: string;
  raised_by: string; // user id
  reason: string;
  status: 'open' | 'escalated' | 'resolved';
  escalated_to_apmc: boolean;
  escalated_to_kisan_call_centre: boolean;
  escalation_timer_started_at: string | null;
  created_at: string;
}

// ─── FPO Price Entry ───
export interface FpoPriceEntry {
  id: string;
  fpo_id: string;
  crop_id: string;
  mandi_id: string;
  price_per_quintal: number;
  arrival_volume_tons: number;
  entered_at: string;
}

// ─── FPO Survey Response ───
export interface FpoSurveyResponse {
  id: string;
  fpo_id: string;
  village: string;
  crop_id: string;
  area_hectares: number;
  expected_harvest_month: string; // date
  submitted_at: string;
}

// ─── Storage Directory Entry ───
export interface StorageDirectoryEntry {
  id: string;
  district: string;
  facility_name: string;
  facility_type: 'cold_storage' | 'fpo_warehouse';
  approx_capacity_tons: number;
  contact_number: string;
}

// ─── Backhaul Truck ───
export interface BackhaulTruck {
  id: string;
  truck_number: string;
  from_mandi_id: string;
  to_village: string;
  departure_time: string;
  available_capacity_kg: number;
  contact_number: string;
}
