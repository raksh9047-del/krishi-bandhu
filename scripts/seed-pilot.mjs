#!/usr/bin/env node
/**
 * KrishiBandhu — Pilot 3x3 seed dataset generator (Phase 8, Part 1).
 *
 * Generates an internally-consistent dataset for the pilot subset
 * (Onion/Tomato/Cotton x Vashi/Lasalgaon/Pune Gultekdi):
 *
 *   - 3+ years of subsidy-disbursement history per crop/district/month
 *     (feeds migration 002 for the Sowing Signal's same-month-3-year average),
 *     with ±~20% month-to-month variance AND a deterministic spike on the
 *     CURRENT month sized so the recomputed signal is genuinely RED (onion),
 *     YELLOW (tomato) and GREEN (cotton) — plus a ~140% spike on the previous
 *     month so there's more than one recent standout.
 *   - sowing_signals rows with real, current-season sowing windows, statuses
 *     and reasoning text consistent with the numbers above — without these,
 *     /api/sowing-signal/calculate 404s ("no window configured").
 *   - Seed `prices` rows (source='seed') in the documented pilot price
 *     ranges with plausibly recent dates.
 *   - One demo FPO user (created out of band — the register endpoint refuses
 *     to mint FPOs) that /api/fpo/demo-user resolves.
 *
 *   (Backhaul truck rows are NOT generated here — they live once, in the
 *   build's migration `006_backhaul_seed.sql`, so the farmer backhaul view
 *   and the FPO admin screen read the same canonical rows.)
 *
 * Sessions windows are hinged on "today" so the Sowing Signal API is inside
 * its window no matter when you run this. The random history is seeded (see
 * mulberry32 below), so the relative numbers are reproducible.
 *
 * USAGE
 *   node scripts/seed-pilot.mjs                 # prints SQL for the SQL editor
 *   node scripts/seed-pilot.mjs --apply         # writes directly via service role
 *                                               # (needs NEXT_PUBLIC_SUPABASE_URL +
 *                                               #   SUPABASE_SERVICE_ROLE_KEY in .env/.env.local)
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const APPLY = process.argv.includes("--apply");

// ── Constants (must match constants.ts — thresholds + blend weights) ──────
const SUBSIDY_WEIGHT = 0.6;
const SURVEY_WEIGHT = 0.4;
const THRESHOLDS = {
  onion: { redAbove: 1.3, yellowAbove: 1.0 },
  tomato: { redAbove: 1.35, yellowAbove: 1.05 },
  cotton: { redAbove: 1.5, yellowAbove: 1.15 },
};

const PILOT_CROPS = [
  { id: "onion", name: "Onion", baseSubsidy: 2_400_000, priceBase: 2000, priceMin: 1200, priceMax: 2800 },
  { id: "tomato", name: "Tomato", baseSubsidy: 1_800_000, priceBase: 2150, priceMin: 800, priceMax: 3500 },
  { id: "cotton", name: "Cotton", baseSubsidy: 3_200_000, priceBase: 6900, priceMin: 6000, priceMax: 7800 },
];

const PILOT_MANDIS = [
  { id: "vashi", name: "Vashi", district: "Thane", lat: 19.07, lng: 73.0, villages: ["Bhiwandi", "Kharghar", "Palghar", "Ambarnath"] },
  { id: "lasalgaon", name: "Lasalgaon", district: "Nashik", lat: 20.15, lng: 74.24, villages: ["Niphad", "Satana", "Yeola", "Chandwad", "Malegaon"] },
  { id: "pune-gultekdi", name: "Pune Gultekdi", district: "Pune", lat: 18.48, lng: 73.87, villages: ["Baramati", "Junnar", "Shirur", "Indapur", "Daund"] },
];

// Demo FPO identity (created out of band by this script) — matches the phone
// lookup in app/api/fpo/demo-user/route.ts.
const DEMO_FPO = { id: "00000000-0000-4000-8000-0000000000f0", role: "fpo", phone: "6000000000", name: "Demo FPO Coordinator" };

// Demo farmer + trader accounts. These exist so the pilot's login flow
// (POST /api/auth/login → /api/auth/verify-otp) works without a fresh
// sign-up, and so the farmer/trader screens have seeded Parchi chains and
// alerts to display. Each entry here creates BOTH an auth user (via
// supabase.auth.admin.createUser) AND a matching users row.
const DEMO_USERS = [
  {
    id: "7fa4837a-989b-4abd-98ec-2124b1c1d011",
    role: "farmer",
    phone: "9876543210",
    name: "P1 Demo Farmer",
    upi_vpa: "p1farmer@upi",
    hasParchiChain: true,
  },
  {
    id: "9f618a98-f7fd-4c47-bfb5-cb5bde6bec25",
    role: "farmer",
    phone: "9876543211",
    name: "Test Farmer",
    upi_vpa: null,
    hasParchiChain: false,
  },
  {
    id: "b28c318e-cec2-4a3f-9009-21c6ca8be0ad",
    role: "trader",
    phone: "9876543220",
    name: "P1 Demo Trader",
    upi_vpa: "p1trader@upi",
    hasParchiChain: true,
  },
];

// ── Seeded RNG (mulberry32) so historical numbers are reproducible ────────
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
function between(min, max) {
  return min + rng() * (max - min);
}

// ── Date helpers ───────────────────────────────────────────────────────────
const now = new Date();
const todayIso = now.toISOString().slice(0, 10);

function monthKey(d) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}
function addMonths(d, delta) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + delta, 1));
}
function addDays(d, delta) {
  const copy = new Date(d);
  copy.setUTCDate(copy.getUTCDate() + delta);
  return copy;
}
function toLocalDateTimeIso(date, hour, minute = 0) {
  const pad = (n) => String(n).padStart(2, "0");
  const local = new Date(date);
  local.setHours(hour, minute, 0, 0);
  const offset = -local.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const abs = Math.abs(offset);
  return `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}T${pad(local.getHours())}:${pad(local.getMinutes())}:00${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

const CURRENT_MONTH = monthKey(now);
const PREV_MONTH = monthKey(addMonths(now, -1));

// ── 1. Subsidy disbursements (3+ years, current-month spike) ───────────────
const subsidyRows = [];
const districtFactor = {};
for (const mandi of PILOT_MANDIS) districtFactor[mandi.district] = between(0.92, 1.08);

for (const crop of PILOT_CROPS) {
  for (const mandi of PILOT_MANDIS) {
    const factor = districtFactor[mandi.district];
    let priorSameMonthSum = 0;
    let priorSameMonthCount = 0;

    // 42 months back -> current (>=3 prior same-month years for any current month).
    for (let offset = 42; offset >= 0; offset -= 1) {
      const month = addMonths(now, -offset);
      const key = monthKey(month);
      if (key === CURRENT_MONTH) break;
      const variance = 1 + between(-0.2, 0.2);
      let amount = crop.baseSubsidy * factor * variance;
      // ~140% extra spike on the previous month only (per crop) for the demo.
      if (key === PREV_MONTH) amount = crop.baseSubsidy * factor * 1.4;
      subsidyRows.push({ crop_id: crop.id, district: mandi.district, month: key, amount: Math.round(amount) });
      if (month.getUTCMonth() === now.getUTCMonth() && month.getUTCFullYear() < now.getUTCFullYear()) {
        priorSameMonthSum += amount;
        priorSameMonthCount += 1;
      }
    }

    // Current month: deterministic spike sized to force the intended signal
    // given the actual stored prior same-month average (0.6*ratio + 0.4 = blended).
    const priorAvg = priorSameMonthCount > 0 ? priorSameMonthSum / priorSameMonthCount : crop.baseSubsidy * factor;
    const spikeRatio = crop.id === "onion" ? 1.75 : crop.id === "tomato" ? 1.4 : 1.0;
    subsidyRows.push({
      crop_id: crop.id,
      district: mandi.district,
      month: CURRENT_MONTH,
      amount: Math.round(priorAvg * spikeRatio),
    });
  }
}

// ── 2. Sowing signals (current-season windows ensuring API stays in-window) ─
const signalRows = [];
for (const crop of PILOT_CROPS) {
  for (const mandi of PILOT_MANDIS) {
    const ratio = crop.id === "onion" ? 1.75 : crop.id === "tomato" ? 1.4 : 1.0;
    const blended = SUBSIDY_WEIGHT * ratio + SURVEY_WEIGHT * 1;
    const t = THRESHOLDS[crop.id];
    const signal = blended > t.redAbove ? "red" : blended > t.yellowAbove ? "yellow" : "green";
    const windowStart = todayIso;
    const windowEnd = crop.id === "onion" ? addDays(now, 75).toISOString().slice(0, 10)
      : crop.id === "tomato" ? addDays(now, 365).toISOString().slice(0, 10)
      : addDays(now, 150).toISOString().slice(0, 10);
    signalRows.push({
      crop_id: crop.id,
      mandi_id: mandi.id,
      signal_status: signal,
      reasoning_text:
        `Seed-subsidy disbursement for ${crop.name} in ${mandi.district} this month is ${Math.round(ratio * 100)}% of the ` +
        `same-month 3-year average, blended with FPO survey data showing 0% of surveyed farmers planting ${crop.name} this season.`,
      updated_at: now.toISOString(),
      recalculated_at: now.toISOString(),
      sowing_window_start: windowStart,
      sowing_window_end: windowEnd,
    });
  }
}

// ── 3. Seed prices (source='seed', recent dates, documented ranges) ────────
const priceRows = [];
for (const crop of PILOT_CROPS) {
  for (const mandi of PILOT_MANDIS) {
    for (let dayOffset = 2; dayOffset >= 0; dayOffset -= 1) {
      const date = addDays(now, -dayOffset).toISOString().slice(0, 10);
      const price = Math.round(Math.min(crop.priceMax, Math.max(crop.priceMin, crop.priceBase * between(0.9, 1.15))));
      const arrival = Math.round(between(150, 1200) * (crop.id === "cotton" ? 0.4 : 1));
      priceRows.push({ crop_id: crop.id, mandi_id: mandi.id, price, date, source: "seed", arrival_volume_tons: arrival });
    }
  }
}

// ── SQL emission ───────────────────────────────────────────────────────────
const q = (v) => `'${String(v).replace(/'/g, "''")}'`;
const num = (v) => String(v);

const subsidySql = subsidyRows
  .map((r) => `(${q(r.crop_id)}, ${q(r.district)}, ${q(r.month)}, ${num(r.amount)})`)
  .join(",\n  ");

const signalSql = signalRows
  .map(
    (r) =>
      `(${q(r.crop_id)}, ${q(r.mandi_id)}, ${q(r.signal_status)}, ${q(r.reasoning_text)}, ${q(r.updated_at)}, ${q(r.recalculated_at)}, ${q(r.sowing_window_start)}, ${q(r.sowing_window_end)})`
  )
  .join(",\n  ");

const priceSql = priceRows
  .map((r) => `(${q(r.crop_id)}, ${q(r.mandi_id)}, ${num(r.price)}, ${q(r.date)}, ${q(r.source)}, ${num(r.arrival_volume_tons)})`)
  .join(",\n  ");

const sqlStatements = [
  `-- Demo FPO user (out of band; the register endpoint refuses to mint FPOs).`,
  `insert into users (id, role, name, phone) values (${q(DEMO_FPO.id)}, 'fpo', ${q(DEMO_FPO.name)}, ${q(DEMO_FPO.phone)})\non conflict (phone) do nothing;`,
  ``,
  `-- Demo farmer + trader accounts (auth users + matching users rows).`,
  `-- These are the accounts the pilot's login flow uses. Each needs BOTH an`,
  `-- auth.users row (so Supabase can issue OTPs) and a users row with the SAME`,
  `-- UUID (so RLS policies that key off auth.uid() match).`,
  ...DEMO_USERS.map(
    (u) =>
      `-- ${u.role}: ${u.name} (${u.phone})\n` +
      `-- NOTE: the auth.users row must be created via the admin API, not SQL.`
  ),
  ``,
  `-- Subsidy disbursement history (${subsidyRows.length} rows).`,
  `insert into subsidy_disbursements (crop_id, district, month, amount) values\n  ${subsidySql};`,
  ``,
  `-- Sowing signals for the 9 pilot pairs.`,
  `insert into sowing_signals (crop_id, mandi_id, signal_status, reasoning_text, updated_at, recalculated_at, sowing_window_start, sowing_window_end) values\n  ${signalSql}\non conflict (crop_id, mandi_id) do update set signal_status = excluded.signal_status, reasoning_text = excluded.reasoning_text, updated_at = excluded.updated_at, recalculated_at = excluded.recalculated_at;`,
  ``,
  `-- Seed prices (${priceRows.length} rows).`,
  `insert into prices (crop_id, mandi_id, price, date, source, arrival_volume_tons) values\n  ${priceSql}\non conflict (crop_id, mandi_id, date, source) do nothing;`,
];

if (!APPLY) {
  console.log(`-- KrishiBandhu pilot seed (generated ${todayIso}, ${subsidyRows.length} subsidy + ${signalRows.length} signal + ${priceRows.length} price rows)`);
  console.log(`-- Run AFTER migrations 001-007 (schema.sql, 002, 003, 004, 005, 006, 007).`);
  console.log(`-- (Backhaul truck rows come from migration 006_backhaul_seed.sql.)`);
  console.log(`-- Demo auth users (${DEMO_USERS.length} farmer/trader accounts + 1 FPO) are created by the --apply path via the admin API; the SQL editor path only emits the users table rows.`);
  console.log(sqlStatements.join("\n\n"));
  process.exit(0);
}

// ── Direct apply via service-role client ───────────────────────────────────
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
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — can't apply directly.");
  process.exit(1);
}
const admin = createClient(url, key, { auth: { persistSession: false } });

// 0. Create auth users for the demo accounts (idempotent).
//    Uses the admin client's `createUser` — this creates the auth user
//    directly without needing an OTP, which is correct for seeded demo
//    accounts. Phone auth must be enabled in the Supabase dashboard.
for (const u of DEMO_USERS) {
  const { data: existing, error: lookupErr } = await admin.auth.admin.getUserById(u.id);
  if (lookupErr && lookupErr.code !== "user_not_found") {
    console.error(`- error looking up ${u.name}:`, lookupErr.message);
    continue;
  }
  if (!existing) {
    const { error: createErr } = await admin.auth.admin.createUser({
      id: u.id,
      phone: u.phone,
      user_metadata: { role: u.role, name: u.name },
    });
    if (createErr) console.error(`- error creating auth user ${u.name}:`, createErr.message);
  }
}

// 1. Upsert the users rows (matching the auth user UUIDs).
//    Only the real users-table columns are projected — hasParchiChain is a
//    script-level flag used to drive the Parchi-chain seeding below, not a
//    column, and passing it through caused "column does not exist" errors.
for (const u of [...DEMO_USERS, DEMO_FPO]) {
  const { error } = await admin
    .from("users")
    .upsert(
      { id: u.id, role: u.role, name: u.name, phone: u.phone, upi_vpa: u.upi_vpa ?? null },
      { onConflict: "phone" },
    );
  if (error) console.error(`- error upserting ${u.name}:`, error.message);
}

const { error: subsidyErr } = await admin.from("subsidy_disbursements").insert(subsidyRows);
const { error: signalErr } = await admin.from("sowing_signals").upsert(signalRows, { onConflict: "crop_id,mandi_id" });
const { error: priceErr } = await admin.from("prices").upsert(priceRows, { onConflict: "crop_id,mandi_id,date,source" });

const failures = [subsidyErr, signalErr, priceErr].filter(Boolean);
for (const err of failures) console.error("- error:", err.message);
console.log(
  failures.length === 0
    ? `Applied: ${subsidyRows.length} subsidy, ${signalRows.length} signals, ${priceRows.length} prices, ${DEMO_USERS.length + 1} demo users. (Backhaul rows come from migration 006.)`
    : `Applied with ${failures.length} error(s).`
);
process.exit(failures.length === 0 ? 0 : 1);