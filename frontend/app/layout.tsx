import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Argus — Three eyes. One verdict.",
  description: "Multi-agent security consensus oracle on Arc. Three AI agents stake USDC on security verdicts.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
