/**
 * KrishiBandhu — farmer alert messages, with a resilient storage layer.
 *
 * Preferred backend: the Postgres `alerts` table (supabase/migrations/
 * 007_alerts.sql). Until that migration is applied to a project, the same
 * operations transparently fall back to Supabase Storage JSON blobs in the
 * `krishibandhu-alerts` bucket — so the feature works end-to-end with ZERO
 * DDL, and silently moves to Postgres once the table exists. Callers never
 * need to know which backend served the data.
 *
 * All helpers return `null` on a real (non "table missing") backend error
 * rather than throwing — callers decide how to degrade.
 */

import { supabaseAdmin } from "@/lib/supabase-admin";
import type { AlertSeverity, FarmerAlert, FarmerAlertType } from "@/types";

const ALERTS_BUCKET = "krishibandhu-alerts";

function tableMissing(error: { message?: string } | null): boolean {
  return !!error && /could not find the table/i.test(error.message ?? "");
}

export interface NewAlertInput {
  farmer_id: string;
  type: FarmerAlertType;
  title: string;
  message: string;
  severity?: AlertSeverity;
  payload?: Record<string, unknown> | null;
}

// ─────────────────────────── Postgres backend ───────────────────────────

async function createAlertPg(input: NewAlertInput): Promise<FarmerAlert | null> {
  const { data, error } = await supabaseAdmin
    .from("alerts")
    .insert({
      farmer_id: input.farmer_id,
      type: input.type,
      title: input.title,
      message: input.message,
      severity: input.severity ?? "info",
      payload: input.payload ?? null,
    })
    .select()
    .single();

  if (error) return null;
  return (data as FarmerAlert) ?? null;
}

async function listFarmerAlertsPg(farmerId: string, limit: number): Promise<FarmerAlert[] | null> {
  const { data, error } = await supabaseAdmin
    .from("alerts")
    .select("*")
    .eq("farmer_id", farmerId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return null;
  return (data as FarmerAlert[]) ?? null;
}

async function markFarmerAlertsReadPg(farmerId: string): Promise<number | null> {
  const { data, error } = await supabaseAdmin
    .from("alerts")
    .update({ is_read: true })
    .eq("farmer_id", farmerId)
    .eq("is_read", false)
    .select("id");

  if (error) return null;
  return data?.length ?? 0;
}

async function clearFarmerAlertsPg(farmerId: string): Promise<number> {
  const { data } = await supabaseAdmin.from("alerts").delete().eq("farmer_id", farmerId).select("id");
  return data?.length ?? 0;
}

// ─────────────────────────── Storage fallback ───────────────────────────

function bucketPath(farmerId: string): string {
  return `alerts/${farmerId}`;
}

async function ensureBucket(): Promise<void> {
  const { error } = await supabaseAdmin.storage.getBucket(ALERTS_BUCKET);
  if (error) {
    // Bucket missing — create it. Creation errors (e.g. just-created races)
    // are ignored; the list/upload calls below surface any real problem.
    await supabaseAdmin.storage.createBucket(ALERTS_BUCKET, { public: false }).catch(() => {});
  }
}

async function storageReadFile(filePath: string): Promise<FarmerAlert | null> {
  try {
    const { data, error } = await supabaseAdmin.storage.from(ALERTS_BUCKET).download(filePath);
    if (error || !data) return null;
    return JSON.parse(await data.text()) as FarmerAlert;
  } catch {
    return null;
  }
}

async function storageListFiles(prefix: string): Promise<Array<{ name: string }>> {
  await ensureBucket();
  try {
    const { data, error } = await supabaseAdmin.storage.from(ALERTS_BUCKET).list(prefix);
    if (error || !data) return [];
    return data.filter((f) => f.name.endsWith(".json"));
  } catch {
    return [];
  }
}

async function createAlertStorage(input: NewAlertInput): Promise<FarmerAlert | null> {
  await ensureBucket();
  const record: FarmerAlert = {
    id: crypto.randomUUID(),
    farmer_id: input.farmer_id,
    type: input.type,
    severity: input.severity ?? "info",
    title: input.title,
    message: input.message,
    payload: input.payload ?? null,
    is_read: false,
    created_at: new Date().toISOString(),
  };
  try {
    const { error } = await supabaseAdmin.storage
      .from(ALERTS_BUCKET)
      .upload(`${bucketPath(input.farmer_id)}/${record.id}.json`, JSON.stringify(record), {
        upsert: true,
        contentType: "application/json",
      });
    if (error) return null;
    return record;
  } catch {
    return null;
  }
}

async function listFarmerAlertsStorage(farmerId: string, limit: number): Promise<FarmerAlert[] | null> {
  const files = await storageListFiles(bucketPath(farmerId));
  const alerts: FarmerAlert[] = [];
  for (const file of files) {
    const alert = await storageReadFile(`${bucketPath(farmerId)}/${file.name}`);
    if (alert) alerts.push(alert);
  }
  alerts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return alerts.slice(0, limit);
}

async function markFarmerAlertsReadStorage(farmerId: string): Promise<number> {
  const files = await storageListFiles(bucketPath(farmerId));
  let updated = 0;
  for (const file of files) {
    const alert = await storageReadFile(`${bucketPath(farmerId)}/${file.name}`);
    if (alert && !alert.is_read) {
      const patched = { ...alert, is_read: true };
      try {
        await supabaseAdmin.storage
          .from(ALERTS_BUCKET)
          .upload(`${bucketPath(farmerId)}/${file.name}`, JSON.stringify(patched), {
            upsert: true,
            contentType: "application/json",
          });
        updated++;
      } catch {
        // skip — next read of that alert still shows unread
      }
    }
  }
  return updated;
}

async function clearFarmerAlertsStorage(farmerId: string): Promise<number> {
  const files = await storageListFiles(bucketPath(farmerId));
  if (files.length === 0) return 0;
  try {
    const { error } = await supabaseAdmin.storage
      .from(ALERTS_BUCKET)
      .remove(files.map((f) => `${bucketPath(farmerId)}/${f.name}`));
    return error ? 0 : files.length;
  } catch {
    return 0;
  }
}

// ─────────────────────────── public API ───────────────────────────

export async function createAlert(input: NewAlertInput): Promise<FarmerAlert | null> {
  const pg = await createAlertPg(input);
  if (pg) return pg;

  // If the failure was "table not found", fall back to Storage; a genuine
  // insert error is reported as null.
  const { error } = await supabaseAdmin.from("alerts").select("id").limit(1);
  if (!tableMissing(error)) return null;
  return createAlertStorage(input);
}

export async function listFarmerAlerts(
  farmerId: string,
  limit = 6
): Promise<FarmerAlert[] | null> {
  const pg = await listFarmerAlertsPg(farmerId, limit);
  if (pg) return pg;

  const { error } = await supabaseAdmin.from("alerts").select("id").limit(1);
  if (!tableMissing(error)) return null;
  return listFarmerAlertsStorage(farmerId, limit);
}

export async function markFarmerAlertsRead(farmerId: string): Promise<number | null> {
  const pg = await markFarmerAlertsReadPg(farmerId);
  if (pg !== null) return pg;

  const { error } = await supabaseAdmin.from("alerts").select("id").limit(1);
  if (!tableMissing(error)) return null;
  return markFarmerAlertsReadStorage(farmerId);
}

export async function clearFarmerAlerts(farmerId: string): Promise<number> {
  const { error } = await supabaseAdmin.from("alerts").select("id").limit(1);
  if (!tableMissing(error)) {
    return clearFarmerAlertsPg(farmerId);
  }
  return clearFarmerAlertsStorage(farmerId);
}