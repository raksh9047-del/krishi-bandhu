import type { Config } from "tailwindcss";

// Design tokens for KrishiBandhu.
//
// Palette is deliberately restrained: this reads as a government/bank portal,
// not a consumer app. `trust` is the brand color used for primary actions and
// chrome. `signal-*` are RESERVED EXCLUSIVELY for the Sowing Signal and
// chain-integrity states (valid/tampered) — never use them decoratively for
// anything else (a "success" toast, a badge, a chart line for an unrelated
// metric). If a screen needs a positive/negative color for something that
// ISN'T a sowing signal or a chain-verification result, use `trust` or
// `slate`, not `signal-green` / `signal-red`.
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        trust: {
          50: "#eef4f1",
          100: "#d3e4dc",
          300: "#8fb8a6",
          500: "#2f6f52", // primary brand green — buttons, links, active nav
          600: "#255a42",
          700: "#1c4432",
          900: "#102519",
        },
        official: {
          50: "#eef2f6",
          300: "#9fb4c7",
          500: "#375879", // calm secondary blue — headers, secondary chrome
          700: "#243c53",
        },
        // Sowing Signal + chain-integrity states ONLY.
        "signal-green": "#2f8f4e",
        "signal-yellow": "#c98a12",
        "signal-red": "#b3402f",
        slate: {
          50: "#f7f8f8",
          100: "#eceeed",
          300: "#c3c9c7",
          500: "#717975",
          700: "#3d4441",
          900: "#1b201e",
        },
      },
      fontSize: {
        // 16px is the minimum body size anywhere in the product — never
        // drop below `base` for load-bearing text.
        base: ["1rem", { lineHeight: "1.5rem" }],
        lg: ["1.125rem", { lineHeight: "1.75rem" }],
        xl: ["1.375rem", { lineHeight: "1.85rem" }],
        "2xl": ["1.75rem", { lineHeight: "2.15rem" }],
      },
      minHeight: {
        touch: "44px",
      },
      minWidth: {
        touch: "44px",
      },
      borderRadius: {
        card: "0.75rem",
      },
    },
  },
  plugins: [],
};

export default config;
