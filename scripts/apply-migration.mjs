#!/usr/bin/env node
/**
 * KrishiBandhu — apply a migration SQL file to the live Supabase project via
 * the Management API. Used for migrations 009+ that were written after the
 * initial setup, since `supabase db push` requires a linked CLI.
 *
 * USAGE
 *   node scripts/apply-migration.mjs 009_epo_manual_entry.sql
 *   node scripts/apply-migration.mjs 010_payment_mode_and_mandi_places.sql
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const REF = "kjmcgyudfqwgsdpprhyr";
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!ACCESS_TOKEN) {
  console.error(
    "SUPABASE_ACCESS_TOKEN env var is required (e.g. sbp_...). Set it and re-run."
  );
  process.exit(1);
}

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/apply-migration.mjs <migration.sql>");
  process.exit(1);
}

const sqlPath = resolve(`supabase/migrations/${file}`);
if (!existsSync(sqlPath)) {
  console.error(`Migration not found: ${sqlPath}`);
  process.exit(1);
}

const sql = readFileSync(sqlPath, "utf8");

// Split on semicolons at end of lines, preserving dollar-quoted blocks.
function splitSql(sql) {
  const statements = [];
  let current = "";
  let inDollarQuote = false;
  let dollarTag = "";

  for (const line of sql.split("\n")) {
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

const statements = splitSql(sql);
console.log(`Applying ${file} — ${statements.length} statement(s)\n`);

let failures = 0;
for (let i = 0; i < statements.length; i += 1) {
  const stmt = statements[i];
  const label = `#${i + 1}/${statements.length}: ${stmt.split("\n")[0].slice(0, 70)}`;
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ query: stmt }),
  });
  if (res.ok) {
    console.log(`  OK  ${label}`);
  } else {
    const text = await res.text();
    console.log(`  ERR ${label} — HTTP ${res.status}: ${text.slice(0, 300)}`);
    failures += 1;
  }
}

console.log(`\n${failures === 0 ? "✅" : "❌"} ${file}: ${failures === 0 ? "applied" : `${failures} failure(s)`}`);
process.exit(failures === 0 ? 0 : 1);