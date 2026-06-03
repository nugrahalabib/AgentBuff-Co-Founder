import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "AgentBuff Co-Founder — Co-Founder AI untuk Bisnismu", template: "%s · AgentBuff Co-Founder" },
  description:
    "Co-Founder AI yang mendampingimu dari ide mentah hingga business plan, brand, dan dokumen siap investor. Gratis, pakai API key-mu sendiri (BYOK), berbahasa Indonesia.",
  applicationName: "AgentBuff Co-Founder",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "AgentBuff", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#6366F1",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
