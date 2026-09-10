"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { MANDIS } from "@/constants";
import type { MandiSubmission } from "@/types";

interface SubmissionRow extends MandiSubmission {
  submitted_by_name: string | null;
}

type PlacesCandidate = {
  name: string;
  district: string;
  lat: number;
  lng: number;
  market_type: "apmc" | "private_mandi" | "farmers_market" | "wholesaler";
  contact_number: string | null;
  place_id: string;
};

const MARKET_TYPE_LABELS: Record<SubmissionRow["market_type"], string> = {
  apmc: "APMC",
  private_mandi: "Private mandi",
  farmers_market: "Farmers' market",
  wholesaler: "Wholesaler",
};

/**
 * Mandi Directory — the user-submittable directory (migration 010 Part B).
 * Shows the canonical APMCs plus admin-APPROVED user submissions (never
 * pending ones), lets anyone suggest a missing mandi, and gives admins a
 * review queue. Nominatim (OpenStreetMap) prefills the form (no key needed);
 * without it the form falls back to typed coordinates.
 */
export function MandiDirectory() {
  const currentFarmerId = useAppStore((s) => s.currentFarmerId);
  const currentTraderId = useAppStore((s) => s.currentTraderId);
  const currentFpoId = useAppStore((s) => s.currentFpoId);

  const [approved, setApproved] = useState<SubmissionRow[]>([]);
  const [demoFpoId, setDemoFpoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [directoryError, setDirectoryError] = useState<string | null>(null);

  // Submit form state
  const [name, setName] = useState("");
  const [district, setDistrict] = useState("");
  const [marketType, setMarketType] = useState<SubmissionRow["market_type"]>("farmers_market");
  const [contactNumber, setContactNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [searching, setSearching] = useState(false);
  const [placesResults, setPlacesResults] = useState<PlacesCandidate[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitDone, setSubmitDone] = useState(false);

  // Admin review state
  const [admins, setAdmins] = useState<Array<{ id: string; name: string; phone: string }>>([]);
  const [adminId, setAdminId] = useState<string>("");
  const [pending, setPending] = useState<SubmissionRow[]>([]);
  const [reviewMsg, setReviewMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/mandi-submissions?status=approved")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("bad response"))))
      .then((data: { submissions: SubmissionRow[] }) => {
        if (!cancelled) setApproved(data.submissions);
      })
      .catch(() => {
        if (!cancelled) setDirectoryError("Couldn't load the market directory.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    fetch("/api/fpo/demo-user")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("bad response"))))
      .then((data: { fpo: { id: string } }) => {
        if (!cancelled) setDemoFpoId(data.fpo.id);
      })
      .catch(() => {});

    fetch("/api/users/role?role=admin")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("bad response"))))
      .then((data: { users: Array<{ id: string; name: string; phone: string }> }) => {
        if (!cancelled) {
          setAdmins(data.users);
          setAdminId(data.users[0]?.id ?? "");
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!adminId) return;
    let cancelled = false;
    fetch("/api/mandi-submissions?status=pending")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("bad response"))))
      .then((data: { submissions: SubmissionRow[] }) => {
        if (!cancelled) setPending(data.submissions);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [adminId]);

  const submitterId = String(currentFpoId ?? demoFpoId ?? currentFarmerId ?? currentTraderId ?? "");

  async function searchPlaces() {
    if (name.trim().length < 3) return;
    setSearching(true);
    setPlacesResults([]);
    try {
      const res = await fetch(`/api/places/search?q=${encodeURIComponent(name)}`);
      const data = (await res.json()) as { candidates?: PlacesCandidate[] };
      setPlacesResults(data.candidates ?? []);
    } catch {
      setPlacesResults([]);
    } finally {
      setSearching(false);
    }
  }

  function applyPlaces(c: PlacesCandidate) {
    setName(c.name);
    setDistrict(c.district);
    setMarketType(c.market_type);
    setLat(String(c.lat));
    setLng(String(c.lng));
    setContactNumber(c.contact_number ?? "");
    setPlacesResults([]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    setSubmitDone(false);

    const res = await fetch("/api/mandi-submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        submitted_by: submitterId,
        name,
        district: district || undefined,
        lat: lat === "" ? null : Number(lat),
        lng: lng === "" ? null : Number(lng),
        market_type: marketType,
        contact_number: contactNumber.trim() || null,
        notes: notes.trim() || null,
      }),
    });
    const data = await res.json();
    setSubmitting(false);

    if (res.ok) {
      setSubmitDone(true);
      setName("");
      setDistrict("");
      setMarketType("farmers_market");
      setContactNumber("");
      setNotes("");
      setLat("");
      setLng("");
      setPlacesResults([]);
    } else if (data.fields) {
      setSubmitError(Object.values(data.fields).flat().join(". "));
    } else {
      setSubmitError(data.message ?? "Something went wrong.");
    }
  }

  async function review(id: string, status: "approved" | "rejected") {
    setReviewMsg(null);
    const res = await fetch("/api/mandi-submissions/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, reviewed_by: adminId, status }),
    });
    const data = await res.json();
    if (res.ok) {
      setReviewMsg(`Marked ${status}.`);
      setPending((rows) => rows.filter((r) => r.id !== id));
      if (status === "approved") {
        setApproved((rows) => [...rows.filter((r) => r.id !== id), data.submission]);
      }
    } else {
      setReviewMsg(data.message ?? "Review failed.");
    }
  }

  const canonicalMandis = MANDIS;
  const allMarkets = [
    ...canonicalMandis.map((m) => ({
      key: m.id,
      name: m.name,
      district: m.district,
      market_type: "apmc" as const,
      verified: true,
      lat: m.lat,
      lng: m.lng,
      contact_number: null as string | null,
    })),
    ...approved.map((s) => ({
      key: s.id,
      name: s.name,
      district: s.district,
      market_type: s.market_type,
      verified: false,
      lat: s.lat,
      lng: s.lng,
      contact_number: s.contact_number,
    })),
  ].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl bg-gradient-to-br from-[#0f766e] to-[#115e59] px-5 py-5 text-white shadow-md">
        <p className="text-xs font-medium uppercase tracking-widest text-[#99f6e4] mb-0.5">Markets</p>
        <h1 className="text-xl font-bold">Mandi Directory</h1>
        <p className="mt-1 text-sm text-[#b2dfd2]">
          APMCs, private mandis &amp; farmers&apos; markets — and a way to add the ones that are missing.
        </p>
      </div>

      {/* Directory list */}
      <div className="flex flex-col gap-2">
        <h2 className="text-base font-semibold text-slate-800">
          Directory ({allMarkets.length})
        </h2>
        {loading && <div className="skeleton h-20 w-full rounded-2xl" />}
        {directoryError && <p className="text-sm text-signal-red">{directoryError}</p>}
        <div className="flex flex-col gap-2">
          {allMarkets.map((m) => (
            <div key={m.key} className="rounded-xl border border-[#d3e4dc] bg-white px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-base font-semibold text-slate-800">{m.name}</p>
                  <p className="text-xs text-slate-500">
                    📍 {m.district} · {MARKET_TYPE_LABELS[m.market_type]}
                    {m.contact_number ? ` · ${m.contact_number}` : ""}
                  </p>
                </div>
                <span className={[
                  "shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold",
                  m.verified ? "bg-[#eef4f1] text-[#1c4432]" : "bg-amber-50 text-amber-800",
                ].join(" ")}>
                  {m.verified ? "Verified" : "Community-reported"}
                </span>
              </div>
              <p className="mt-1 text-[10px] text-slate-400">
                {String(m.lat)}, {String(m.lng)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Suggest a mandi */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-2xl border border-[#d3e4dc] bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-slate-800">Suggest a missing mandi</h2>
        <p className="text-xs text-slate-500">
          Submissions are reviewed by an admin before appearing in the directory.
        </p>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-slate-700">Market name</span>
          <div className="flex gap-2">
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="min-h-touch flex-1 rounded-xl border border-slate-300 px-3 text-base"
            />
            <button
              type="button"
              onClick={searchPlaces}
              disabled={searching || name.trim().length < 3}
              className="min-h-touch rounded-xl border border-[#0f766e] bg-[#f0fdfa] px-3 text-sm font-semibold text-[#0f766e] disabled:opacity-50"
            >
              {searching ? "…" : "Search"}
            </button>
          </div>
        </label>

        {placesResults.length > 0 && (
          <div className="flex flex-col gap-1.5 rounded-xl border border-teal-200 bg-teal-50 p-2">
            <p className="text-xs font-semibold text-teal-800">Pick a match to prefill:</p>
            {placesResults.map((c, i) => (
              <button
                key={i}
                type="button"
                onClick={() => applyPlaces(c)}
                className="rounded-lg bg-white px-3 py-2 text-left text-sm text-slate-700 hover:bg-teal-100"
              >
                {c.name} <span className="text-xs text-slate-400">· {c.district}</span>
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-slate-700">District</span>
            <input
              required
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              className="min-h-touch rounded-xl border border-slate-300 px-3 text-base"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-slate-700">Market type</span>
            <select
              value={marketType}
              onChange={(e) => setMarketType(e.target.value as SubmissionRow["market_type"])}
              className="min-h-touch rounded-xl border border-slate-300 px-2 text-base"
            >
              <option value="apmc">APMC</option>
              <option value="private_mandi">Private mandi</option>
              <option value="farmers_market">Farmers&apos; market</option>
              <option value="wholesaler">Wholesaler</option>
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-slate-700">Latitude</span>
            <input
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              type="number"
              step="any"
              className="min-h-touch rounded-xl border border-slate-300 px-3 text-base"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-slate-700">Longitude</span>
            <input
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              type="number"
              step="any"
              className="min-h-touch rounded-xl border border-slate-300 px-3 text-base"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-slate-700">Contact number (optional)</span>
          <input
            value={contactNumber}
            onChange={(e) => setContactNumber(e.target.value)}
            className="min-h-touch rounded-xl border border-slate-300 px-3 text-base"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-slate-700">Notes (optional)</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="min-h-touch rounded-xl border border-slate-300 px-3 py-2 text-base"
          />
        </label>

        {submitError && <p className="text-sm text-signal-red">{submitError}</p>}
        {submitDone && <p className="text-sm text-[#0f766e]">Thanks! Your suggestion is pending admin review.</p>}

        <button
          type="submit"
          disabled={submitting || !submitterId}
          className="min-h-touch rounded-xl bg-[#0f766e] px-4 text-base font-semibold text-white transition hover:bg-[#115e59] disabled:opacity-60"
        >
          {submitting ? "Submitting…" : "Submit for review"}
        </button>
      </form>

      {/* Admin review — visible only when an admin identity is available */}
      {admins.length > 0 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <h2 className="text-base font-semibold text-amber-900">Admin review queue</h2>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-amber-800">Reviewing as</span>
            <select
              value={adminId}
              onChange={(e) => setAdminId(e.target.value)}
              className="min-h-touch rounded-xl border border-amber-300 bg-white px-2 text-base"
            >
              {admins.map((a) => (
                <option key={a.id} value={a.id}>{a.name} ({a.phone})</option>
              ))}
            </select>
          </label>

          {reviewMsg && <p className="text-sm text-amber-900">{reviewMsg}</p>}

          {pending.length === 0 ? (
            <p className="text-sm text-amber-700">No submissions waiting.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {pending.map((s) => (
                <div key={s.id} className="rounded-xl border border-amber-200 bg-white px-4 py-3">
                  <p className="text-base font-semibold text-slate-800">{s.name}</p>
                  <p className="text-xs text-slate-500">
                    📍 {s.district} · {MARKET_TYPE_LABELS[s.market_type]} · by {s.submitted_by_name ?? "unknown"}
                  </p>
                  {s.notes && <p className="mt-1 text-xs italic text-slate-400">&ldquo;{s.notes}&rdquo;</p>}
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => review(s.id, "approved")}
                      className="min-h-touch flex-1 rounded-xl bg-[#0f766e] px-3 text-sm font-semibold text-white"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => review(s.id, "rejected")}
                      className="min-h-touch flex-1 rounded-xl border border-red-300 bg-white px-3 text-sm font-semibold text-red-700"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}