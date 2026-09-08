"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { TraderIdentity } from "@/components/trader/TraderIdentity";
import type { Dispute } from "@/types";

function useCountdown(target: string | null) {
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    if (!target) return;
    const targetMs = new Date(target).getTime();

    function tick() {
      const diff = targetMs - Date.now();
      if (diff <= 0) {
        setRemaining("Escalation window closed");
        return;
      }
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      setRemaining(`${hours}h ${minutes}m remaining before further escalation`);
    }

    tick();
    const interval = setInterval(tick, 60000);
    return () => clearInterval(interval);
  }, [target]);

  return remaining;
}

export function DisputeEscalation() {
  const currentTraderId = useAppStore((s) => s.currentTraderId);
  const [parchiId, setParchiId] = useState("");
  const [reason, setReason] = useState("");
  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const deadline = dispute?.escalation_timer_started_at
    ? new Date(new Date(dispute.escalation_timer_started_at).getTime() + 48 * 3600000).toISOString()
    : null;
  const countdown = useCountdown(deadline);

  if (!currentTraderId) return <TraderIdentity />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await fetch("/api/disputes/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parchi_id: parchiId, raised_by: currentTraderId, reason }),
    });
    const data = await res.json();
    setSubmitting(false);

    if (res.ok) {
      setDispute(data);
    } else if (data.fields?.reason) {
      setError(data.fields.reason[0]);
    } else {
      setError(data.message ?? "Something went wrong.");
    }
  }

  if (dispute) {
    return (
      <div className="rounded-card border border-signal-yellow bg-signal-yellow/10 p-4">
        <p className="text-lg font-medium text-slate-900">Dispute raised ✓</p>
        <p className="mt-2 text-base text-slate-700">✓ Escalated to APMC Secretary</p>
        <p className="text-base text-slate-700">✓ Escalated to Kisan Call Centre</p>
        <p className="mt-2 text-base font-medium text-signal-yellow">{countdown}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <h1 className="text-xl font-semibold text-slate-900">Raise a Dispute</h1>

      <label className="flex flex-col gap-1">
        <span className="text-base text-slate-700">Parchi ID</span>
        <input
          required
          value={parchiId}
          onChange={(e) => setParchiId(e.target.value)}
          className="min-h-touch rounded-card border border-slate-300 px-3 text-lg"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-base text-slate-700">Reason</span>
        <textarea
          required
          minLength={10}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          className="rounded-card border border-slate-300 px-3 py-2 text-lg"
        />
      </label>

      {error && <p className="text-base text-signal-red">{error}</p>}

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
