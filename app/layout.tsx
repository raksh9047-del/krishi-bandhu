import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ContextSwitcher } from "@/components/ContextSwitcher";
import { BottomNav } from "@/components/BottomNav";

export const metadata: Metadata = {
  title: "KrishiBandhu",
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
    <html lang="en">
      <body className="flex min-h-screen flex-col bg-white text-base text-slate-900 antialiased">
        <ContextSwitcher />
        <main className="mx-auto w-full max-w-lg flex-1 px-3 pb-4 pt-4">{children}</main>
        <BottomNav />
      </body>
    </html>
  );
}
