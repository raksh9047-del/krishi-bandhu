"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useAppStore } from "@/store/useAppStore";
import { useTranslation } from "@/lib/i18n";
import { MANDIS, PILOT_MANDI_IDS } from "@/constants";
import { HeatmapExplanation } from "@/components/HeatmapExplanation";

/**
 * Mandi heatmap (Phase 8, Parts 4–5).
 *
 * react-leaflet + OpenStreetMap tiles (no API key). The 3 pilot mandis are
 * colored by their current Sowing Signal state for the selected crop (grey
 * when no signal is configured), the remaining live mandis render as covered
 * (trust green), and ~70 approximate Maharashtra APMC district-center dots
 * render grey/muted as the "not yet covered — Phase 2" stub. Grey dots never
 * imply they carry real data. Re-fetches and recolors when the crop selector
 * changes.
 *
 * This file is client-only on purpose — import it through next/dynamic with
 * ssr:false (see app/map/page.tsx) so leaflet never touches the server.
 */

const SIGNAL_COLORS: Record<string, string> = {
  red: "#b3402f",
  yellow: "#c98a12",
  green: "#2f8f4e",
};
const NO_SIGNAL_COLOR = "#9aa0a6";
const COVERED_MANDI_COLOR = "#2f6f52";
const GREY_DOT_COLOR = "#b9bdc2";

interface MandiHeatEntry {
  mandi_id: string;
  name: string;
  lat: number;
  lng: number;
  signal_status: string | null;
  price: number | null;
  price_source: string | null;
}

// Approximate district-center coordinates for Maharashtra's 36 districts,
// used as bases for the grey "not yet covered" overlay dots.
const DISTRICT_CENTERS: { name: string; lat: number; lng: number }[] = [
  { name: "Mumbai City", lat: 18.97, lng: 72.83 },
  { name: "Mumbai Suburban", lat: 19.08, lng: 72.88 },
  { name: "Thane", lat: 19.19, lng: 72.97 },
  { name: "Palghar", lat: 19.7, lng: 72.77 },
  { name: "Raigad", lat: 18.99, lng: 73.12 },
  { name: "Ratnagiri", lat: 16.99, lng: 73.3 },
  { name: "Sindhudurg", lat: 16.15, lng: 73.7 },
  { name: "Nashik", lat: 19.99, lng: 73.79 },
  { name: "Nandurbar", lat: 21.37, lng: 74.24 },
  { name: "Dhule", lat: 20.9, lng: 74.77 },
  { name: "Jalgaon", lat: 21.0, lng: 75.57 },
  { name: "Ahmednagar", lat: 19.09, lng: 74.74 },
  { name: "Pune", lat: 18.52, lng: 73.86 },
  { name: "Satara", lat: 17.69, lng: 73.99 },
  { name: "Solapur", lat: 17.66, lng: 75.91 },
  { name: "Sangli", lat: 16.85, lng: 74.57 },
  { name: "Kolhapur", lat: 16.7, lng: 74.24 },
  { name: "Aurangabad", lat: 19.88, lng: 75.34 },
  { name: "Jalna", lat: 19.84, lng: 75.89 },
  { name: "Beed", lat: 18.99, lng: 75.76 },
  { name: "Nanded", lat: 19.15, lng: 77.3 },
  { name: "Parbhani", lat: 19.27, lng: 76.77 },
  { name: "Hingoli", lat: 19.72, lng: 77.15 },
  { name: "Latur", lat: 18.4, lng: 76.57 },
  { name: "Osmanabad", lat: 18.17, lng: 76.04 },
  { name: "Amravati", lat: 20.93, lng: 77.75 },
  { name: "Washim", lat: 20.1, lng: 77.13 },
  { name: "Akola", lat: 20.7, lng: 77.0 },
  { name: "Buldhana", lat: 19.83, lng: 76.13 },
  { name: "Nagpur", lat: 21.15, lng: 79.09 },
  { name: "Wardha", lat: 20.74, lng: 78.6 },
  { name: "Chandrapur", lat: 19.95, lng: 79.3 },
  { name: "Gadchiroli", lat: 20.18, lng: 80.01 },
  { name: "Yavatmal", lat: 20.39, lng: 78.13 },
  { name: "Bhandara", lat: 21.17, lng: 79.65 },
  { name: "Gondia", lat: 21.46, lng: 80.19 },
];

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Deterministic (seeded) jitter from the district centers → ~70 grey dots.
const GREY_DOTS: { lat: number; lng: number; district: string }[] = (() => {
  const jrng = mulberry32(77);
  const dots: { lat: number; lng: number; district: string }[] = [];
  for (const d of DISTRICT_CENTERS) {
    for (let i = 0; i < 2; i += 1) {
      dots.push({
        lat: d.lat + (jrng() - 0.5) * 1.4,
        lng: d.lng + (jrng() - 0.5) * 1.9,
        district: d.name,
      });
    }
  }
  return dots;
})();

function LegendSwatch({ color, border, label }: { color: string; border?: boolean; label: string }) {
  return (
    <span className="flex items-center gap-2 text-base text-slate-700">
      <span
        className="inline-block h-3 w-3 rounded-full"
        style={{ backgroundColor: color, border: border ? "1px solid #717975" : undefined }}
      />
      {label}
    </span>
  );
}

export function MandiHeatmap() {
  const selectedCropId = useAppStore((s) => s.selectedCropId);
  const { t } = useTranslation();

  const [pilotMandis, setPilotMandis] = useState<MandiHeatEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch(`/api/v1/heatmap?crop_id=${encodeURIComponent(selectedCropId)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message ?? t("common.error"));
        return data.mandis as MandiHeatEntry[];
      })
      .then((rows) => {
        if (!cancelled) {
          setPilotMandis(rows);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setError(t("map.error"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedCropId, t]);

  const coveredMandis = MANDIS.filter((m) => !PILOT_MANDI_IDS.includes(m.id));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-card border border-slate-300 p-3">
        <LegendSwatch color={SIGNAL_COLORS.red} label={t("map.legendRed")} />
        <LegendSwatch color={SIGNAL_COLORS.yellow} label={t("map.legendYellow")} />
        <LegendSwatch color={SIGNAL_COLORS.green} label={t("map.legendGreen")} />
        <LegendSwatch color={COVERED_MANDI_COLOR} label={t("map.legendCovered")} />
        <LegendSwatch color={NO_SIGNAL_COLOR} border label={t("map.legendNoSignal")} />
        <LegendSwatch color={GREY_DOT_COLOR} label={t("map.legendGrey")} />
      </div>

      {loading && <p className="text-base text-slate-500">{t("map.loading")}</p>}
      {error && <p className="text-base text-signal-red">{error}</p>}

      <HeatmapExplanation />

      <MapContainer
        center={[19.5, 74.5]}
        zoom={7}
        scrollWheelZoom={false}
        className="z-0 h-[60vh] w-full rounded-card border border-slate-300"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {GREY_DOTS.map((dot, index) => (
          <CircleMarker
            key={`grey-${index}`}
            center={[dot.lat, dot.lng]}
            radius={4}
            pathOptions={{ color: GREY_DOT_COLOR, weight: 1, opacity: 0.6, fillColor: GREY_DOT_COLOR, fillOpacity: 0.5 }}
          >
            <Popup>
              <span className="text-base">
                {dot.district} — {t("map.notCovered")}
              </span>
              <span className="block text-sm text-slate-600">{t("map.coverTooltip")}</span>
            </Popup>
          </CircleMarker>
        ))}

        {coveredMandis.map((mandi) => (
          <CircleMarker
            key={mandi.id}
            center={[mandi.lat, mandi.lng]}
            radius={8}
            pathOptions={{ color: COVERED_MANDI_COLOR, weight: 2, opacity: 0.9, fillColor: COVERED_MANDI_COLOR, fillOpacity: 0.8 }}
          >
            <Popup>
              <span className="text-base font-medium text-slate-900">{mandi.name}</span>
              <span className="block text-sm text-slate-600">{t("map.legendCovered")}</span>
            </Popup>
          </CircleMarker>
        ))}

        {pilotMandis.map((mandi) => {
          const color = mandi.signal_status ? SIGNAL_COLORS[mandi.signal_status] ?? NO_SIGNAL_COLOR : NO_SIGNAL_COLOR;
          return (
            <CircleMarker
              key={mandi.mandi_id}
              center={[mandi.lat, mandi.lng]}
              radius={12}
              pathOptions={{ color: "#ffffff", weight: 2, opacity: 1, fillColor: color, fillOpacity: 0.9 }}
            >
              <Popup>
                <span className="block text-base font-medium text-slate-900">{mandi.name}</span>
                {mandi.signal_status ? (
                  <span className="block text-base text-slate-700">
                    {mandi.signal_status === "red"
                      ? t("map.legendRed")
                      : mandi.signal_status === "yellow"
                        ? t("map.legendYellow")
                        : t("map.legendGreen")}
                  </span>
                ) : (
                  <span className="block text-base text-slate-600">{t("map.noSignal")}</span>
                )}
                {mandi.price !== null && (
                  <span className="block text-base text-slate-700">₹{mandi.price}/q</span>
                )}
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}