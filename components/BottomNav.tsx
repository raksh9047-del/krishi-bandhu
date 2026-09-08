"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Home" },
  { href: "/feed", label: "Updates" },
  { href: "/data", label: "Data" },
  { href: "/storage", label: "Storage" },
  { href: "/backhaul", label: "Backhaul" },
  { href: "/trader", label: "Trader" },
  { href: "/register", label: "Register" },
];

/**
 * Not called out as its own feature in the spec, but the five farmer
 * screens built in Phase 6 need some way to navigate between them — this is
 * the minimal, unstyled-opinion version of that.
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 z-20 flex border-t border-slate-300 bg-white">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={[
              "flex min-h-touch flex-1 items-center justify-center text-base",
              active ? "font-semibold text-trust-700" : "text-slate-600",
            ].join(" ")}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
