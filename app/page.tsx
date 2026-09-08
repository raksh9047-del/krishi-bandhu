import { SowingSignalCard } from "@/components/farmer/SowingSignalCard";
import { LivePriceDashboard } from "@/components/farmer/LivePriceDashboard";
import { NetRealizationCalculator } from "@/components/farmer/NetRealizationCalculator";

/**
 * The farmer home screen — the three numbers that matter most, per the spec:
 * the Sowing Signal (should I even plant this?), today's market price (with
 * its provenance), and the Net Realization estimate (what will I actually
 * take home if I sell today?).
 */
export default function Home() {
  return (
    <div className="flex flex-col gap-4 pt-2">
      <SowingSignalCard />
      <LivePriceDashboard />
      <NetRealizationCalculator />
    </div>
  );
}