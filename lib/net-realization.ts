// Corrected net-realization engine, ported from the Python reference
// (net_realization.py). One rule matters: transport is only subtracted from
// the trader's payout when the TRADER arranged pickup (they paid upfront and
// recover it by paying the farmer less). When the FARMER arranges their own
// transport, they already paid it separately — nothing is deducted from the
// payout; it is surfaced as their own expense line instead.
//
// This module is the single source of truth: the NetRealizationCalculator
// component bundles it directly (offline-capable), and the
// POST /api/net-realization/calculate route calls the same function.

export type TransportArranger = "farmer" | "trader";

export interface Deduction {
  label: string;
  amount: number;
}

export interface NetRealizationResult {
  gross_amount: number;
  total_deductions: number;
  transport_arranger: TransportArranger;
  transport_cost: number;
  transport_deducted_from_payout: number;
  farmer_own_transport_expense: number;
  net_payout: number;
  effective_take_home: number;
  /** Line-by-line breakdown the UI renders; amounts are signed. */
  breakdown: { label: string; amount: number }[];
}

export function calculateNetRealization(
  sellingPrice: number,
  quantity: number,
  deductions: Deduction[],
  transportCost: number,
  transportArranger: TransportArranger
): NetRealizationResult {
  const grossAmount = sellingPrice * quantity;
  const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0);

  const transportDeductedFromPayout = transportArranger === "trader" ? transportCost : 0;
  const farmerOwnTransportExpense = transportArranger === "farmer" ? transportCost : 0;

  const netPayout = grossAmount - totalDeductions - transportDeductedFromPayout;
  const effectiveTakeHome = netPayout - farmerOwnTransportExpense;

  const breakdown: { label: string; amount: number }[] = [
    { label: "Gross amount", amount: grossAmount },
    ...deductions.map((d) => ({ label: d.label, amount: -d.amount })),
  ];
  if (transportDeductedFromPayout > 0) {
    breakdown.push({ label: "Transport (trader-arranged)", amount: -transportDeductedFromPayout });
  }
  breakdown.push({ label: "Net payout from trader", amount: netPayout });
  if (farmerOwnTransportExpense > 0) {
    breakdown.push({
      label: "Your own transport cost (not deducted by trader)",
      amount: -farmerOwnTransportExpense,
    });
    breakdown.push({ label: "Effective take-home after your transport cost", amount: effectiveTakeHome });
  }

  return {
    gross_amount: grossAmount,
    total_deductions: totalDeductions,
    transport_arranger: transportArranger,
    transport_cost: transportCost,
    transport_deducted_from_payout: transportDeductedFromPayout,
    farmer_own_transport_expense: farmerOwnTransportExpense,
    net_payout: netPayout,
    effective_take_home: effectiveTakeHome,
    breakdown,
  };
}