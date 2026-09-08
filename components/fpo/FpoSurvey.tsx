"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { useTranslation } from "@/lib/i18n";
import { CROPS, getCropById } from "@/constants";

/**
 * FPO farmer-survey module (Phase 8, Part 3). Log what farmers in the
 * covered villages are planting (village, crop, area, expected harvest
 * month, optional farmer name), then show the aggregation view: % of
 * surveyed farmers planting each crop this season vs the same share
 * historically. Calls /api/fpo/survey-stats so the two numbers agree with
 * the survey side of the Sowing Signal route.
 */

interface CropShare {
  count: number;
  pct: number;
}

interface SeasonAggregate {
  total: number;
  byCrop: Record<string, CropShare>;
}

const numberInputClass = "min-h-touch w-full rounded-card border border-slate-300 px-3 text-base";

export function FpoSurvey() {
  const fpoId = useAppStore((s) => s.currentFpoId);
  const { t } = useTranslation();

  const [village, setVillage] = useState("");
  const [cropId, setCropId] = useState(CROPS[0].id);
  const [area, setArea] = useState("");
  const [harvest, setHarvest] = useState("");
  const [farmerName, setFarmerName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [aggregate, setAggregate] = useState<{ current: SeasonAggregate; prior: SeasonAggregate } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch("/api/fpo/survey-stats")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message ?? t("common.error"));
        return data as { currentSeason: SeasonAggregate; priorSeason: SeasonAggregate };
      })
      .then((stats) => {
        if (!cancelled) setAggregate({ current: stats.currentSeason, prior: stats.priorSeason });
      })
      .catch(() => {
        if (!cancelled) setAggregate(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [t]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fpoId) return;
    setError(null);
    setSuccess(false);
    setSubmitting(true);

    const res = await fetch("/api/fpo/survey", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fpo_id: fpoId,
        village,
        crop_id: cropId,
        area_hectares: Number(area),
        expected_harvest_month: harvest,
        farmer_name: farmerName.trim() || null,
      }),
    });
    const result = await res.json();
    setSubmitting(false);

    if (res.ok) {
      setVillage("");
      setArea("");
      setHarvest("");
      setFarmerName("");
      setSuccess(true);
      setLoading(true);
      fetch("/api/fpo/survey-stats")
        .then(async (r) => {
          const data = await r.json();
          if (r.ok) setAggregate({ current: data.currentSeason, prior: data.priorSeason });
        })
        .catch(() => undefined)
        .finally(() => setLoading(false));
    } else {
      const firstError = result.fields ? Object.values(result.fields).flat()[0] : undefined;
      setError(typeof firstError === "string" ? firstError : result.message ?? t("common.error"));
    }
  }

  const byCrop = aggregate
    ? new Set<string>([...Object.keys(aggregate.current.byCrop), ...Object.keys(aggregate.prior.byCrop)])
    : new Set<string>();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-slate-900">{t("fpoSurvey.title")}</h1>
      <p className="text-base text-slate-600">{t("fpoSurvey.subtitle")}</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-card border border-slate-300 p-4">
        <label className="flex flex-col gap-1">
          <span className="text-base text-slate-700">{t("fpoSurvey.villageLabel")}</span>
          <input
            type="text"
            required
            value={village}
            onChange={(e) => setVillage(e.target.value)}
            className={numberInputClass}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-base text-slate-700">{t("fpoSurvey.cropLabel")}</span>
          <select
            value={cropId}
            onChange={(e) => setCropId(e.target.value)}
            className="min-h-touch w-full rounded-card border border-slate-300 bg-white px-2 text-base text-slate-900"
          >
            {CROPS.map((crop) => (
              <option key={crop.id} value={crop.id}>
                {crop.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-base text-slate-700">{t("fpoSurvey.areaLabel")}</span>
          <input
            type="number"
            min={0}
            step="any"
            required
            value={area}
            onChange={(e) => setArea(e.target.value)}
            className={numberInputClass}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-base text-slate-700">{t("fpoSurvey.harvestLabel")}</span>
          <input
            type="date"
            required
            value={harvest}
            onChange={(e) => setHarvest(e.target.value)}
            className={numberInputClass}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-base text-slate-700">{t("fpoSurvey.farmerNameLabel")}</span>
          <input
            type="text"
            value={farmerName}
            onChange={(e) => setFarmerName(e.target.value)}
            className={numberInputClass}
          />
        </label>

        {error && <span className="text-base text-signal-red">{error}</span>}
        {success && <span className="text-base text-trust-700">{t("fpoSurvey.success")}</span>}

        <button
          type="submit"
          disabled={submitting}
          className="min-h-touch rounded-card bg-trust-500 px-4 text-base font-medium text-white disabled:opacity-60"
        >
          {t("fpoSurvey.submit")}
        </button>
      </form>

      <div className="rounded-card border border-slate-300 p-4">
        <h2 className="text-lg font-semibold text-slate-900">{t("fpoSurvey.aggregationTitle")}</h2>

        {loading ? (
          <p className="mt-2 text-base text-slate-500">{t("common.loading")}</p>
        ) : byCrop.size === 0 ? (
          <p className="mt-2 text-base text-slate-500">{t("fpoSurvey.noData")}</p>
        ) : (
          <table className="mt-2 w-full text-base text-slate-700">
            <thead>
              <tr className="border-b border-slate-300 text-left">
                <th className="py-2 pr-2 font-medium">{t("fpoSurvey.cropColumn")}</th>
                <th className="py-2 pr-2 font-medium">{t("fpoSurvey.currentColumn")}</th>
                <th className="py-2 font-medium">{t("fpoSurvey.priorColumn")}</th>
              </tr>
            </thead>
            <tbody>
              {[...byCrop].map((cropId) => {
                const crop = getCropById(cropId);
                const current = aggregate?.current.byCrop[cropId];
                const prior = aggregate?.prior.byCrop[cropId];
                return (
                  <tr key={cropId} className="border-b border-slate-100">
                    <td className="py-2 pr-2">{crop?.name ?? cropId}</td>
                    <td className="py-2 pr-2">{current ? `${current.pct.toFixed(0)}%` : "0%"}</td>
                    <td className="py-2">{prior ? `${prior.pct.toFixed(0)}%` : "0%"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}