"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { CROPS, MANDIS } from "@/constants";
import type { EpoPriceEntry } from "@/types";

interface EntryRow extends EpoPriceEntry {
  observer_name: string | null;
}

/**
 * EPO (Electronic Price Observation) entry panel for FPO coordinators.
 * Submits a human-observed price for a crop+mandi; the row is labeled
 * "observed, not live" everywhere it surfaces (semantics in migration 009).
 * Shows the observer's recent submissions below the form.
 */
export function EpoEntryPanel() {
  const currentFpoId = useAppStore((s) => s.currentFpoId);
  const [cropId, setCropId] = useState(CROPS[0].id);
  const [mandiId, setMandiId] = useState(MANDIS[0].id);
  const [price, setPrice] = useState("");
  const [arrivalTons, setArrivalTons] = useState("");
  const [note, setNote] = useState("");
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/epo/entries?limit=10")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("bad response"))))
      .then((data: { entries: EntryRow[] }) => {
        if (!cancelled) setEntries(data.entries);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load recent observations.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentFpoId) return;
    setSubmitting(true);
    setMessage(null);
    setError(null);

    const res = await fetch("/api/epo/entry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        observer_id: currentFpoId,
        crop_id: cropId,
        mandi_id: mandiId,
        price_per_quintal: Number(price),
        arrival_volume_tons: arrivalTons.trim() === "" ? null : Number(arrivalTons),
        note: note.trim() || null,
      }),
    });
    const data = await res.json();
    setSubmitting(false);

    if (res.ok) {
      setMessage(`Observation recorded — ₹${data.entry.price_per_quintal}/q for ${cropId} at ${mandiId}.`);
      setPrice("");
      setArrivalTons("");
      setNote("");
      const refresh = await fetch("/api/epo/entries?limit=10");
      const refreshed = (await refresh.json()) as { entries: EntryRow[] };
      setEntries(refreshed.entries);
    } else if (data.fields) {
      setError(Object.values(data.fields).flat().join(". "));
    } else {
      setError(data.message ?? "Something went wrong.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl bg-gradient-to-br from-[#14532d] to-[#2f6f52] px-5 py-5 text-white shadow-md">
        <p className="text-xs font-medium uppercase tracking-widest text-[#a7d7b5]">FPO Tools</p>
        <h1 className="text-xl font-bold">EPO Price Observation</h1>
        <p className="mt-1 text-sm text-[#a7d7b5]">
          Record a price observed at the mandi. Shown as &quot;observed, not live&quot; to farmers.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-2xl border border-[#d3e4dc] bg-white p-4 shadow-sm">
        <div className="flex gap-2">
          <select value={cropId} onChange={(e) => setCropId(e.target.value)} className="min-h-touch flex-1 rounded-xl border border-slate-300 px-2 text-base">
            {CROPS.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select value={mandiId} onChange={(e) => setMandiId(e.target.value)} className="min-h-touch flex-1 rounded-xl border border-slate-300 px-2 text-base">
            {MANDIS.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-slate-700">Observed price (₹/quintal)</span>
          <input
            required
            type="number"
            min={0}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="min-h-touch rounded-xl border border-slate-300 px-3 text-lg"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-slate-700">Arrival volume (tons, optional)</span>
          <input
            type="number"
            min={0}
            value={arrivalTons}
            onChange={(e) => setArrivalTons(e.target.value)}
            className="min-h-touch rounded-xl border border-slate-300 px-3 text-lg"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-slate-700">Note (optional)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="min-h-touch rounded-xl border border-slate-300 px-3 py-2 text-base"
          />
        </label>

        {error && <p className="text-sm text-signal-red">{error}</p>}
        {message && <p className="text-sm text-[#2f6f52]">{message}</p>}

        <button
          type="submit"
          disabled={submitting || !currentFpoId}
          className="min-h-touch rounded-xl bg-[#2f6f52] px-4 text-base font-semibold text-white transition hover:bg-[#255a42] disabled:opacity-60"
        >
          {submitting ? "Recording…" : "Record observation"}
        </button>
      </form>

      <div className="flex flex-col gap-2">
        <h2 className="text-base font-semibold text-slate-800">Recent observations</h2>
        {loading && <div className="skeleton h-20 w-full rounded-2xl" />}
        {!loading && entries.length === 0 && (
          <p className="text-sm text-slate-500">No observations yet — record the first one above.</p>
        )}
        <div className="flex flex-col gap-2">
          {entries.map((entry) => (
            <div key={entry.id} className="rounded-xl border border-[#d3e4dc] bg-white px-4 py-3">
              <div className="flex items-baseline justify-between">
                <p className="text-base font-semibold text-slate-800">
                  ₹{Number(entry.price_per_quintal).toLocaleString("en-IN")}
                  <span className="text-xs font-normal text-slate-500"> / quintal</span>
                </p>
                <p className="text-xs text-slate-400">
                  {new Date(entry.observed_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </p>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                {entry.crop_id} @ {entry.mandi_id}
                {entry.arrival_volume_tons !== null && entry.arrival_volume_tons !== undefined
                  ? ` · ${Number(entry.arrival_volume_tons).toLocaleString("en-IN")}t arrival`
                  : ""}
              </p>
              {entry.note && <p className="mt-1 text-xs italic text-slate-400">&ldquo;{entry.note}&rdquo;</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}