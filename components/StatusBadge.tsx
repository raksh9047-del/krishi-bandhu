"use client";

import { useState } from "react";
import type { BuildStatus } from "@/types";

interface StatusBadgeProps {
  status: BuildStatus;
  label: string;
  /** Fires the explanatory tooltip on tap — used by disabled stubs. */
  onTap?: () => void;
  /** Optional explanatory copy shown when a comingSoon badge is tapped. */
  tooltip?: string;
}

const STATUS_CONFIG: Record<BuildStatus, { icon: string; classes: string }> = {
  live: {
    icon: "🚀",
    classes: "bg-trust-50 text-trust-700 border-trust-300",
  },
  prototype: {
    icon: "🎬",
    classes: "bg-official-50 text-official-700 border-official-300",
  },
  comingSoon: {
    icon: "🔜",
    classes: "bg-slate-100 text-slate-500 border-slate-300",
  },
};

/**
 * Every stubbed feature in the product (AgriStack verification, WhatsApp
 * routing, UPI Autopay, the statewide coverage overlay) renders through this
 * component instead of a one-off "coming soon" UI, so the visual language for
 * "this isn't real yet" stays identical everywhere.
 */
export function StatusBadge({ status, label, onTap, tooltip }: StatusBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const config = STATUS_CONFIG[status];
  const isStub = status === "comingSoon";

  return (
    <div className="relative inline-block">
      <button
        type="button"
        disabled={isStub}
        onClick={() => {
          if (isStub) {
            setShowTooltip((v) => !v);
            onTap?.();
          }
        }}
        className={[
          "inline-flex items-center gap-2 rounded-card border px-4 py-2",
          "min-h-touch text-base font-medium",
          config.classes,
          isStub ? "cursor-help" : "cursor-default",
        ].join(" ")}
        aria-describedby={isStub ? `${label}-tooltip` : undefined}
      >
        <span aria-hidden="true">{config.icon}</span>
        <span>{label}</span>
      </button>
      {isStub && showTooltip && tooltip && (
        <div
          id={`${label}-tooltip`}
          role="tooltip"
          className="absolute z-10 mt-2 w-64 rounded-card border border-slate-300 bg-white p-3 text-base text-slate-700 shadow-md"
        >
          {tooltip}
        </div>
      )}
    </div>
  );
}
