"use client";

import { useState, useRef } from "react";
import { useAppStore } from "@/store/useAppStore";
import { CROPS, MANDIS } from "@/constants";
import { TraderIdentity } from "@/components/trader/TraderIdentity";

const QUALITY_GRADES = [
  { id: "A", label: "Grade A — Premium", color: "text-[#2f6f52]" },
  { id: "B", label: "Grade B — Standard", color: "text-amber-700" },
  { id: "C", label: "Grade C — Below Average", color: "text-orange-700" },
  { id: "D", label: "Grade D — Rejected", color: "text-red-700" },
];

export function ParchiEntryForm() {
  const currentTraderId = useAppStore((s) => s.currentTraderId);
  const [farmerId, setFarmerId] = useState("");
  const [farmerPhone, setFarmerPhone] = useState("");
  const [farmerFound, setFarmerFound] = useState<{ id: string; name: string; village: string | null } | null>(null);
  const [farmerSearching, setFarmerSearching] = useState(false);
  const [farmerError, setFarmerError] = useState<string | null>(null);
  const [cropId, setCropId] = useState(CROPS[0].id);
  const [mandiId, setMandiId] = useState(MANDIS[0].id);
  const [grossWeight, setGrossWeight] = useState("");
  const [deductionPercent, setDeductionPercent] = useState("");
  const [pricePerQuintal, setPricePerQuintal] = useState("");
  const [paymentMode, setPaymentMode] = useState<"cash" | "upi" | "bank_transfer" | "credit">("cash");
  const [paymentReference, setPaymentReference] = useState("");
  const [creditNote, setCreditNote] = useState("");
  // Visual Quality Passport fields
  const [qualityGrade, setQualityGrade] = useState<string>("");
  const [moisturePercent, setMoisturePercent] = useState<string>("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<{ hash: string; qualityHash?: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!currentTraderId) return <TraderIdentity />;

  const selectedCrop = CROPS.find((c) => c.id === cropId) ?? CROPS[0];
  const priceUnit = selectedCrop.unit && selectedCrop.unit !== "quintal" ? selectedCrop.unit : "kg";

  const gross = Number(grossWeight) || 0;
  const deduction = Number(deductionPercent) || 0;
  const pricePerKg = Number(pricePerQuintal) || 0;
  const netWeight = gross * (1 - deduction / 100);
  const totalAmount = netWeight * pricePerKg;

  function handlePhotoCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function findFarmer() {
    if (!/^[6-9]\d{9}$/.test(farmerPhone)) {
      setFarmerError("Enter a valid 10-digit mobile number.");
      return;
    }
    setFarmerSearching(true);
    setFarmerError(null);
    try {
      const res = await fetch("/api/users/farmer-by-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: farmerPhone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFarmerFound(null);
        setFarmerId("");
        setFarmerError(data.message ?? "Farmer not found.");
        return;
      }
      setFarmerFound(data);
      setFarmerId(data.id);
    } catch {
      setFarmerFound(null);
      setFarmerId("");
      setFarmerError("Could not look up the farmer. Try again.");
    } finally {
      setFarmerSearching(false);
    }
  }

  function clearFarmer() {
    setFarmerFound(null);
    setFarmerId("");
    setFarmerPhone("");
    setFarmerError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setSubmitting(true);

    // Upload photo to Supabase Storage if present
    let photoUrl: string | null = null;
    if (photoFile) {
      try {
        const formData = new FormData();
        formData.append("file", photoFile);
        formData.append("parchi_id", "temp_" + Date.now());
        const uploadRes = await fetch("/api/parchi/upload-photo", {
          method: "POST",
          body: formData,
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          photoUrl = uploadData.url;
        }
      } catch {
        // continue without photo — quality passport is still useful with grade only
      }
    }

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
        price_per_quintal: pricePerKg * 100,
        payment_mode: paymentMode,
        payment_reference:
          paymentMode === "cash" ? null : paymentReference.trim() || null,
        credit_note: paymentMode === "credit" ? creditNote.trim() || null : null,
        // Visual Quality Passport
        photo_url: photoUrl,
        quality_grade: qualityGrade || null,
      }),
    });
    const data = await res.json();
    setSubmitting(false);

    if (res.ok) {
      setResult({
        hash: data.current_hash,
        qualityHash: data.quality_hash ?? undefined,
      });
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
        {result.qualityHash && (
          <div className="mt-2 rounded-lg border border-[#2f6f52] bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#2f6f52]">
              📸 Quality Passport
            </p>
            <p className="mt-1 text-sm text-slate-700">
              Quality Hash: {result.qualityHash.slice(0, 8)}…{result.qualityHash.slice(-4)}
            </p>
            {qualityGrade && (
              <p className="text-sm text-slate-700">
                Grade: {QUALITY_GRADES.find((g) => g.id === qualityGrade)?.label}
              </p>
            )}
            {moisturePercent && (
              <p className="text-sm text-slate-700">
                Moisture: {moisturePercent}%
              </p>
            )}
          </div>
        )}
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
        <span className="text-base text-slate-700">Farmer (by mobile number)</span>
        {farmerFound ? (
          <div className="rounded-card border border-trust-300 bg-trust-50 p-3">
            <p className="text-base font-medium text-trust-700">
              {farmerFound.name}{farmerFound.village ? ` • ${farmerFound.village}` : ""} ✓
            </p>
            <p className="mt-0.5 text-xs text-trust-600">ID: {farmerFound.id}</p>
            <button
              type="button"
              onClick={clearFarmer}
              className="mt-1 text-sm text-signal-red underline"
            >
              Change farmer
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              value={farmerPhone}
              onChange={(e) => {
                setFarmerPhone(e.target.value);
                setFarmerError(null);
              }}
              inputMode="numeric"
              placeholder="10-digit mobile number"
              className="min-h-touch flex-1 rounded-card border border-slate-300 px-3 text-lg"
            />
            <button
              type="button"
              onClick={findFarmer}
              disabled={farmerSearching}
              className="min-h-touch rounded-card border border-trust-500 px-4 text-base font-medium text-trust-700 disabled:opacity-60"
            >
              {farmerSearching ? "…" : "Find"}
            </button>
          </div>
        )}
        {farmerError && <span className="text-base text-signal-red">{farmerError}</span>}
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
        <span className="text-base text-slate-700">Price per {priceUnit} (₹)</span>
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

      {/* ── Visual Quality Passport Section ─────────────────────────── */}
      <div className="rounded-card border-2 border-[#2f6f52] bg-[#2f6f52]/10 p-4">
        <p className="mb-1 text-base font-bold text-[#2f6f52]">📸 Visual Quality Passport</p>
        <p className="mb-3 text-sm text-slate-600">
          Add grade + photo for remote buyers to verify quality.
        </p>

        {/* Photo capture — PROMINENT */}
        <div className="mb-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoCapture}
            className="hidden"
          />
          {photoPreview ? (
            <div className="relative">
              <img
                src={photoPreview}
                alt="Produce photo"
                className="h-40 w-full rounded-lg object-cover"
              />
              <button
                type="button"
                onClick={() => { setPhotoPreview(null); setPhotoFile(null); }}
                className="absolute top-2 right-2 rounded-full bg-red-500 p-2 text-white text-sm shadow-lg"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-3 rounded-xl border-2 border-dashed border-[#2f6f52] bg-white py-6 text-base font-medium text-[#2f6f52] hover:bg-[#2f6f52]/5 transition"
            >
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Tap to Take Photo of Produce
            </button>
          )}
        </div>

        {/* Grade selection */}
        <div className="mb-3 grid grid-cols-4 gap-1.5">
          {QUALITY_GRADES.map((grade) => {
            const active = qualityGrade === grade.id;
            return (
              <button
                key={grade.id}
                type="button"
                onClick={() => setQualityGrade(active ? "" : grade.id)}
                className={[
                  "rounded-lg border px-1 py-2 text-xs font-medium transition-all",
                  active
                    ? "border-[#2f6f52] bg-[#2f6f52] text-white shadow-md"
                    : "border-slate-200 bg-white text-slate-600 hover:border-[#2f6f52]",
                ].join(" ")}
              >
                {grade.id}
              </button>
            );
          })}
        </div>

        {/* Moisture input */}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-600">Moisture Reading (%)</span>
          <input
            type="number"
            min={0}
            max={100}
            step="0.1"
            value={moisturePercent}
            onChange={(e) => setMoisturePercent(e.target.value)}
            placeholder="e.g. 12.5"
            className="min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 text-sm"
          />
        </label>
      </div>

      {/* Payment mode */}
      <fieldset className="flex flex-col gap-1">
        <span className="text-base text-slate-700">Payment mode</span>
        <div className="grid grid-cols-4 gap-1.5">
          {(["cash", "upi", "bank_transfer", "credit"] as const).map((mode) => (
            <button
              type="button"
              key={mode}
              onClick={() => setPaymentMode(mode)}
              className={[
                "min-h-touch rounded-card border px-1 text-sm font-medium transition",
                paymentMode === mode
                  ? "border-trust-500 bg-trust-500 text-white"
                  : "border-slate-300 bg-white text-slate-700",
              ].join(" ")}
            >
              {mode === "bank_transfer" ? "Bank" : mode === "cash" ? "Cash" : mode === "upi" ? "UPI" : "Credit"}
            </button>
          ))}
        </div>
        {fieldErrors.payment_mode && <span className="text-base text-signal-red">{fieldErrors.payment_mode[0]}</span>}
      </fieldset>

      {paymentMode === "upi" && (
        <label className="flex flex-col gap-1">
          <span className="text-base text-slate-700">UPI transaction ID</span>
          <input
            value={paymentReference}
            onChange={(e) => setPaymentReference(e.target.value)}
            placeholder="e.g. 4130 2215 9021 8832"
            className="min-h-touch rounded-card border border-slate-300 px-3 text-lg"
          />
          {fieldErrors.payment_reference && <span className="text-base text-signal-red">{fieldErrors.payment_reference[0]}</span>}
        </label>
      )}

      {paymentMode === "bank_transfer" && (
        <label className="flex flex-col gap-1">
          <span className="text-base text-slate-700">Bank / NEFT reference</span>
          <input
            value={paymentReference}
            onChange={(e) => setPaymentReference(e.target.value)}
            placeholder="e.g. NEFT/UTR reference"
            className="min-h-touch rounded-card border border-slate-300 px-3 text-lg"
          />
          {fieldErrors.payment_reference && <span className="text-base text-signal-red">{fieldErrors.payment_reference[0]}</span>}
        </label>
      )}

      {paymentMode === "credit" && (
        <label className="flex flex-col gap-1">
          <span className="text-base text-slate-700">Credit note (what this sale offsets)</span>
          <textarea
            value={creditNote}
            onChange={(e) => setCreditNote(e.target.value)}
            placeholder="e.g. set against the existing hand loan from July"
            className="min-h-touch rounded-card border border-slate-300 px-3 py-2 text-lg"
            rows={2}
          />
          {fieldErrors.credit_note && <span className="text-base text-signal-red">{fieldErrors.credit_note[0]}</span>}
        </label>
      )}

      <div className="rounded-card bg-slate-100 p-3 text-base text-slate-700">
        <p>Net weight: {netWeight.toFixed(1)}kg</p>
        <p className="text-lg font-semibold text-slate-900">Total: ₹{totalAmount.toFixed(0)}</p>
      </div>

      <button
        type="submit"
        disabled={submitting || !farmerFound}
        className="min-h-touch rounded-card bg-trust-500 px-4 text-lg font-medium text-white disabled:opacity-60"
      >
        Submit
      </button>
    </form>
  );
}
