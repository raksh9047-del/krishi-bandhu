#!/usr/bin/env node
/**
 * KrishiBandhu — Full coverage seed: subsidy history + sowing signals for
 * ALL 13 crops × 10 mandis (not just the pilot 3×3).
 *
 * Coverage:
 *   - 42 months of subsidy disbursement history per crop/district/month
 *     (the same data shape as seed-pilot.mjs, extended to all districts),
 *     deterministic and reproducible.
 *   - sowing_signals rows with current-season windows and green/yellow/red
 *     statuses matching each crop's thresholds (SOWING_SIGNAL_THRESHOLDS).
 *
 * Run AFTER seed-pilot.mjs (it creates the demo FPO user). Subsidy rows
 * for pilot crops are SKIPPED if already present (guarded by a DB read),
 * so this is safe to run repeatedly.
 *
 * USAGE
 *   node scripts/seed-full-coverage.mjs --apply
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const APPLY = process.argv.includes("--apply");
if (!APPLY) {
  console.error("Usage: node scripts/seed-full-coverage.mjs --apply");
  process.exit(1);
}

// ── Constants (must match constants.ts) ──────────────────────────────
const SUBSIDY_WEIGHT = 0.6;
const SURVEY_WEIGHT = 0.4;

const ALL_CROPS = [
  { id: "onion", name: "Onion", ratio: 1.75, baseSubsidy: 2_400_000 },
  { id: "tomato", name: "Tomato", ratio: 1.4, baseSubsidy: 1_800_000 },
  { id: "potato", name: "Potato", ratio: 1.0, baseSubsidy: 1_600_000 },
  { id: "cotton", name: "Cotton", ratio: 1.0, baseSubsidy: 3_200_000 },
  { id: "soybean", name: "Soybean", ratio: 1.0, baseSubsidy: 1_500_000 },
  { id: "sugarcane", name: "Sugarcane", ratio: 1.0, baseSubsidy: 2_000_000 },
  { id: "jowar", name: "Jowar", ratio: 1.0, baseSubsidy: 1_400_000 },
  { id: "tur", name: "Tur", ratio: 1.0, baseSubsidy: 1_300_000 },
  { id: "banana", name: "Banana", ratio: 1.0, baseSubsidy: 1_700_000 },
  { id: "orange", name: "Orange", ratio: 1.0, baseSubsidy: 1_600_000 },
  { id: "pomegranate", name: "Pomegranate", ratio: 1.0, baseSubsidy: 1_900_000 },
  { id: "turmeric", name: "Turmeric", ratio: 1.0, baseSubsidy: 1_200_000 },
  { id: "grapes", name: "Grapes", ratio: 1.0, baseSubsidy: 1_800_000 },
];

const THRESHOLDS = {
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

const ALL_MANDIS = [
  { id: "vashi", district: "Thane" },
  { id: "lasalgaon", district: "Nashik" },
  { id: "pimpalgaon-baswant", district: "Nashik" },
  { id: "pune-gultekdi", district: "Pune" },
  { id: "nagpur-kalamna", district: "Nagpur" },
  { id: "amravati", district: "Amravati" },
  { id: "jalgaon", district: "Jalgaon" },
  { id: "solapur", district: "Solapur" },
  { id: "sangli", district: "Sangli" },
  { id: "kolhapur", district: "Kolhapur" },
];

const DISTRICTS = [...new Set(ALL_MANDIS.map((m) => m.district))];

// ── RNG + dates (same as seed-pilot) ─────────────────────────────────
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(2026);
function between(min, max) { return min + rng() * (max - min); }

const now = new Date();
const todayIso = now.toISOString().slice(0, 10);

function monthKey(d) { return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`; }
function addMonths(d, delta) { return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + delta, 1)); }
function addDays(d, delta) { const c = new Date(d); c.setUTCDate(c.getUTCDate() + delta); return c; }

const CURRENT_MONTH = monthKey(now);
const PREV_MONTH = monthKey(addMonths(now, -1));

// ── Load env ─────────────────────────────────────────────────────────
async function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const path = resolve(file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const m = /^\s*(NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY)\s*=\s*(.*)\s*$/.exec(line);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

const { createClient } = await import("@supabase/supabase-js");
await loadEnv();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing env vars — aborting.");
  process.exit(1);
}
const admin = createClient(url, key, { auth: { persistSession: false } });

// ── 1. Subsidy rows (skip months that already exist for any crop) ────
// Read existing crop+district+month combos to avoid duplicates on re-run.
const { data: existingSubsidy } = await admin
  .from("subsidy_disbursements")
  .select("crop_id, district, month");
const existingSet = new Set(
  (existingSubsidy ?? []).map((r) => `${r.crop_id}|${r.district}|${r.month}`)
);

const subsidyRows = [];
for (const crop of ALL_CROPS) {
  for (const district of DISTRICTS) {
    for (let offset = 42; offset >= 0; offset -= 1) {
      const month = addMonths(now, -offset);
      const key_ = monthKey(month);
      if (existingSet.has(`${crop.id}|${district}|${key_}`)) continue;
      let amount = crop.baseSubsidy * (0.92 + rng() * 0.16);
      if (key_ === PREV_MONTH) amount = crop.baseSubsidy * 1.4;
      subsidyRows.push({ crop_id: crop.id, district, month: key_, amount: Math.round(amount) });
    }
  }
}

// ── 2. Sowing signals ───────────────────────────────────────────────
const signalRows = [];
for (const crop of ALL_CROPS) {
  const t = THRESHOLDS[crop.id];
  const blended = SUBSIDY_WEIGHT * crop.ratio + SURVEY_WEIGHT * 1;
  const signal = blended > t.redAbove ? "red" : blended > t.yellowAbove ? "yellow" : "green";
  const windowEnd =
    crop.id === "onion" ? addDays(now, 75).toISOString().slice(0, 10)
    : crop.id === "tomato" ? addDays(now, 365).toISOString().slice(0, 10)
    : addDays(now, 120).toISOString().slice(0, 10);

  for (const mandi of ALL_MANDIS) {
    signalRows.push({
      crop_id: crop.id,
      mandi_id: mandi.id,
      signal_status: signal,
      reasoning_text:
        `Full-coverage seed: subsidy disbursement for ${crop.name} in ${mandi.district} this month is ` +
        `${Math.round(crop.ratio * 100)}% of the same-month 3-year average, blended with FPO survey data.`,
      updated_at: now.toISOString(),
      recalculated_at: now.toISOString(),
      sowing_window_start: todayIso,
      sowing_window_end: windowEnd,
    });
  }
}

// ── Apply ────────────────────────────────────────────────────────────
const failures = [];

if (subsidyRows.length > 0) {
  // Batch in chunks of 500 (Supabase has per-request size limits).
  for (let i = 0; i < subsidyRows.length; i += 500) {
    const batch = subsidyRows.slice(i, i + 500);
    const { error } = await admin.from("subsidy_disbursements").insert(batch);
    if (error) { failures.push(error); break; }
  }
}

{
  const { error } = await admin
    .from("sowing_signals")
    .upsert(signalRows, { onConflict: "crop_id,mandi_id" });
  if (error) failures.push(error);
}

for (const err of failures) console.error("- error:", err.message);
console.log(
  failures.length === 0
    ? `Applied: ${subsidyRows.length} subsidy rows + ${signalRows.length} sowing signals for ALL crops × ALL mandis.`
    : `Applied with ${failures.length} error(s).`
);
process.exit(failures.length === 0 ? 0 : 1);
