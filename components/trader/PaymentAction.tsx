"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { StatusBadge } from "@/components/StatusBadge";

export function PaymentAction() {
  const [parchiId, setParchiId] = useState("");
  const [upiUri, setUpiUri] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function generateLink() {
    setError(null);
    setLoading(true);
    const res = await fetch("/api/upi/generate-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parchi_id: parchiId }),
    });
    const data = await res.json();
    setLoading(false);

    if (res.ok) {
      setUpiUri(data.upi_uri);
      setAmount(data.amount);
    } else {
      setError(data.message ?? "Something went wrong.");
      setUpiUri(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-xl font-semibold text-slate-900">UPI Payment</h1>

      <label className="flex flex-col gap-1">
        <span className="text-base text-slate-700">Parchi ID</span>
        <input
          value={parchiId}
          onChange={(e) => setParchiId(e.target.value)}
          className="min-h-touch rounded-card border border-slate-300 px-3 text-lg"
        />
      </label>

      <button
        onClick={generateLink}
        disabled={loading || !parchiId}
        className="min-h-touch rounded-card bg-trust-500 px-4 text-lg font-medium text-white disabled:opacity-60"
      >
        {loading ? "..." : "Generate Payment"}
      </button>

      {error && <p className="text-base text-signal-red">{error}</p>}

      {upiUri && (
        <div className="flex flex-col items-center gap-3 rounded-card border border-slate-300 p-4">
          <p className="text-lg font-medium text-slate-900">₹{amount?.toFixed(0)}</p>
          {/* Native app selector on mobile via the deep link. */}
          <a
            href={upiUri}
            className="min-h-touch w-full rounded-card bg-trust-500 px-4 py-3 text-center text-lg font-medium text-white"
          >
            Pay via UPI
          </a>
          {/* QR fallback — desktop can't open a upi:// deep link directly. */}
          <QRCodeSVG value={upiUri} size={180} />
        </div>
      )}

      <StatusBadge
        status="comingSoon"
        label="Enable UPI Autopay"
        tooltip="Requires a licensed PSP/bank sandbox partnership. Manual pay is fully functional now."
      />
    </div>
  );
}
