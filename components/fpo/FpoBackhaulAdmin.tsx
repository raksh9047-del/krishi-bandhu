"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { MANDIS, getMandiById } from "@/constants";
import type { BackhaulTruck } from "@/types";

/**
 * FPO backhaul admin (Phase 8, Part 8) — add / edit / delete the return-truck
 * entries the farmer app's BackhaulFarmerView reads. Same validation the
 * schema enforces (`available_capacity_kg >= 0`). All writes go through the
 * admin-client API routes, never the anon client.
 */

function isoToLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}T${pad(local.getHours())}:${pad(local.getMinutes())}`;
}

function localInputToIso(local: string): string {
  return new Date(local).toISOString();
}

const inputClass = "min-h-touch w-full rounded-card border border-slate-300 px-3 text-base";

interface TruckForm {
  truck_number: string;
  from_mandi_id: string;
  to_village: string;
  departure_time: string;
  available_capacity_kg: string;
  contact_number: string;
}

const EMPTY_FORM: TruckForm = {
  truck_number: "",
  from_mandi_id: MANDIS[0].id,
  to_village: "",
  departure_time: "",
  available_capacity_kg: "",
  contact_number: "",
};

export function FpoBackhaulAdmin() {
  const { t } = useTranslation();

  const [trucks, setTrucks] = useState<BackhaulTruck[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TruckForm>(EMPTY_FORM);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/fpo/backhaul")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message ?? t("common.error"));
        return data.trucks as BackhaulTruck[];
      })
      .then((rows) => setTrucks(rows))
      .catch(() => setTrucks([]))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  function startEdit(truck: BackhaulTruck) {
    setEditingId(truck.id);
    setError(null);
    setForm({
      truck_number: truck.truck_number,
      from_mandi_id: truck.from_mandi_id,
      to_village: truck.to_village,
      departure_time: isoToLocalInputValue(truck.departure_time),
      available_capacity_kg: String(truck.available_capacity_kg),
      contact_number: truck.contact_number,
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      id: editingId,
      truck_number: form.truck_number,
      from_mandi_id: form.from_mandi_id,
      to_village: form.to_village,
      departure_time: localInputToIso(form.departure_time),
      available_capacity_kg: Number(form.available_capacity_kg),
      contact_number: form.contact_number,
    };

    const res = await fetch("/api/fpo/backhaul", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await res.json();
    setSaving(false);

    if (res.ok) {
      resetForm();
      load();
    } else {
      const firstError = result.fields ? Object.values(result.fields).flat()[0] : undefined;
      setError(typeof firstError === "string" ? firstError : result.message ?? t("common.error"));
    }
  }

  async function handleDelete(truck: BackhaulTruck) {
    if (!window.confirm(t("fpoBackhaul.deleteConfirm"))) return;
    const res = await fetch(`/api/fpo/backhaul/${truck.id}`, { method: "DELETE" });
    if (!res.ok) {
      const result = await res.json().catch(() => ({}));
      setError(result.message ?? t("common.error"));
      return;
    }
    if (editingId === truck.id) resetForm();
    load();
  }

  function setField<K extends keyof TruckForm>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-slate-900">{t("fpoBackhaul.title")}</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-card border border-slate-300 p-4">
        <label className="flex flex-col gap-1">
          <span className="text-base text-slate-700">{t("fpoBackhaul.truckNumberLabel")}</span>
          <input
            type="text"
            required
            value={form.truck_number}
            onChange={(e) => setField("truck_number", e.target.value)}
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-base text-slate-700">{t("fpoBackhaul.fromMandiLabel")}</span>
          <select
            value={form.from_mandi_id}
            onChange={(e) => setField("from_mandi_id", e.target.value)}
            className="min-h-touch w-full rounded-card border border-slate-300 bg-white px-2 text-base text-slate-900"
          >
            {MANDIS.map((mandi) => (
              <option key={mandi.id} value={mandi.id}>
                {mandi.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-base text-slate-700">{t("fpoBackhaul.toVillageLabel")}</span>
          <input
            type="text"
            required
            value={form.to_village}
            onChange={(e) => setField("to_village", e.target.value)}
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-base text-slate-700">{t("fpoBackhaul.departureLabel")}</span>
          <input
            type="datetime-local"
            required
            value={form.departure_time}
            onChange={(e) => setField("departure_time", e.target.value)}
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-base text-slate-700">{t("fpoBackhaul.capacityLabel")}</span>
          <input
            type="number"
            min={0}
            step="any"
            required
            value={form.available_capacity_kg}
            onChange={(e) => setField("available_capacity_kg", e.target.value)}
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-base text-slate-700">{t("fpoBackhaul.contactLabel")}</span>
          <input
            type="text"
            required
            value={form.contact_number}
            onChange={(e) => setField("contact_number", e.target.value)}
            className={inputClass}
          />
        </label>

        {error && <span className="text-base text-signal-red">{error}</span>}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="min-h-touch flex-1 rounded-card bg-trust-500 px-4 text-base font-medium text-white disabled:opacity-60"
          >
            {editingId ? t("fpoBackhaul.saveSubmit") : t("fpoBackhaul.addSubmit")}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="min-h-touch rounded-card border border-slate-300 px-4 text-base text-slate-700"
            >
              {t("fpoBackhaul.cancel")}
            </button>
          )}
        </div>
      </form>

      <div className="rounded-card border border-slate-300 p-4">
        <h2 className="text-lg font-semibold text-slate-900">{t("fpoBackhaul.title")}</h2>

        {loading ? (
          <p className="mt-2 text-base text-slate-500">{t("common.loading")}</p>
        ) : trucks.length === 0 ? (
          <p className="mt-2 text-base text-slate-500">{t("fpoBackhaul.emptyState")}</p>
        ) : (
          <div className="mt-2 flex flex-col gap-2">
            {trucks.map((truck) => (
              <div key={truck.id} className="rounded-card border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-lg font-medium text-slate-900">
                      {truck.truck_number} → {truck.to_village}
                    </p>
                    <p className="text-base text-slate-600">
                      {t("fpoBackhaul.fromMandiLabel")}: {getMandiById(truck.from_mandi_id)?.name ?? truck.from_mandi_id}
                    </p>
                    <p className="text-base text-slate-600">
                      {t("fpoBackhaul.departureShort")}: {new Date(truck.departure_time).toLocaleString()}
                    </p>
                    <p className="text-base text-slate-600">
                      {t("fpoBackhaul.capacityLabel")}: {truck.available_capacity_kg}kg · {truck.contact_number}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(truck)}
                      className="min-h-touch rounded-card border border-official-300 px-3 text-base text-official-700"
                    >
                      {t("fpoBackhaul.edit")}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(truck)}
                      className="min-h-touch rounded-card border border-slate-300 px-3 text-base text-signal-red"
                    >
                      {t("fpoBackhaul.delete")}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}