#!/usr/bin/env node
/**
 * KrishiBandhu — Supabase connectivity + schema/seed/storage verifier.
 *
 * Usage:
 *   node scripts/verify-supabase.mjs
 *
 * Reads .env.local (then .env) for the three Supabase values, detects
 * placeholders, and — when real values are present — checks:
 *   1. REST reachability  2. expected tables  3. key row counts
 *   4. the public `parchi-photos` storage bucket.
 * Never prints credential values, only lengths/labels.
 */

import { readFileSync, existsSync } from "node:fs";

function loadEnvVars() {
  const out = {};
  for (const file of [".env.local", ".env"]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && !(m[1] in out)) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  return out;
}

const env = loadEnvVars();
const url = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const role = env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const isPlaceholderUrl = !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url) || /YOUR-/.test(url) || /pris\.ly/.test(url);
const isPlaceholderKey = (k) => !k || k.startsWith("YOUR-") || k.length < 30;

const EXPECTED_TABLES = [
  "users", "crops", "mandis", "parchi_ledger", "sowing_signals",
  "fpo_price_entries", "fpo_survey_responses", "disputes", "storage_directory",
  "backhaul_trucks", "subsidy_disbursements", "prices", "bids",
];

const EXPECTED_MIN_COUNTS = { crops: 13, mandis: 10, sowing_signals: 9, prices: 27 };

function mask(prefix, val) {
  const head = val.replace(/^https:\/\//, "").slice(0, 20);
  return `${prefix}:${head}…`;
}

async function main() {
  if (isPlaceholderUrl || isPlaceholderKey(anon) || isPlaceholderKey(role)) {
    console.log("STATUS: PLACEHOLDERS — Supabase not connected yet.\n");
    console.log("  URL   :", isPlaceholderUrl ? mask("placeholder", url) : "ok");
    console.log("  anon  :", isPlaceholderKey(anon) ? "placeholder" : `ok (${anon.length} chars)`);
    console.log("  role  :", isPlaceholderKey(role) ? "placeholder" : `ok (${role.length} chars)`);
    console.log("\nFix: open .env.local and replace ONLY these three values (do not paste them here):");
    console.log("  NEXT_PUBLIC_SUPABASE_URL   = https://<your-ref>.supabase.co");
    console.log("  NEXT_PUBLIC_SUPABASE_ANON_KEY = <anon public key>");
    console.log("  SUPABASE_SERVICE_ROLE_KEY  = <service_role secret key>");
    console.log("Then re-run this script.");
    process.exit(2);
  }

  const headers = { apikey: role, Authorization: `Bearer ${role}`, "Content-Type": "application/json" };
  const failures = [];

  async function getJson(path) {
    const res = await fetch(`${url}${path}`, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return res.json();
  }

  console.log(`STATUS: CONNECTED  ${url.replace(/\/$/, "")}`);
  console.log("  anon key / service-role key: real values, lengths", anon.length, "/", role.length);

  // 1. REST reachability + list tables (PostgREST root returns the schema).
  let tables = [];
  try {
    const schema = await getJson("/rest/v1/");
    tables = Object.keys(schema.definitions ?? {}).map((n) => n.toLowerCase()).filter((n) => !n.startsWith("_"));
  } catch (e) {
    failures.push(`REST root: ${e.message}`);
    tables = [];
  }

  console.log(`\nTABLES found (${tables.length}): ${[].concat(tables).sort().join(", ")}`);
  for (const expected of EXPECTED_TABLES) {
    const present = tables.includes(expected);
    if (!present) failures.push(`missing table: ${expected}`);
  }

  // 2. Row counts for the deterministic seeds.
  console.log("\nROW COUNTS (expected minimum in parentheses):");
  for (const [table, minCount] of Object.entries(EXPECTED_MIN_COUNTS)) {
    try {
      const res = await fetch(`${url}/rest/v1/${table}?select=count`, {
        headers: { ...headers, Prefer: "count=exact" },
      });
      const body = await res.json();
      if (!res.ok) {
        const missing = /PGRST205|Could not find the table/i.test(JSON.stringify(body));
        const label = missing ? "MISSING (not applied yet)" : `ERR ${res.status}`;
        if (missing) failures.push(`table missing: ${table}`);
        console.log(`  --  ${table}: ${label}`);
        continue;
      }
      const count = Number(Array.isArray(body) && body[0] ? body[0].count : 0);
      const ok = count >= minCount;
      if (!ok) failures.push(`${table} count ${count} < expected ${minCount}`);
      console.log(`  ${ok ? "OK " : "LOW"}  ${table}: ${count}${ok ? "" : ` (expected >=${minCount})`}`);
    } catch (e) {
      failures.push(`${table} query: ${e.message}`);
    }
  }

  // 3. Storage bucket.
  try {
    const buckets = await getJson("/storage/v1/bucket");
    const target = buckets.find((b) => b.name === "parchi-photos");
    if (target) {
      const pub = target.public;
      console.log(`\nSTORAGE parchi-photos: present, public=${pub}`);
      if (!pub) failures.push("parchi-photos bucket exists but is NOT public");
    } else {
      failures.push("storage bucket parchi-photos missing");
      console.log("\nSTORAGE parchi-photos: MISSING — create it (Storage → New bucket → name parchi-photos → toggle Public ON).");
    }
  } catch (e) {
    failures.push(`storage check: ${e.message}`);
  }

  console.log(`\nRESULT: ${failures.length === 0 ? "ALL CHECKS PASSED" : `${failures.length} issue(s):`}`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(failures.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});