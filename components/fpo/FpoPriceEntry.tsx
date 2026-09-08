"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { useTranslation } from "@/lib/i18n";
import { CROPS, MANDIS, getCropById, getMandiById } from "@/constants";

/**
 * FPO manual price-entry dashboard — the platform's real, independent price
 * source. Crop/mandi selectors, a price + arrival-volume entry form, the
 * coordinator's last-used mandi persisted in localStorage (keyed by user id),
 * and a 30-day history table with client-side CSV export.
 */

interface PriceEntry {
  id: string;
  crop_id: string;
  mandi_id: string;
  price_per_quintal: number;
  arrival_volume_tons: number;
  entered_at: string;
}

function lastMandiKey(fpoId: string): string {
  return `krishibandhu-fpo:lastMandi:${fpoId}`;
}

function toCsv(entries: PriceEntry[]): string {
  const header = ["crop", "mandi", "price_per_quintal", "arrival_volume_tons", "entered_at"];
  const rows = entries.map((e) =>
    [
      getCropById(e.crop_id)?.name ?? e.crop_id,
      getMandiById(e.mandi_id)?.name ?? e.mandi_id,
      e.price_per_quintal,
      e.arrival_volume_tons,
      e.entered_at,
    ].join(",")
  );
  return [header.join(","), ...rows].join("\n");
}

export function FpoPriceEntry() {
  const fpoId = useAppStore((s) => s.currentFpoId);
  const selectedCropId = useAppStore((s) => s.selectedCropId);
  const selectedMandiId = useAppStore((s) => s.selectedMandiId);
  const { t } = useTranslation();

  const [cropId, setCropId] = useState(selectedCropId);
  const [mandiId, setMandiId] = useState(selectedMandiId);
  const [price, setPrice] = useState("");
  const [arrival, setArrival] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [entries, setEntries] = useState<PriceEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    if (!fpoId) return;
    const saved = localStorage.getItem(lastMandiKey(fpoId));
    if (saved && MANDIS.some((m) => m.id === saved)) setMandiId(saved);
  }, [fpoId]);

  useEffect(() => {
    let cancelled = false;
    if (!fpoId) return;
    setHistoryLoading(true);

    fetch(`/api/fpo/price-entries?fpo_id=${encodeURIComponent(fpoId)}&crop_id=${encodeURIComponent(cropId)}&mandi_id=${encodeURIComponent(mandiId)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message ?? t("common.error"));
        return data.entries as PriceEntry[];
      })
      .then((rows) => {
        if (!cancelled) setEntries(rows);
      })
      .catch(() => {
        if (!cancelled) setEntries([]);
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fpoId, cropId, mandiId, t]);

  function handleMandiChange(next: string) {
    setMandiId(next);
    if (fpoId) localStorage.setItem(lastMandiKey(fpoId), next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fpoId) return;
    setError(null);
    setSuccess(false);
    setSubmitting(true);

    const res = await fetch("/api/fpo/price-entry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fpo_id: fpoId,
        crop_id: cropId,
        mandi_id: mandiId,
        price_per_quintal: Number(price),
        arrival_volume_tons: Number(arrival),
      }),
    });
    const result = await res.json();
    setSubmitting(false);

    if (res.ok) {
      setPrice("");
      setArrival("");
      setSuccess(true);
      if (fpoId) localStorage.setItem(lastMandiKey(fpoId), mandiId);
    } else {
      const firstError = result.fields ? Object.values(result.fields).flat()[0] : undefined;
      setError(typeof firstError === "string" ? firstError : result.message ?? t("common.error"));
    }
  }

  function handleExport() {
    const blob = new Blob([toCsv(entries)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fpo-price-entries-${fpoId?.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const numberInputClass = "min-h-touch w-full rounded-card border border-slate-300 px-3 text-base";

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-slate-900">{t("fpoPrice.title")}</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-card border border-slate-300 p-4">
        <label className="flex flex-col gap-1">
          <span className="text-base text-slate-700">{t("fpoPrice.cropLabel")}</span>
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
          <span className="text-base text-slate-700">{t("fpoPrice.mandiLabel")}</span>
          <select
            value={mandiId}
            onChange={(e) => handleMandiChange(e.target.value)}
            className="min-h-touch w-full rounded-card border border-slate-300 bg-white px-2 text-base text-slate-900"
          >
            {MANDIS.map((mandi) => (
              <option key={mandi.id} value={mandi.id}>
                {mandi.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-base text-slate-700">{t("fpoPrice.priceLabel")} (₹/quintal)</span>
          <input
            type="number"
            min={0}
            step="any"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className={numberInputClass}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-base text-slate-700">{t("fpoPrice.arrivalLabel")} (tons)</span>
          <input
            type="number"
            min={0}
            step="any"
            value={arrival}
            onChange={(e) => setArrival(e.target.value)}
            className={numberInputClass}
          />
        </label>

        {error && <span className="text-base text-signal-red">{error}</span>}
        {success && <span className="text-base text-trust-700">{t("fpoPrice.success")}</span>}

        <button
          type="submit"
          disabled={submitting}
          className="min-h-touch rounded-card bg-trust-500 px-4 text-base font-medium text-white disabled:opacity-60"
        >
          {t("fpoPrice.submit")}
        </button>
      </form>

      <div className="rounded-card border border-slate-300 p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">{t("fpoPrice.historyTitle")}</h2>
          <button
            type="button"
            onClick={handleExport}
            disabled={entries.length === 0}
            className="min-h-touch rounded-card border border-slate-300 px-3 text-base disabled:opacity-50"
          >
            {t("fpoPrice.exportCsv")}
          </button>
        </div>

        {historyLoading ? (
          <p className="text-base text-slate-500">{t("common.loading")}</p>
        ) : entries.length === 0 ? (
          <p className="text-base text-slate-500">{t("fpoPrice.noHistory")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-base text-slate-700">
              <thead>
                <tr className="border-b border-slate-300 text-left">
                  <th className="py-2 pr-2 font-medium">{t("fpoPrice.cropLabel")}</th>
                  <th className="py-2 pr-2 font-medium">{t("fpoPrice.mandiLabel")}</th>
                  <th className="py-2 pr-2 font-medium">₹/q</th>
                  <th className="py-2 pr-2 font-medium">{t("fpoPrice.arrivalShort")}</th>
                  <th className="py-2 font-medium">{t("fpoPrice.enteredAt")}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-b border-slate-100">
                    <td className="py-2 pr-2">{getCropById(e.crop_id)?.name ?? e.crop_id}</td>
                    <td className="py-2 pr-2">{getMandiById(e.mandi_id)?.name ?? e.mandi_id}</td>
                    <td className="py-2 pr-2">{e.price_per_quintal}</td>
                    <td className="py-2 pr-2">{e.arrival_volume_tons}</td>
                    <td className="py-2">{new Date(e.entered_at).toLocaleDateString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}