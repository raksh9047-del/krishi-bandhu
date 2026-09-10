"use client";

import { useState } from "react";
import Link from "next/link";
import { useAppStore } from "@/store/useAppStore";
import { getCropById, getMandiById } from "@/constants";
import { formatPerKg } from "@/lib/price-unit";
import { StatusBadge } from "@/components/StatusBadge";
import { TraderIdentity } from "@/components/trader/TraderIdentity";

/**
 * Mock lot data, shaped exactly like the real schema (crop_id/mandi_id,
 * numeric price/quantity) so swapping in a live "lots" table later is a
 * one-line data-source change, not a component rewrite.
 */
interface MockLot {
  id: string;
  farmer_id: string | null;
  farmer_name: string;
  crop_id: string;
  mandi_id: string;
  quantity_quintals: number;
  listed_price_per_quintal: number;
}

const MOCK_LOTS: MockLot[] = [
  { id: "lot-1", farmer_id: null, farmer_name: "Ramesh Patil", crop_id: "onion", mandi_id: "lasalgaon", quantity_quintals: 40, listed_price_per_quintal: 1800 },
  { id: "lot-2", farmer_id: null, farmer_name: "Suresh Jadhav", crop_id: "tomato", mandi_id: "vashi", quantity_quintals: 25, listed_price_per_quintal: 1200 },
  { id: "lot-3", farmer_id: null, farmer_name: "Vitthal More", crop_id: "cotton", mandi_id: "pune-gultekdi", quantity_quintals: 15, listed_price_per_quintal: 7200 },
];

const TRADER_LINKS = [
  { href: "/trader/parchi-entry", label: "Record a Parchi" },
  { href: "/trader/ledger", label: "Ledger & Trust Demo" },
  { href: "/trader/quality", label: "Quality Assessment" },
  { href: "/trader/disputes", label: "Disputes" },
  { href: "/trader/payment", label: "UPI Payment" },
];

export function TraderDashboard() {
  const currentTraderId = useAppStore((s) => s.currentTraderId);
  const selectedCropId = useAppStore((s) => s.selectedCropId);
  const selectedMandiId = useAppStore((s) => s.selectedMandiId);
  const [bidAmounts, setBidAmounts] = useState<Record<string, string>>({});
  const [bidResult, setBidResult] = useState<Record<string, "sent" | "below_ask" | null>>({});

  if (!currentTraderId) {
    return <TraderIdentity />;
  }

  const lots = MOCK_LOTS.filter((l) => l.crop_id === selectedCropId || l.mandi_id === selectedMandiId);

  async function placeBid(lot: MockLot) {
    const amount = Number(bidAmounts[lot.id]);
    if (!amount || amount <= 0) return;

    const res = await fetch("/api/bids/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trader_id: currentTraderId,
        farmer_id: lot.farmer_id,
        crop_id: lot.crop_id,
        mandi_id: lot.mandi_id,
        listed_price: lot.listed_price_per_quintal,
        bid_amount: amount * 100,
      }),
    });
    const result = await res.json();
    setBidResult((prev) => ({ ...prev, [lot.id]: result.belowAsk ? "below_ask" : "sent" }));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Trader Dashboard</h1>
        <StatusBadge status="live" label="Verified Trader" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        {TRADER_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="min-h-touch rounded-card border border-slate-300 px-3 py-2 text-center text-base font-medium text-trust-700"
          >
            {link.label}
          </Link>
        ))}
      </div>

      <h2 className="text-lg font-semibold text-slate-900">Lots near your context</h2>
      <div className="flex flex-col gap-2">
        {lots.map((lot) => {
          const crop = getCropById(lot.crop_id);
          const mandi = getMandiById(lot.mandi_id);
          return (
            <div key={lot.id} className="rounded-card border border-slate-300 p-3">
              <p className="text-lg font-medium text-slate-900">
                {crop?.name} · {lot.quantity_quintals}q — {lot.farmer_name}
              </p>
              <p className="text-base text-slate-600">
                {mandi?.name} — Asking ₹{formatPerKg(lot.listed_price_per_quintal)}/kg
              </p>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  placeholder="Your bid (₹/kg)"
                  value={bidAmounts[lot.id] ?? ""}
                  onChange={(e) => setBidAmounts((prev) => ({ ...prev, [lot.id]: e.target.value }))}
                  className="min-h-touch flex-1 rounded-card border border-slate-300 px-3 text-base"
                />
                <button
                  onClick={() => placeBid(lot)}
                  className="min-h-touch rounded-card bg-trust-500 px-4 text-base font-medium text-white"
                >
                  Bid
                </button>
              </div>
              {bidResult[lot.id] === "sent" && <p className="mt-1 text-base text-trust-700">Bid placed.</p>}
              {bidResult[lot.id] === "below_ask" && (
                <p className="mt-1 text-base text-signal-yellow">Bid placed — below the farmer&apos;s asking price.</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
