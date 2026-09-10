import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envRaw = fs.readFileSync(".env.local", "utf8");
const get = (k) => {
  const m = envRaw.match(new RegExp(`^${k}=(.*)$`, "m"));
  return m ? m[1].trim() : undefined;
};

const url = get("NEXT_PUBLIC_SUPABASE_URL");
const serviceKey = get("SUPABASE_SERVICE_ROLE_KEY");

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

// EXACT same call as the route (including order options object)
const a = await admin.from("storage_directory").select("*").order("district", { ascending: true });
console.log("EXACT route query ->", JSON.stringify({ dataLen: a.data?.length, error: a.error }));

// Plain no-order query
const b = await admin.from("storage_directory").select("*");
console.log("plain select ->", JSON.stringify({ dataLen: b.data?.length, error: b.error }));

// Sanity: prices via admin
const c = await admin.from("prices").select("*").limit(1);
console.log("prices ->", JSON.stringify({ dataLen: c.data?.length, error: c.error?.message }));

// Raw PostgREST
const res = await fetch(`${url}/rest/v1/storage_directory?select=*&limit=3`, {
  headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
});
console.log("PostgREST raw ->", res.status, res.headers.get("content-range"), (await res.text()).slice(0, 150));