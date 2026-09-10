import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import fs from "fs";

const envRaw = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const get = (k) => {
  const m = envRaw.match(new RegExp(`^${k}=(.*)$`, "m"));
  return m ? m[1].trim() : undefined;
};
const admin = createClient(get("NEXT_PUBLIC_SUPABASE_URL"), get("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

const GENESIS_SEED = "GENESIS";
const sha = (s) => createHash("sha256").update(s, "utf8").digest("hex");
const stable = (o) => JSON.stringify(Object.keys(o).sort().reduce((a, k) => { a[k] = o[k]; return a; }, {}));

const { data } = await admin.from("parchi_ledger").select("*").eq("mandi_id", "lasalgaon").order("timestamp", { ascending: true });
for (const [i, row] of data.entries()) {
  const payload = {
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
  const prev = i === 0 ? null : data[i - 1].current_hash;
  const computed = sha(stable(payload) + (prev ?? GENESIS_SEED));
  console.log(`[${i}] stored=${row.current_hash}`);
  console.log(`    comput=${computed} match=${computed === row.current_hash} prevUsed=${prev ? prev.slice(0, 10) : "GENESIS"}`);
  console.log(`    payload=${JSON.stringify(payload)}`);
  console.log(`    rowType: gw=${typeof row.gross_weight} ded=${typeof row.deduction_percent} px=${typeof row.price_per_quintal}`);
}