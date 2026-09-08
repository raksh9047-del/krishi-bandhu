// Shared types for KrishiBandhu. Every phase after this one imports from
// here instead of redefining these shapes locally.

export type UserRole = "farmer" | "trader" | "fpo" | "admin";

export interface Crop {
  id: string; // stable slug, e.g. 'onion' — matches crops.id in the DB
  name: string; // display name, e.g. 'Onion'
  nameMr?: string;
  nameHi?: string;
}

export interface Mandi {
  id: string; // stable slug, e.g. 'lasalgaon'
  name: string;
  district: string;
  lat: number;
  lng: number;
}

export type SowingSignalStatus = "green" | "yellow" | "red";

export interface SowingSignal {
  crop_id: string;
  mandi_id: string;
  signal_status: SowingSignalStatus;
  reasoning_text: string;
  updated_at: string;
  recalculated_at: string;
  sowing_window_start: string;
  sowing_window_end: string;
}

/**
 * BuildStatus drives the shared <StatusBadge /> component. Every stubbed
 * feature anywhere in the product (AgriStack verification, WhatsApp routing,
 * UPI Autopay, the statewide coverage overlay) uses 'comingSoon' — never a
 * fake 'live' state.
 */
export type BuildStatus = "live" | "prototype" | "comingSoon";

export interface ParchiRecord {
  id: string;
  farmer_id: string;
  trader_id: string;
  crop_id: string;
  mandi_id: string;
  gross_weight: number;
  deduction_percent: number;
  net_weight: number;
  price_per_quintal: number;
  total_amount: number;
  photo_url: string | null;
  quality_grade: string | null;
  assayer_override_grade: string | null;
  timestamp: string;
  previous_hash: string | null;
  current_hash: string;
  is_genesis: boolean;
}

export interface Dispute {
  id: string;
  parchi_id: string;
  raised_by: string;
  reason: string;
  status: "open" | "escalated" | "resolved";
  escalated_to_apmc: boolean;
  escalated_to_kisan_call_centre: boolean;
  escalation_timer_started_at: string | null;
  resolved_at?: string | null;
}

export interface StorageFacility {
  id: string;
  district: string;
  facility_name: string;
  facility_type: "cold_storage" | "fpo_warehouse";
  approx_capacity_tons: number;
  contact_number: string;
}

export interface BackhaulTruck {
  id: string;
  truck_number: string;
  from_mandi_id: string;
  to_village: string;
  departure_time: string;
  available_capacity_kg: number;
  contact_number: string;
}

export type Language = "en" | "mr" | "hi";

/**
 * Chat-feed bubble union shared by the farmer app's interaction feed (Phase 6)
 * and, structurally, the trader ledger view (Phase 7). Keeping this as one
 * tagged union means the offline queue and the renderer share a single shape.
 */
export type FeedBubble =
  | { type: "price_update"; crop_id: string; mandi_id: string; price_per_quintal: number; source: string; timestamp: string }
  | { type: "signal_change"; crop_id: string; mandi_id: string; signal_status: SowingSignalStatus; timestamp: string }
  | { type: "parchi_confirmation"; parchi: ParchiRecord; timestamp: string }
  | { type: "queued_pending"; tempId: string; payload: Record<string, unknown>; attempt: number; timestamp: string };
