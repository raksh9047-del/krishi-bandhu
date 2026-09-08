"use client";

import { useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { CROPS, MANDIS } from "@/constants";
import { TraderIdentity } from "@/components/trader/TraderIdentity";

export function ParchiEntryForm() {
  const currentTraderId = useAppStore((s) => s.currentTraderId);
  const [farmerId, setFarmerId] = useState("");
  const [cropId, setCropId] = useState(CROPS[0].id);
  const [mandiId, setMandiId] = useState(MANDIS[0].id);
  const [grossWeight, setGrossWeight] = useState("");
  const [deductionPercent, setDeductionPercent] = useState("");
  const [pricePerQuintal, setPricePerQuintal] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<{ hash: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!currentTraderId) return <TraderIdentity />;

  const gross = Number(grossWeight) || 0;
  const deduction = Number(deductionPercent) || 0;
  const price = Number(pricePerQuintal) || 0;
  const netWeight = gross * (1 - deduction / 100);
  const totalAmount = (netWeight / 100) * price;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setSubmitting(true);

    const res = await fetch("/api/parchi/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        farmer_id: farmerId,
        trader_id: currentTraderId,
        crop_id: cropId,
        mandi_id: mandiId,
        gross_weight: gross,
        deduction_percent: deduction,
        price_per_quintal: price,
      }),
    });
    const data = await res.json();
    setSubmitting(false);

    if (res.ok) {
      setResult({ hash: data.current_hash });
    } else if (data.fields) {
      setFieldErrors(data.fields);
    } else {
      setFieldErrors({ _general: [data.message ?? "Something went wrong."] });
    }
  }

  if (result) {
    return (
      <div className="rounded-card border border-trust-300 bg-trust-50 p-4">
        <p className="text-lg font-medium text-trust-700">Parchi recorded ✓</p>
        <p className="mt-1 text-base text-trust-700">
          Hash: {result.hash.slice(0, 8)}…{result.hash.slice(-4)}
        </p>
        <button onClick={() => setResult(null)} className="mt-3 text-base text-trust-600 underline">
          Record another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <h1 className="text-xl font-semibold text-slate-900">Record a Parchi</h1>

      {fieldErrors._general && <p className="text-base text-signal-red">{fieldErrors._general[0]}</p>}

      <label className="flex flex-col gap-1">
        <span className="text-base text-slate-700">Farmer ID</span>
        <input
          required
          value={farmerId}
          onChange={(e) => setFarmerId(e.target.value)}
          className="min-h-touch rounded-card border border-slate-300 px-3 text-lg"
        />
        {fieldErrors.farmer_id && <span className="text-base text-signal-red">{fieldErrors.farmer_id[0]}</span>}
      </label>

      <div className="flex gap-2">
        <select value={cropId} onChange={(e) => setCropId(e.target.value)} className="min-h-touch flex-1 rounded-card border border-slate-300 px-2 text-lg">
          {CROPS.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select value={mandiId} onChange={(e) => setMandiId(e.target.value)} className="min-h-touch flex-1 rounded-card border border-slate-300 px-2 text-lg">
          {MANDIS.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-base text-slate-700">Gross Weight (kg)</span>
        <input
          required
          type="number"
          min={0}
          value={grossWeight}
          onChange={(e) => setGrossWeight(e.target.value)}
          className="min-h-touch rounded-card border border-slate-300 px-3 text-lg"
        />
        {fieldErrors.gross_weight && <span className="text-base text-signal-red">{fieldErrors.gross_weight[0]}</span>}
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-base text-slate-700">Deduction % (Kharaba)</span>
        <input
          required
          type="number"
          min={0}
          max={100}
          value={deductionPercent}
          onChange={(e) => setDeductionPercent(e.target.value)}
          className="min-h-touch rounded-card border border-slate-300 px-3 text-lg"
        />
        {fieldErrors.deduction_percent && <span className="text-base text-signal-red">{fieldErrors.deduction_percent[0]}</span>}
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-base text-slate-700">Price per Quintal (₹)</span>
        <input
          required
          type="number"
          min={0}
          value={pricePerQuintal}
          onChange={(e) => setPricePerQuintal(e.target.value)}
          className="min-h-touch rounded-card border border-slate-300 px-3 text-lg"
        />
        {fieldErrors.price_per_quintal && <span className="text-base text-signal-red">{fieldErrors.price_per_quintal[0]}</span>}
      </label>

      <div className="rounded-card bg-slate-100 p-3 text-base text-slate-700">
        <p>Net weight: {netWeight.toFixed(1)}kg</p>
        <p className="text-lg font-semibold text-slate-900">Total: ₹{totalAmount.toFixed(0)}</p>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="min-h-touch rounded-card bg-trust-500 px-4 text-lg font-medium text-white disabled:opacity-60"
      >
        Submit
      </button>
    </form>
  );
}
