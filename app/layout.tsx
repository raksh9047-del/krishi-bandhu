import type { Metadata, Viewport } from "next";
import "./globals.css";
import dynamic from "next/dynamic";
import type { ComponentType, ReactNode } from "react";

const ClientProviders = dynamic(
  () => import("@/components/ClientProviders").then((mod) => mod.default) as unknown as Promise<ComponentType<{ children: ReactNode }>>,
  { ssr: false }
);

export const metadata: Metadata = {
  title: "KrishiBandhu — Farmer's Companion",
  description:
    "Sowing-season glut warnings and tamper-evident sale receipts for Maharashtra's farmers.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#2f6f52",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col bg-[#f4f6f5] text-base text-slate-900 antialiased">
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}