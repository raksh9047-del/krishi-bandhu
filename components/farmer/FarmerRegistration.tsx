"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { StatusBadge } from "@/components/StatusBadge";
import { useAppStore } from "@/store/useAppStore";
import { useSession } from "@/components/auth/SessionProvider";
import Link from "next/link";

const PHONE_PATTERN = /^[6-9]\d{9}$/;
const UPI_VPA_PATTERN = /^[\w.-]+@[\w]+$/;

/**
 * Sign-up flow (replaces the pilot's "register and skip auth" stand-in):
 *   1. Enter name, phone, UPI VPA → POST /api/auth/signup creates both the
 *      Supabase Auth user and the matching `users` row.
 *   2. Redirect to /login to receive the OTP and complete sign-in.
 *
 * Demo farmer buttons are kept so the pilot's seeded data (P1 Farmer, etc.)
 * is still reachable without a fresh sign-up — they bypass this form and
 * land on the login page, where the seeded phone is pre-filled.
 */
export function FarmerRegistration() {
  const { t } = useTranslation();
  const { login } = useSession();
  const setCurrentFarmerId = useAppStore((s) => s.setCurrentFarmerId);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [village, setVillage] = useState("");
  const [upiVpa, setUpiVpa] = useState("");
  const [errors, setErrors] = useState<{ phone?: string; upiVpa?: string; form?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function validate(): boolean {
    const next: typeof errors = {};
    if (!PHONE_PATTERN.test(phone)) next.phone = t("registration.phoneError");
    if (upiVpa.trim().length > 0 && !UPI_VPA_PATTERN.test(upiVpa)) next.upiVpa = t("registration.upiError");
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setErrors({});
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "farmer",
          name,
          phone,
          village: village.trim().length > 0 ? village : null,
          upi_vpa: upiVpa.trim().length > 0 ? upiVpa : null,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        if (result.fields) {
          setErrors({ phone: result.fields.phone?.[0], upiVpa: result.fields.upi_vpa?.[0] });
        } else {
          setErrors({ form: result.message ?? t("common.error") });
        }
        return;
      }
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-card border border-trust-300 bg-trust-50 p-4 text-base text-trust-700">
          {t("registration.registerButton")} ✓ — {t("auth.otpSent")}
        </div>
        <Link
          href="/login"
          className="min-h-touch rounded-card bg-trust-500 px-4 text-lg font-medium text-white text-center"
        >
          {t("auth.verify")}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-slate-900">{t("registration.title")}</h1>

      <p className="text-base text-slate-600">{t("registration.demoIntro")}</p>
      <div className="flex flex-col gap-2">
        <Link
          href="/login"
          className="min-h-touch rounded-card border border-trust-500 px-4 text-base font-medium text-trust-700 text-center"
        >
          ▶ {t("registration.demoFarmer1")}
        </Link>
        <Link
          href="/login"
          className="min-h-touch rounded-card border border-trust-500 px-4 text-base font-medium text-trust-700 text-center"
        >
          ▶ {t("registration.demoFarmer2")}
        </Link>
      </div>

      <p className="text-base text-slate-600">{t("registration.orCreateNew")}</p>

      {errors.form && <span className="text-base text-signal-red">{errors.form}</span>}

      <label className="flex flex-col gap-1">
        <span className="text-base text-slate-700">{t("registration.nameLabel")}</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="min-h-touch rounded-card border border-slate-300 px-3 text-lg"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-base text-slate-700">{t("registration.phoneLabel")}</span>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="numeric"
          required
          className="min-h-touch rounded-card border border-slate-300 px-3 text-lg"
        />
        {errors.phone && <span className="text-base text-signal-red">{errors.phone}</span>}
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-base text-slate-700">{t("registration.villageLabel")}</span>
        <input
          value={village}
          onChange={(e) => setVillage(e.target.value)}
          className="min-h-touch rounded-card border border-slate-300 px-3 text-lg"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-base text-slate-700">{t("registration.upiVpaLabel")}</span>
        <input
          value={upiVpa}
          onChange={(e) => setUpiVpa(e.target.value)}
          className="min-h-touch rounded-card border border-slate-300 px-3 text-lg"
        />
        {errors.upiVpa && <span className="text-base text-signal-red">{errors.upiVpa}</span>}
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="min-h-touch rounded-card bg-trust-500 px-4 text-lg font-medium text-white disabled:opacity-60"
      >
        {t("registration.registerButton")}
      </button>

      <p className="text-base text-slate-600 text-center">
        <a href="/login" className="text-trust-600 underline">
          {t("auth.newHere")} → {t("auth.title")}
        </a>
      </p>

      <StatusBadge
        status="comingSoon"
        label={t("registration.agristackButton")}
        tooltip={t("registration.agristackTooltip")}
      />
    </form>
  );
}