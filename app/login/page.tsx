"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { useSession } from "@/components/auth/SessionProvider";
import { useAppStore } from "@/store/useAppStore";

const PHONE_PATTERN = /^[6-9]\d{9}$/;

/**
 * Sign in flow:
 *   1. Enter phone → POST /api/auth/login sends OTP via Supabase.
 *   2. Enter OTP → POST /api/auth/verify-otp returns session tokens.
 *   3. useSession stores the JWT; every subsequent fetchWithAuth call
 *      forwards it so server routes can authenticate + enforce RLS.
 */
export default function LoginPage() {
  const { t } = useTranslation();
  const { login } = useSession();
  const setCurrentFarmerId = useAppStore((s) => s.setCurrentFarmerId);
  const setCurrentTraderId = useAppStore((s) => s.setCurrentTraderId);

  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [role, setRole] = useState<"farmer" | "trader">("farmer");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!PHONE_PATTERN.test(phone)) {
      setError(t("registration.phoneError"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const result = await res.json();
      if (!res.ok) {
        setError(result.message ?? t("common.error"));
        return;
      }
      setStep("otp");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (otp.trim().length < 6) {
      setError(t("auth.otpError"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, token: otp, type: "sms" }),
      });
      const result = await res.json();
      if (!res.ok) {
        setError(result.message ?? t("common.error"));
        return;
      }
      login({
        access_token: result.access_token,
        refresh_token: result.refresh_token,
        expires_in: result.expires_in,
        user: result.user,
      });
      // Sync the pilot's identity store so screens that read currentFarmerId
      // continue to work during the migration to a pure session model.
      if (result.user.role === "farmer") setCurrentFarmerId(result.user.id);
      else if (result.user.role === "trader") setCurrentTraderId(result.user.id);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-slate-900">{t("auth.title")}</h1>

      {/* Role toggle — farmer by default, switch to trader at sign-up time. */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setRole("farmer")}
          className={`min-h-touch flex-1 rounded-card border px-4 text-base font-medium ${
            role === "farmer" ? "border-trust-500 bg-trust-50 text-trust-700" : "border-slate-300 text-slate-600"
          }`}
        >
          {t("auth.farmerTab")}
        </button>
        <button
          type="button"
          onClick={() => setRole("trader")}
          className={`min-h-touch flex-1 rounded-card border px-4 text-base font-medium ${
            role === "trader" ? "border-trust-500 bg-trust-50 text-trust-700" : "border-slate-300 text-slate-600"
          }`}
        >
          {t("auth.traderTab")}
        </button>
      </div>

      {step === "phone" ? (
        <form onSubmit={handleSendOtp} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-base text-slate-700">{t("registration.phoneLabel")}</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="numeric"
              placeholder="10-digit mobile number"
              required
              className="min-h-touch rounded-card border border-slate-300 px-3 text-lg"
            />
          </label>
          {error && <span className="text-base text-signal-red">{error}</span>}
          <button
            type="submit"
            disabled={submitting}
            className="min-h-touch rounded-card bg-trust-500 px-4 text-lg font-medium text-white disabled:opacity-60"
          >
            {t("auth.sendOtp")}
          </button>
          <p className="text-base text-slate-600">
            <a href="/register" className="text-trust-600 underline">
              {t("auth.newHere")} → {t("registration.registerButton")}
            </a>
          </p>
        </form>
      ) : (
        <form onSubmit={handleVerifyOtp} className="flex flex-col gap-3">
          <p className="text-base text-slate-600">
            {t("auth.otpSent")} <span className="font-medium text-slate-900">{phone}</span>
          </p>
          <label className="flex flex-col gap-1">
            <span className="text-base text-slate-700">{t("auth.otpLabel")}</span>
            <input
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              inputMode="numeric"
              placeholder="6-digit code"
              required
              className="min-h-touch rounded-card border border-slate-300 px-3 text-lg"
            />
          </label>
          {error && <span className="text-base text-signal-red">{error}</span>}
          <button
            type="submit"
            disabled={submitting}
            className="min-h-touch rounded-card bg-trust-500 px-4 text-lg font-medium text-white disabled:opacity-60"
          >
            {t("auth.verify")}
          </button>
          <button
            type="button"
            onClick={() => setStep("phone")}
            className="min-h-touch rounded-card border border-slate-300 px-4 text-base font-medium text-slate-700"
          >
            {t("auth.back")}
          </button>
        </form>
      )}
    </div>
  );
}