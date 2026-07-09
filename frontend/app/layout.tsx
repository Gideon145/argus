import type { Metadata, Viewport } from "next";
import { WalletProvider } from "@/lib/wallet-context";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopNav } from "@/components/layout/TopNav";
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
    <html lang="en" className="bg-bg-primary text-text-primary h-full">
      <body className="h-full flex overflow-hidden">
        <WalletProvider>
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <TopNav />
            <main className="flex-1 overflow-y-auto p-4 lg:p-6 bg-bg-primary relative">
              {children}
            </main>
          </div>
        </WalletProvider>
      </body>
    </html>
  );
}

