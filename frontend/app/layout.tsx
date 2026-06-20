import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Argus — Multi-Agent Security Oracle",
  description: "Three independent AI agents analyze token contracts. Each stakes USDC on its verdict. Consensus determines the truth.",
  openGraph: {
    title: "Argus — Three eyes. One verdict.",
    description: "Multi-agent security consensus oracle on Arc. DeepSeek + Claude + Rule Engine.",
    url: "https://argusarc.xyz",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="bg-[#050816]">
      <body>{children}</body>
    </html>
  );
}
