"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { StatusBadge } from "@/components/StatusBadge";
import { useAppStore } from "@/store/useAppStore";

const PHONE_PATTERN = /^[6-9]\d{9}$/;
const UPI_VPA_PATTERN = /^[\w.-]+@[\w]+$/;

export function FarmerRegistration() {
  const { t } = useTranslation();
  const setCurrentFarmerId = useAppStore((s) => s.setCurrentFarmerId);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [village, setVillage] = useState("");
  const [upiVpa, setUpiVpa] = useState("");
  const [errors, setErrors] = useState<{ phone?: string; upiVpa?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function validate(): boolean {
    const next: typeof errors = {};
    if (!PHONE_PATTERN.test(phone)) next.phone = t("registration.phoneError");
    // UPI VPA is optional at registration — only validate the shape if the
    // farmer actually typed something.
    if (upiVpa.trim().length > 0 && !UPI_VPA_PATTERN.test(upiVpa)) next.upiVpa = t("registration.upiError");
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    const res = await fetch("/api/users/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: "farmer",
        name,
        phone,
        upi_vpa: upiVpa.trim().length > 0 ? upiVpa : null,
      }),
    });
    const result = await res.json();
    setSubmitting(false);

    if (res.ok) {
      setCurrentFarmerId(result.id);
      setSubmitted(true);
    } else if (result.fields) {
      setErrors({ phone: result.fields.phone?.[0], upiVpa: result.fields.upi_vpa?.[0] });
    } else {
      setErrors({ phone: result.message ?? t("common.error") });
    }
  }

  if (submitted) {
    return (
      <div className="rounded-card border border-trust-300 bg-trust-50 p-4 text-base text-trust-700">
        {t("registration.title")} ✓
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-slate-900">{t("registration.title")}</h1>

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
          required
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

      <StatusBadge
        status="comingSoon"
        label={t("registration.agristackButton")}
        tooltip={t("registration.agristackTooltip")}
      />
    </form>
  );
}
