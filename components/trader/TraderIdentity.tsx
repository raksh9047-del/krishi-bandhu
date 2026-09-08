"use client";

import { useState } from "react";
import { useAppStore } from "@/store/useAppStore";

const PHONE_PATTERN = /^[6-9]\d{9}$/;

/**
 * Same pilot-scale stand-in as the farmer app's registration — a real build
 * replaces both with actual Supabase Auth sessions. Shown inline wherever a
 * trader screen needs `currentTraderId` and it isn't set yet.
 */
export function TraderIdentity() {
  const setCurrentTraderId = useAppStore((s) => s.setCurrentTraderId);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!PHONE_PATTERN.test(phone)) {
      setError("Enter a valid 10-digit mobile number.");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/users/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "trader", name, phone }),
    });
    const result = await res.json();
    setSubmitting(false);
    if (res.ok) {
      setCurrentTraderId(result.id);
    } else {
      setError(result.message ?? "Something went wrong.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-card border border-slate-300 p-3">
      <p className="text-base text-slate-700">Set up as a trader to continue.</p>
      <input
        required
        placeholder="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="min-h-touch rounded-card border border-slate-300 px-3 text-base"
      />
      <input
        required
        placeholder="Phone Number"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        inputMode="numeric"
        className="min-h-touch rounded-card border border-slate-300 px-3 text-base"
      />
      {error && <span className="text-base text-signal-red">{error}</span>}
      <button
        type="submit"
        disabled={submitting}
        className="min-h-touch rounded-card bg-trust-500 px-4 text-base font-medium text-white disabled:opacity-60"
      >
        Continue
      </button>
    </form>
  );
}
