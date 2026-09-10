"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Desktop-only top navigation. Shown in the sticky header at `lg:` and above;
 * on phones the BottomNav remains the primary navigation.
 */
const LINKS = [
  { href: "/", label: "Home", match: "/" },
  { href: "/markets", label: "Markets", match: "/markets" },
  { href: "/storage", label: "Storage", match: "/storage" },
  { href: "/feed", label: "Updates", match: "/feed" },
  { href: "/backhaul", label: "Backhaul", match: "/backhaul" },
  { href: "/data", label: "Data Hub", match: "/data" },
  { href: "/government", label: "Government", match: "/government" },
  { href: "/trader", label: "Trader", match: "/trader" },
  { href: "/fpo/prices", label: "FPO", match: "/fpo" },
];

export function DesktopNav() {
  const pathname = usePathname();

  return (
    <nav className="hidden w-full border-t border-[#eef4f1] bg-white lg:block" aria-label="Primary">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-1 px-6 py-2">
        {LINKS.map((link) => {
          const active =
            link.match === "/" ? pathname === "/" : pathname.startsWith(link.match);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={[
                "rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors",
                active
                  ? "bg-[#eef4f1] text-[#1c4432]"
                  : "text-slate-600 hover:bg-[#f4f6f5] hover:text-[#2f6f52]",
              ].join(" ")}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}