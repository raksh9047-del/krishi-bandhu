"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { useTranslation } from "@/lib/i18n";
import { getCropById } from "@/constants";

/**
 * Government analytics dashboard (Phase 8, Part 6). Price trend over the last
 * 30 days (one line per crop present in the data), dispute counts + average
 * resolution time, and trader-level average deduction % reusing the same
 * aggregation the parchi anomaly-check route uses. Everything sums over
 * whatever rows exist, so no changes are needed when the pilot expands.
 */

interface TrendPoint {
  date: string;
  price: number;
}

interface GovAnalyticsData {
  priceTrend: Record<string, TrendPoint[]>;
  disputes: {
    total: number;
    open: number;
    resolved: number;
    avg_resolution_hours: number | null;
  };
  traderDeductions: {
    overall_avg_percent: number | null;
    byTrader: { trader_id: string; avg_deduction_percent: number; sample_size: number }[];
  };
}

const LINE_COLORS = ["#2f6f52", "#375879", "#3d4441", "#8fb8a6", "#9fb4c7", "#c3c9c7"];

function buildChartSeries(priceTrend: Record<string, TrendPoint[]>): { date: string; [crop: string]: string | number }[] {
  const dates = new Set<string>();
  for (const points of Object.values(priceTrend)) {
    for (const point of points) dates.add(point.date);
  }
  return [...dates]
    .sort((a, b) => a.localeCompare(b))
    .map((date) => {
      const row: { date: string; [crop: string]: string | number } = { date };
      for (const [cropId, points] of Object.entries(priceTrend)) {
        const match = points.find((p) => p.date === date);
        if (match) row[cropId] = match.price;
      }
      return row;
    });
}

export function GovAnalytics() {
  const { t } = useTranslation();
  const [data, setData] = useState<GovAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch("/api/gov/analytics")
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.message ?? t("common.error"));
        return json as GovAnalyticsData;
      })
      .then((rows) => {
        if (!cancelled) setData(rows);
      })
      .catch(() => {
        if (!cancelled) setError(t("government.noData"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [t]);

  if (loading) return <p className="text-base text-slate-500">{t("common.loading")}</p>;
  if (error) return <p className="text-base text-slate-500">{error}</p>;
  if (!data) return null;

  const cropIds = Object.keys(data.priceTrend);
  const chartData = buildChartSeries(data.priceTrend);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-card border border-slate-300 p-4">
        <h2 className="mb-2 text-lg font-semibold text-slate-900">{t("government.priceTrendTitle")}</h2>
        {chartData.length === 0 ? (
          <p className="text-base text-slate-500">{t("government.noData")}</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eceeed" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
              <Tooltip />
              <Legend />
              {cropIds.map((cropId, index) => (
                <Line
                  key={cropId}
                  type="monotone"
                  dataKey={cropId}
                  name={getCropById(cropId)?.name ?? cropId}
                  stroke={LINE_COLORS[index % LINE_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="rounded-card border border-slate-300 p-4">
        <h2 className="mb-2 text-lg font-semibold text-slate-900">{t("government.disputesTitle")}</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-card border border-slate-200 p-3">
            <p className="text-2xl font-semibold text-slate-900">{data.disputes.total}</p>
            <p className="text-base text-slate-600">{t("government.disputeTotal")}</p>
          </div>
          <div className="rounded-card border border-slate-200 p-3">
            <p className="text-2xl font-semibold text-slate-900">{data.disputes.open}</p>
            <p className="text-base text-slate-600">{t("government.disputeOpen")}</p>
          </div>
          <div className="rounded-card border border-slate-200 p-3">
            <p className="text-2xl font-semibold text-slate-900">{data.disputes.resolved}</p>
            <p className="text-base text-slate-600">{t("government.disputeResolved")}</p>
          </div>
          <div className="rounded-card border border-slate-200 p-3">
            <p className="text-2xl font-semibold text-slate-900">
              {data.disputes.avg_resolution_hours === null ? "—" : `${data.disputes.avg_resolution_hours}${t("government.hoursUnit")}`}
            </p>
            <p className="text-base text-slate-600">{t("government.disputeAvgResolution")}</p>
          </div>
        </div>
      </div>

      <div className="rounded-card border border-slate-300 p-4">
        <h2 className="mb-2 text-lg font-semibold text-slate-900">{t("government.deductionsTitle")}</h2>
        {data.traderDeductions.byTrader.length === 0 ? (
          <p className="text-base text-slate-500">{t("government.noData")}</p>
        ) : (
          <table className="w-full text-base text-slate-700">
            <thead>
              <tr className="border-b border-slate-300 text-left">
                <th className="py-2 pr-2 font-medium">{t("government.deductionTrader")}</th>
                <th className="py-2 pr-2 font-medium">{t("government.deductionAvg")}</th>
                <th className="py-2 font-medium">{t("government.deductionSamples")}</th>
              </tr>
            </thead>
            <tbody>
              {data.traderDeductions.byTrader.map((row) => (
                <tr key={row.trader_id} className="border-b border-slate-100">
                  <td className="py-2 pr-2">{row.trader_id.slice(0, 8)}</td>
                  <td className="py-2 pr-2">{row.avg_deduction_percent}%</td>
                  <td className="py-2">{row.sample_size}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {data.traderDeductions.overall_avg_percent !== null && (
          <p className="mt-3 text-base text-slate-700">
            {t("government.deductionOverall")}: {data.traderDeductions.overall_avg_percent}%
          </p>
        )}
      </div>
    </div>
  );
}