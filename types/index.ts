// Shared types for KrishiBandhu. Every phase after this one imports from
// here instead of redefining these shapes locally.

export type UserRole = "farmer" | "trader" | "fpo" | "admin";

export interface Crop {
  id: string; // stable slug, e.g. 'onion' — matches crops.id in the DB
  name: string; // display name, e.g. 'Onion'
  nameMr?: string;
  nameHi?: string;
  /** Free-form category: 'crop' (the pilot's 13 field crops), 'dairy',
   *  'livestock', 'poultry', 'fishery'. Not an enum — adding a new category
   * is a data change (insert into crops), not a schema migration. */
  category?: string;
  /** Display unit for this crop: 'quintal' for field crops, 'liter' for milk,
   *  'head' for livestock, 'bird' for poultry, 'kg' for fish. */
  unit?: string;
}

export interface Mandi {
  id: string; // stable slug, e.g. 'lasalgaon'
  name: string;
  district: string;
  lat: number;
  lng: number;
  /** Market type: 'apmc' (official APMC), 'private_mandi', 'farmers_market',
   *  'wholesaler'. Seeded from Nominatim (lib/nominatim.ts) and user
   *  submissions (mandi_submissions). */
  marketType?: string;
  /** True when this mandi comes from an approved user submission rather than
   *  the seeded directory — rendered as "community-reported" in the UI. */
  isUserSubmitted?: boolean;
  /** True when this mandi is approved for cold storage / warehousing. */
  allowsColdStorage?: boolean;
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
  /**
   * How money actually moved for this sale. The research finding is that
   * forcing a digital payment rail breaks the farmer-trader informal-credit
   * loop, so the Parchi records a sale identically regardless of payment
   * mode — verification is agnostic to it only because the mode is hashed in.
   *   cash          — money changed hands at the mandi
   *   upi           — digital payment to the farmer's VPA
   *   bank_transfer — NEFT/RTGS/IMPS to the farmer's bank account
   *   credit        — the trader is also the farmer's lender; no money moved
   *                   today, this sale offsets an existing informal loan
   */
  payment_mode: "cash" | "upi" | "bank_transfer" | "credit";
  /** UPI transaction ID / cheque ref / NEFT ref, when applicable. */
  payment_reference: string | null;
  /** Free-text note for credit sales: what the debt is being offset against. */
  credit_note: string | null;
}

/** A manual EPO (Electronic Price Observation) entry. */
export interface EpoPriceEntry {
  id: string;
  observer_id: string;
  crop_id: string;
  mandi_id: string;
  price_per_quintal: number;
  arrival_volume_tons: number | null;
  observed_at: string;
  note: string | null;
  created_at: string;
}

/** A user-submitted mandi awaiting approval. */
export interface MandiSubmission {
  id: string;
  submitted_by: string | null;
  name: string;
  district: string;
  lat: number;
  lng: number;
  market_type: "apmc" | "private_mandi" | "farmers_market" | "wholesaler";
  contact_number: string | null;
  notes: string | null;
  status: "pending" | "approved" | "rejected";
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export type FarmerAlertType = "parchi_recorded" | "price_alert" | "sowing_alert" | "arrival" | "system";
export type AlertSeverity = "info" | "warning" | "danger";

export interface FarmerAlert {
  id: string;
  farmer_id: string;
  type: FarmerAlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  payload: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
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
  | { type: "queued_pending"; tempId: string; payload: Record<string, unknown>; attempt: number; timestamp: string }
  | { type: "epo_observation"; crop_id: string; mandi_id: string; price_per_quintal: number; observer: string; timestamp: string };
