// Repair script: recompute parchi_ledger hashes using the CURRENT algorithm in
// lib/parchi-crypto.ts. The pilot's 4 Lasalgaon parchis were seeded before
// migration 010 added payment_mode to the hashed payload, so verify() reported
// brokenAtIndex 0. This rebuilds each farmer/mandi chain in timestamp order and
// updates current_hash / previous_hash in place (disputes FK-reference the
// genesis row, so rows must be preserved). Already-correct chains hash
// identically, so the script is idempotent.
//
// Usage: node scripts/repair-parchi-chains.mjs

import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import fs from "fs";

const envRaw = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const get = (k) => {
  const m = envRaw.match(new RegExp(`^${k}=(.*)$`, "m"));
  return m ? m[1].trim() : undefined;
};

const url = get("NEXT_PUBLIC_SUPABASE_URL");
const key = get("SUPABASE_SERVICE_ROLE_KEY");
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });

const GENESIS_SEED = "GENESIS";

function sha256Hex(input) {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function stableStringify(payload) {
  const sorted = Object.keys(payload).sort().reduce((acc, k) => {
    acc[k] = payload[k];
    return acc;
  }, {});
  return JSON.stringify(sorted);
}

function toHashPayload(row) {
  return {
    farmer_id: row.farmer_id,
    trader_id: row.trader_id,
    crop_id: row.crop_id,
    mandi_id: row.mandi_id,
    gross_weight: row.gross_weight,
    deduction_percent: row.deduction_percent,
    price_per_quintal: row.price_per_quintal,
    payment_mode: row.payment_mode,
    payment_reference: row.payment_reference ?? null,
    credit_note: row.credit_note ?? null,
    timestamp: new Date(row.timestamp).toISOString(),
  };
}

function generateParchiHash(payload, previousHash) {
  const chainInput = stableStringify(payload) + (previousHash ?? GENESIS_SEED);
  return sha256Hex(chainInput);
}

const { data: rows, error } = await admin.from("parchi_ledger").select("*");
if (error) {
  console.error("fetch failed:", error.message);
  process.exit(1);
}

const groups = new Map();
for (const r of rows) {
  const k = `${r.farmer_id}:${r.mandi_id}`;
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(r);
}

const updates = [];
const newHashByRowId = new Map();
let changed = 0;

for (const [k, group] of groups) {
  const ordered = [...group].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  let previousHash = null;
  for (const row of ordered) {
    const newHash = await generateParchiHash(toHashPayload(row), previousHash);
    newHashByRowId.set(row.id, newHash);
    const prevWritten = previousHash;
    previousHash = newHash; // chain the NEXT record to the recomputed value
    if (newHash !== row.current_hash || (row.previous_hash ?? null) !== prevWritten) {
      changed++;
      updates.push({ id: row.id, current_hash: newHash, previous_hash: prevWritten });
    }
  }
}

console.log(`parchi rows: ${rows.length} | chains: ${groups.size} | rows needing update: ${changed}`);

for (const u of updates) {
  const { error: upErr } = await admin.from("parchi_ledger").update(u).eq("id", u.id);
  if (upErr) {
    console.error("update failed for", u.id, upErr.message);
    process.exit(1);
  }
}

// Sync farmer-facing "Parchi recorded" alert payloads that carry a stale hash.
const { data: alerts, error: alertsErr } = await admin
  .from("alerts")
  .select("id, payload")
  .eq("type", "parchi_recorded");
if (alertsErr) {
  console.error("alerts fetch failed:", alertsErr.message);
  process.exit(1);
}
for (const a of alerts) {
  const pid = a.payload?.parchi_id;
  const fresh = pid ? newHashByRowId.get(pid) : undefined;
  if (fresh && a.payload?.hash !== fresh) {
    const { error: upErr } = await admin
      .from("alerts")
      .update({ payload: { ...a.payload, hash: fresh } })
      .eq("id", a.id);
    if (upErr) console.error("alert update failed for", a.id, upErr.message);
    else console.log(`alert ${a.id}: hash -> ${fresh.slice(0, 12)}…`);
  }
}

console.log("done.");