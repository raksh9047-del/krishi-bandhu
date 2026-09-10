/**
 * KrishiBandhu — demo alerts for the pilot screens.
 *
 * Seeds the farmer app's alert inboxes via the live /api/alerts endpoint
 * (Storage fallback or Postgres table, whichever the deployed app is using).
 * Idempotent: `?replace=1` clears the farmer's existing alerts first.
 *
 *   node scripts/seed-alerts-demo.mjs
 *   KB_API_BASE=http://localhost:3000 node scripts/seed-alerts-demo.mjs   (dev)
 */
const API_BASE = process.env.KB_API_BASE ?? "https://krishi-bandhu-sandy.vercel.app";

const P1_FARMER = "7fa4837a-989b-4abd-98ec-2124b1c1d011"; // P1 Farmer
const TEST_FARMER = "9f618a98-f7fd-4c47-bfb5-cb5bde6bec25"; // Test Farmer
const P1_TRADER = "b28c318e-cec2-4a3f-9009-21c6ca8be0ad"; // P1 Trader

async function main() {
  // Mirror the latest Parchi actually on the ledger so the seeded "Parchi
  // recorded" alert matches what the feed/ledger screens show.
  let lastHash = null;
  try {
    const res = await fetch(`${API_BASE}/api/parchi/list?farmer_id=${P1_FARMER}&limit=1`);
    const data = await res.json();
    const latest = (data.entries ?? [])[0];
    if (latest?.current_hash) {
      lastHash = `${latest.current_hash.slice(0, 8)}…${latest.current_hash.slice(-4)}`;
    }
  } catch {
    // hash echo is cosmetic — carry on without it
  }

  const demoSets = [
    {
      farmer_id: P1_FARMER,
      alerts: [
        {
          type: "price_alert",
          severity: "warning",
          title: "Onion prices eased at Lasalgaon",
          message: "Onion is ₹4,250/quintal at Lasalgaon today — about 8% below last week's rate.",
          payload: { crop_id: "onion", mandi_id: "lasalgaon" },
        },
        {
          type: "sowing_alert",
          severity: "danger",
          title: "Red sowing signal — onion",
          message: "Onion shows a red sowing signal at Lasalgaon. Avoid fresh planting now; consider cold storage.",
          payload: { crop_id: "onion", mandi_id: "lasalgaon" },
        },
        {
          type: "parchi_recorded",
          severity: "info",
          title: "New Parchi recorded",
          message: lastHash
            ? `Sale confirmed by P1 Trader. Hash ${lastHash} — tap your sale records to verify the chain.`
            : "Sale confirmed by P1 Trader — tap your sale records to verify the chain.",
          payload: { crop_id: "onion", mandi_id: "lasalgaon", trader_id: P1_TRADER },
        },
        {
          type: "arrival",
          severity: "info",
          title: "Return truck listed today",
          message: "A return truck from Lasalgaon to Nashik district is available — share the load and cut transport cost.",
          payload: { mandi_id: "lasalgaon" },
        },
      ],
    },
    {
      farmer_id: TEST_FARMER,
      alerts: [
        {
          type: "price_alert",
          severity: "info",
          title: "Potato stable at Pune Gultekdi",
          message: "Potato is steady at ₹2,800/quintal at Pune Gultekdi.",
          payload: { crop_id: "potato", mandi_id: "pune-gultekdi" },
        },
        {
          type: "sowing_alert",
          severity: "warning",
          title: "Yellow sowing signal — tomato",
          message: "Tomato is a yellow signal at Vashi. Prices are moderate — sell only if urgent.",
          payload: { crop_id: "tomato", mandi_id: "vashi" },
        },
      ],
    },
  ];

  let insertedTotal = 0;
  for (const set of demoSets) {
    // Clear-then-insert so re-running never snowballs duplicate alerts.
    await fetch(`${API_BASE}/api/alerts/clear`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ farmer_id: set.farmer_id }),
    });

    for (const alert of set.alerts) {
      const res = await fetch(`${API_BASE}/api/alerts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ farmer_id: set.farmer_id, ...alert }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error(`[seed-alerts] POST failed for ${set.farmer_id} (${alert.type}): ${body.error ?? res.status}`);
        process.exit(1);
      }
      insertedTotal++;
    }
  }

  console.log(`[seed-alerts] OK — inserted ${insertedTotal} demo alerts via ${API_BASE}.`);
}

main().catch((err) => {
  console.error("[seed-alerts] failed:", err);
  process.exit(1);
});