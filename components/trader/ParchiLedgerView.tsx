"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "@/store/useAppStore";
import { TraderIdentity } from "@/components/trader/TraderIdentity";
import type { ParchiRecord } from "@/types";

type DemoState = "valid" | "tampering" | "broken";

export function ParchiLedgerView() {
  const currentTraderId = useAppStore((s) => s.currentTraderId);
  const selectedCropId = useAppStore((s) => s.selectedCropId);
  const selectedMandiId = useAppStore((s) => s.selectedMandiId);

  const [pristineChain, setPristineChain] = useState<ParchiRecord[]>([]);
  const [displayedChain, setDisplayedChain] = useState<ParchiRecord[]>([]);
  const [state, setState] = useState<DemoState>("valid");
  const [tamperedIndex, setTamperedIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  // Real whole-ledger integrity: every farmer/mandi chain this trader has
  // written, verified against the DB via /api/parchi/verify?trader_id=...
  const [integrity, setIntegrity] = useState<{
    total: number;
    validChains: number;
    brokenChains: number;
    allValid: boolean;
  } | null>(null);

  async function loadChain() {
    if (!currentTraderId) return;
    setLoading(true);
    const [listRes, verifyRes] = await Promise.all([
      fetch(`/api/parchi/list?trader_id=${currentTraderId}&crop_id=${selectedCropId}&mandi_id=${selectedMandiId}&limit=5`),
      fetch(`/api/parchi/verify?trader_id=${currentTraderId}`),
    ]);
    const data = await listRes.json();
    const entries = (data.entries ?? []) as ParchiRecord[];
    const ordered = [...entries].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    setPristineChain(ordered);
    setDisplayedChain(ordered);
    setState("valid");
    setTamperedIndex(null);

    try {
      const verify = await verifyRes.json();
      if (verify.mode === "trader") {
        setIntegrity({
          total: (verify.chains as Array<{ entriesChecked: number }>).reduce((n, c) => n + c.entriesChecked, 0),
          validChains: (verify.chains as Array<{ isValid: boolean }>).filter((c) => c.isValid).length,
          brokenChains: (verify.chains as Array<{ isValid: boolean }>).filter((c) => !c.isValid).length,
          allValid: verify.allValid,
        });
      }
    } catch {
      setIntegrity((prev) => prev);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadChain();
    // Switching crop/mandi while mid-demo resets to valid for the newly
    // selected pair's own ledger, rather than carrying over the old break.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTraderId, selectedCropId, selectedMandiId]);

  async function runTamperDemo() {
    if (state === "tampering" || pristineChain.length === 0) return;
    setState("tampering");

    const res = await fetch("/api/parchi/demo-tamper", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chain: pristineChain }),
    });
    const data = await res.json();

    // Brief transitional state so the button visibly disables and can't be
    // double-clicked mid-demo.
    setTimeout(() => {
      setDisplayedChain(data.chain);
      setTamperedIndex(data.tamperedIndex);
      setState("broken");
    }, 400);
  }

  function resetDemo() {
    // Cheap state swap back to the pristine copy — never a re-fetch, so
    // Reset can't itself fail.
    setDisplayedChain(pristineChain);
    setTamperedIndex(null);
    setState("valid");
  }

  if (!currentTraderId) return <TraderIdentity />;

  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-xl font-semibold text-slate-900">Ledger & Trust Demo</h1>

      {loading && <p className="text-base text-slate-500">Loading...</p>}

      {integrity && integrity.total > 0 && (
        <div
          className={`rounded-card border p-3 text-base ${
            integrity.allValid
              ? "border-signal-green bg-signal-green/10 text-signal-green"
              : "border-signal-red bg-signal-red/10 text-signal-red"
          }`}
        >
          {integrity.allValid ? (
            <p>
              ✓ Ledger integrity verified — {integrity.validChains} chain{integrity.validChains === 1 ? "" : "s"},{" "}
              {integrity.total} record{integrity.total === 1 ? "" : "s"}, all hashes match.
            </p>
          ) : (
            <p>⚠ {integrity.brokenChains} chain{integrity.brokenChains === 1 ? "" : "s"} show tampering.</p>
          )}
        </div>
      )}

      {!loading && displayedChain.length === 0 && (
        <p className="text-base text-slate-500">No Parchi records yet for this crop and mandi.</p>
      )}

      <AnimatePresence>
        {state === "broken" && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-card border border-signal-red bg-signal-red/10 p-3 text-base text-signal-red"
          >
            <p className="font-semibold">⚠️ Chain Broken</p>
            <p>
              The deduction was changed after the fact. The chain shows exactly where the record stopped
              matching.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col gap-2">
        {displayedChain.map((entry, i) => {
          const isTamperedFrom = tamperedIndex !== null && i >= tamperedIndex;
          const isTamperedRecord = tamperedIndex === i;
          return (
            <motion.div
              key={entry.id}
              animate={isTamperedRecord ? { backgroundColor: ["#ffffff", "#fbe4e0", "#ffffff"] } : {}}
              transition={{ duration: 0.3 }}
              className={`rounded-card border p-3 text-base ${
                isTamperedFrom ? "border-signal-red bg-signal-red/5" : "border-slate-300 bg-white"
              }`}
            >
              <p>
                {entry.gross_weight}kg @ {entry.deduction_percent}% deduction — ₹{entry.total_amount.toFixed(0)}
              </p>
              {/* Quality Passport badge */}
              {(entry.quality_grade || entry.photo_url) && (
                <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-[#2f6f52]/30 bg-[#2f6f52]/5 px-2 py-1">
                  <span className="text-xs">📸</span>
                  {entry.quality_grade && (
                    <span className="text-xs font-semibold text-[#2f6f52]">
                      Grade {entry.quality_grade}
                    </span>
                  )}
                  {entry.photo_url && (
                    <span className="text-xs text-slate-500">Photo ✓</span>
                  )}
                  {(entry as any).quality_hash && (
                    <span className="ml-auto text-[10px] text-slate-400">
                      QH: {(entry as any).quality_hash.slice(0, 6)}…
                    </span>
                  )}
                </div>
              )}
              <p className="text-slate-500">
                Hash: {entry.current_hash.slice(0, 8)}…{entry.current_hash.slice(-4)}
                {i > 0 && <> — chained from: {displayedChain[i - 1].current_hash.slice(0, 8)}…</>}
              </p>
              {isTamperedFrom && <p className="font-medium text-signal-red">Invalid Hash</p>}
            </motion.div>
          );
        })}
      </div>

      <div className="mt-2 flex gap-2">
        <button
          onClick={runTamperDemo}
          disabled={state === "tampering" || displayedChain.length === 0}
          className="min-h-touch flex-1 rounded-card border border-signal-red px-4 text-base font-medium text-signal-red disabled:opacity-50"
        >
          ⚠️ Simulate Kharaba Fraud (Demo)
        </button>
        <button
          onClick={resetDemo}
          className="min-h-touch rounded-card border border-slate-300 px-4 text-base font-medium text-slate-700"
        >
          Reset Demo
        </button>
      </div>
    </div>
  );
}
