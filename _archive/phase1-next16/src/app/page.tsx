'use client';

import { useAppStore } from '@/store/useAppStore';
import { StatusBadge } from '@/components/StatusBadge';
import { CROPS, MANDIS } from '@/constants';

export default function Home() {
  // Selecting the ids from the store keeps this component subscribed, so it
  // re-renders whenever the ContextSwitcher changes the app-wide context.
  const selectedCropId = useAppStore((s) => s.selectedCropId);
  const selectedMandiId = useAppStore((s) => s.selectedMandiId);

  const crop = CROPS.find((c) => c.id === selectedCropId);
  const mandi = MANDIS.find((m) => m.id === selectedMandiId);

  const isPilotCrop = !!crop && ['onion', 'tomato', 'cotton'].includes(crop.id);
  const isPilotMandi = !!mandi && ['vashi', 'lasalgaon', 'pune-gultekdi'].includes(mandi.id);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8">
      {/* Hero */}
      <section className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">
          Trust and market insight for Maharashtra farmers
        </h1>
        <p className="max-w-2xl text-base text-muted-foreground">
          See a region-wide price glut coming before you commit your land, and get a
          tamper-evident digital receipt for every sale.
        </p>
      </section>

      {/* Current Context */}
      <section className="rounded-lg border border-border bg-muted/50 p-4">
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">Current context</h2>
        {crop && mandi ? (
          <div className="flex items-center gap-2 text-base">
            <span role="img" aria-hidden="true">{crop.icon}</span>
            <span className="font-medium">{crop.name}</span>
            <span className="text-muted-foreground">·</span>
            <span className="font-medium">{mandi.name}</span>
            <span className="text-muted-foreground">({mandi.district})</span>
            {isPilotCrop && isPilotMandi ? (
              <StatusBadge status="live" label="Pilot live" />
            ) : (
              <StatusBadge status="comingSoon" label="Coverage coming soon" />
            )}
          </div>
        ) : (
          <p className="text-base text-muted-foreground">No context selected.</p>
        )}
      </section>

      {/* Foundation confirmation */}
      <section className="flex flex-col gap-4 rounded-lg border border-border p-4">
        <h2 className="text-lg font-semibold">Phase 1 foundation is live</h2>
        <ul className="list-inside list-disc space-y-1 text-base text-foreground">
          <li>Crop, mandi, and language context switches wired to persistent state.</li>
          <li>{CROPS.length} crops and {MANDIS.length} mandis defined as typed constants.</li>
        </ul>
      </section>
    </div>
  );
}
