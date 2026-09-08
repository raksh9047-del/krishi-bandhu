export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * GET /api/gov/analytics
 *
 * Aggregations for the Government Analytics dashboard. All sums are computed
 * over whatever rows exist in the tables — no per-crop or per-mandi
 * assumptions, so the charts keep working when the pilot set expands. Runs
 * through the admin client because `parchi_ledger` and `disputes` are
 * owner-scoped under RLS.
 */
export async function GET() {
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [{ data: priceRows }, { data: disputeRows }, { data: parchiRows }] = await Promise.all([
    supabaseAdmin
      .from("prices")
      .select("date, crop_id, price")
      .gte("date", since.toISOString().slice(0, 10)),
    supabaseAdmin.from("disputes").select("status, created_at, resolved_at"),
    supabaseAdmin.from("parchi_ledger").select("trader_id, deduction_percent"),
  ]);

  if (priceRows === null || disputeRows === null || parchiRows === null) {
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  // Price trend: one series per crop, averaged per day over the last 30 days.
  const byDateByCrop = new Map<string, Map<string, { sum: number; n: number }>>();
  for (const row of priceRows) {
    const date = String(row.date);
    const cropId = String(row.crop_id);
    const price = Number(row.price);
    if (!byDateByCrop.has(date)) byDateByCrop.set(date, new Map());
    const cropMap = byDateByCrop.get(date)!;
    const acc = cropMap.get(cropId) ?? { sum: 0, n: 0 };
    acc.sum += price;
    acc.n += 1;
    cropMap.set(cropId, acc);
  }

  const cropIds = new Set<string>();
  for (const cropMap of byDateByCrop.values()) {
    for (const cropId of cropMap.keys()) cropIds.add(cropId);
  }

  const priceTrend: Record<string, { date: string; price: number }[]> = {};
  for (const cropId of cropIds) {
    priceTrend[cropId] = [...byDateByCrop.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .flatMap(([date, cropMap]) => {
        const acc = cropMap.get(cropId);
        if (!acc) return [];
        return [{ date, price: Number((acc.sum / acc.n).toFixed(0)) }];
      });
  }

  // Dispute stats.
  const resolvedTimeMs: number[] = [];
  for (const row of disputeRows) {
    if (row.status === "resolved" && row.resolved_at && row.created_at) {
      resolvedTimeMs.push(new Date(row.resolved_at).getTime() - new Date(row.created_at).getTime());
    }
  }
  const avgResolutionHours =
    resolvedTimeMs.length > 0
      ? Number(
          (resolvedTimeMs.reduce((sum, ms) => sum + ms, 0) / resolvedTimeMs.length / 3.6e6).toFixed(1)
        )
      : null;

  // Trader deduction % (same aggregation the parchi anomaly-check route uses).
  const totalDeduction = parchiRows.reduce((sum, r) => sum + Number(r.deduction_percent), 0);
  const byTrader = new Map<string, { sum: number; n: number }>();
  for (const row of parchiRows) {
    const traderId = String(row.trader_id);
    const acc = byTrader.get(traderId) ?? { sum: 0, n: 0 };
    acc.sum += Number(row.deduction_percent);
    acc.n += 1;
    byTrader.set(traderId, acc);
  }
  const traderDeductions = [...byTrader.entries()].map(([trader_id, acc]) => ({
    trader_id,
    avg_deduction_percent: Number((acc.sum / acc.n).toFixed(1)),
    sample_size: acc.n,
  }));

  return NextResponse.json({
    priceTrend,
    disputes: {
      total: disputeRows.length,
      open: disputeRows.filter((r) => r.status === "open").length,
      resolved: disputeRows.filter((r) => r.status === "resolved").length,
      avg_resolution_hours: avgResolutionHours,
    },
    traderDeductions: {
      overall_avg_percent:
        parchiRows.length > 0 ? Number((totalDeduction / parchiRows.length).toFixed(1)) : null,
      byTrader: traderDeductions,
    },
  });
}