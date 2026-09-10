import type { StorageFacility } from "@/types";

/**
 * Reference storage directory, served when `storage_directory` has no rows
 * yet (the pilot DB is currently unseeded for this table). Same pattern as the
 * market-price reference dataset: honest, clearly labeled `seed` data so the
 * farmer screens have something to show before out-of-band SQL seeds land.
 * Once real rows exist in `storage_directory`, /api/storage/list serves those
 * instead and this list is ignored.
 */
export const STORAGE_REFERENCE: StorageFacility[] = [
  {
    id: "00000000-0000-4000-8000-000000000c01",
    district: "Thane",
    facility_name: "Vashi Agro Cold Storage",
    facility_type: "cold_storage",
    approx_capacity_tons: 800,
    contact_number: "+91-98200-11111",
  },
  {
    id: "00000000-0000-4000-8000-000000000c02",
    district: "Thane",
    facility_name: "APMC Vashi FPO Warehouse",
    facility_type: "fpo_warehouse",
    approx_capacity_tons: 500,
    contact_number: "+91-98200-22222",
  },
  {
    id: "00000000-0000-4000-8000-000000000c03",
    district: "Nashik",
    facility_name: "Lasalgaon Onion Cold Storage",
    facility_type: "cold_storage",
    approx_capacity_tons: 1200,
    contact_number: "+91-98230-33333",
  },
  {
    id: "00000000-0000-4000-8000-000000000c04",
    district: "Nashik",
    facility_name: "Niphad FPO Warehouse",
    facility_type: "fpo_warehouse",
    approx_capacity_tons: 350,
    contact_number: "+91-98230-44444",
  },
  {
    id: "00000000-0000-4000-8000-000000000c05",
    district: "Pune",
    facility_name: "Gultekdi Cold Storage",
    facility_type: "cold_storage",
    approx_capacity_tons: 700,
    contact_number: "+91-98220-55555",
  },
  {
    id: "00000000-0000-4000-8000-000000000c06",
    district: "Pune",
    facility_name: "Moshi FPO Warehouse",
    facility_type: "fpo_warehouse",
    approx_capacity_tons: 600,
    contact_number: "+91-98220-66666",
  },
  {
    id: "00000000-0000-4000-8000-000000000c07",
    district: "Nagpur",
    facility_name: "Nagpur Orange Cold Storage",
    facility_type: "cold_storage",
    approx_capacity_tons: 900,
    contact_number: "+91-98250-77777",
  },
  {
    id: "00000000-0000-4000-8000-000000000c08",
    district: "Wardha",
    facility_name: "Wardha Cotton FPO Warehouse",
    facility_type: "fpo_warehouse",
    approx_capacity_tons: 450,
    contact_number: "+91-98230-88888",
  },
];