"use client";

import { useState, useRef } from "react";
import { useAppStore } from "@/store/useAppStore";
import { TraderIdentity } from "@/components/trader/TraderIdentity";

/**
 * Grade option lists are keyed by crop_id, not a single shared list — a
 * cotton staple-length grade and an onion size grade are not the same axis.
 * Crops not listed fall back to a generic A/B/C scale.
 */
const GRADE_OPTIONS: Record<string, string[]> = {
  cotton: ["Short Staple", "Medium Staple", "Long Staple", "Extra-Long Staple"],
  onion: ["Small (<40mm)", "Medium (40-60mm)", "Large (60-80mm)", "Extra Large (>80mm)"],
  tomato: ["Small", "Medium", "Large", "Extra Large"],
  potato: ["Small", "Medium", "Large"],
};

function gradeOptionsFor(cropId: string): string[] {
  return GRADE_OPTIONS[cropId] ?? ["Grade A", "Grade B", "Grade C"];
}

export function QualityAssessment() {
  const currentTraderId = useAppStore((s) => s.currentTraderId);
  const selectedCropId = useAppStore((s) => s.selectedCropId);
  const [parchiId, setParchiId] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selfGrade, setSelfGrade] = useState(gradeOptionsFor(selectedCropId)[0]);
  const [assayerGrade, setAssayerGrade] = useState(gradeOptionsFor(selectedCropId)[0]);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!currentTraderId) return <TraderIdentity />;

  const options = gradeOptionsFor(selectedCropId);
  const mismatch = selfGrade !== assayerGrade;

  async function handlePhotoCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    setError(null);
    setUploading(true);

    const form = new FormData();
    form.set("parchi_id", parchiId);
    form.set("quality_grade", selfGrade);
    form.set("assayer_override_grade", assayerGrade);
    if (photoFile) form.set("photo", photoFile);

    const res = await fetch("/api/parchi/update-quality", { method: "POST", body: form });
    const result = await res.json();

    setUploading(false);
    if (!res.ok) {
      setError(result.message ?? "Something went wrong.");
    } else {
      setSaved(true);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-xl font-semibold text-slate-900">Quality Assessment</h1>

      <label className="flex flex-col gap-1">
        <span className="text-base text-slate-700">Parchi ID</span>
        <input
          value={parchiId}
          onChange={(e) => setParchiId(e.target.value)}
          className="min-h-touch rounded-card border border-slate-300 px-3 text-lg"
        />
      </label>

      <div className="rounded-card border-2 border-dashed border-slate-300 bg-white">
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
              className="h-40 w-full rounded-card object-cover"
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
            className="flex w-full items-center justify-center gap-3 rounded-card border-2 border-dashed border-slate-300 bg-white py-6 text-base font-medium text-slate-500 hover:border-[#2f6f52] hover:text-[#2f6f52] transition"
          >
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Tap to Take Photo of Produce
          </button>
        )}
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-base text-slate-700">Self-Declared Grade</span>
        <select
          value={selfGrade}
          onChange={(e) => setSelfGrade(e.target.value)}
          className="min-h-touch rounded-card border border-slate-300 px-2 text-lg"
        >
          {options.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-base text-slate-700">Assayer Override Grade</span>
        <select
          value={assayerGrade}
          onChange={(e) => setAssayerGrade(e.target.value)}
          className="min-h-touch rounded-card border border-slate-300 px-2 text-lg"
        >
          {options.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
      </label>

      {mismatch && (
        <div className="rounded-card border border-signal-yellow bg-signal-yellow/10 p-3 text-base text-signal-yellow">
          <p className="font-medium">These don&apos;t match:</p>
          <p>Self-declared: {selfGrade}</p>
          <p>Assayer: {assayerGrade}</p>
        </div>
      )}

      {error && <p className="text-base text-signal-red">{error}</p>}
      {saved && <p className="text-base text-trust-700">Saved ✓</p>}

      <button
        onClick={handleSave}
        disabled={uploading || !parchiId}
        className="min-h-touch rounded-card bg-trust-500 px-4 text-lg font-medium text-white disabled:opacity-60"
      >
        {uploading ? "Saving..." : "Save"}
      </button>
    </div>
  );
}
