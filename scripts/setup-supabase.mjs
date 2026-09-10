#!/usr/bin/env node
/**
 * KrishiBandhu — One-shot Supabase setup via Management API.
 *
 * Uses the Supabase Management API (api.supabase.com) to run SQL migrations
 * and the JS client for storage/buckets. No CLI linking needed.
 *
 * What this does:
 *   1. Runs schema.sql (creates 11 tables + RLS + policies)
 *   2. Runs migrations 002–007
 *   3. Creates the parchi-photos storage bucket
 *   4. Seeds pilot data via seed-pilot.mjs
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// ── Load .env.local ────────────────────────────────────────────────────────
function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const path = resolve(file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const m = /^\s*(NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_ACCESS_TOKEN|SUPABASE_DB_PASSWORD)\s*=\s*(.*)\s*$/.exec(line);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}
loadEnv();

const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const accessToken = process.env.SUPABASE_ACCESS_TOKEN;

if (!projectUrl) {
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL in .env.local");
  process.exit(1);
}

// Extract project ref from URL
const projectRef = projectUrl.replace(/^https?:\/\//, "").replace(/\.supabase\.co.*$/, "");

// ── Helper: run SQL via Management API ─────────────────────────────────────
async function runSql(sql, label) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query: sql }),
    }
  );

  if (res.ok) {
    console.log(`✅ ${label}`);
    return true;
  }

  const text = await res.text();
  console.error(`❌ ${label} — HTTP ${res.status}: ${text.slice(0, 300)}`);
  return false;
}

// ── Helper: split SQL into individual statements ───────────────────────────
function splitSql(sql) {
  // Simple splitter: split on semicolons at end of lines, preserving
  // dollar-quoted blocks (functions/triggers).
  const statements = [];
  let current = "";
  let inDollarQuote = false;
  let dollarTag = "";

  for (const line of sql.split("\n")) {
    // Check for dollar-quote start/end
    const dollarMatch = line.match(/\$([A-Za-z0-9_]*)\$/);
    if (dollarMatch) {
      if (!inDollarQuote) {
        inDollarQuote = true;
        dollarTag = dollarMatch[1];
      } else if (dollarMatch[1] === dollarTag) {
        inDollarQuote = false;
        dollarTag = "";
      }
    }

    current += line + "\n";

    if (!inDollarQuote && line.trim().endsWith(";")) {
      statements.push(current.trim());
      current = "";
    }
  }

  if (current.trim()) statements.push(current.trim());
  return statements.filter((s) => s.length > 0);
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`🔗 Project: ${projectUrl} (ref: ${projectRef})\n`);

  if (!accessToken) {
    console.log("⚠️  No SUPABASE_ACCESS_TOKEN found in .env.local");
    console.log("   Get one from: https://supabase.com/dashboard/project/" + projectRef + "/settings/tokens");
    console.log("   Then add SUPABASE_ACCESS_TOKEN=your-token to .env.local\n");
    process.exit(1);
  }

  // 1. Run schema.sql
  console.log("1️⃣  Running schema.sql...");
  const schemaSql = readFileSync(resolve("supabase/schema.sql"), "utf8");
  const schemaStatements = splitSql(schemaSql);
  for (let i = 0; i < schemaStatements.length; i++) {
    const stmt = schemaStatements[i];
    const label = `schema.sql #${i + 1}/${schemaStatements.length}`;
    await runSql(stmt, label);
  }

  // 2. Run migrations
  const migrations = [
    "002_subsidy_disbursements.sql",
    "003_fpo_price_entries_public_read.sql",
    "004_bids.sql",
    "005_live_prices.sql",
    "006_backhaul_seed.sql",
    "007_alerts.sql",
  ];
  for (const m of migrations) {
    console.log(`\n2️⃣  Running ${m}...`);
    const sql = readFileSync(resolve(`supabase/migrations/${m}`), "utf8");
    const statements = splitSql(sql);
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      const label = `${m} #${i + 1}/${statements.length}`;
      await runSql(stmt, label);
    }
  }

  // 3. Create storage bucket
  console.log("\n3️⃣  Creating storage bucket...");
  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(projectUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data: buckets } = await admin.storage.listBuckets();
  if (buckets?.some((b) => b.name === "parchi-photos")) {
    console.log("✅ Bucket 'parchi-photos' already exists");
  } else {
    const { error } = await admin.storage.createBucket("parchi-photos", { public: true });
    if (error) console.error(`❌ Bucket creation failed: ${error.message}`);
    else console.log("✅ Created public bucket 'parchi-photos'");
  }

  // 4. Verify RLS
  console.log("\n4️⃣  Verifying RLS...");
  const { data: rlsCheck } = await admin
    .from("pg_tables")
    .select("tablename, rowsecurity")
    .eq("schemaname", "public");
  const off = (rlsCheck || []).filter((r) => !r.rowsecurity);
  if (off.length === 0) {
    console.log("✅ RLS enabled on all tables");
  } else {
    console.log(`⚠️  RLS off on: ${off.map((r) => r.tablename).join(", ")}`);
  }

  // 5. Seed pilot data
  console.log("\n5️⃣  Seeding pilot data...");
  console.log("   Run: node scripts/seed-pilot.mjs --apply");

  console.log("\n🎉 Setup complete!");
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});