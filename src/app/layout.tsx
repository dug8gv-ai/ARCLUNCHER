import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Web3Provider } from "@/components/Web3Provider";
import { Toaster } from "react-hot-toast";
import { WelcomeSplash } from "@/components/WelcomeSplash";
import { RainBackground } from "@/components/RainBackground";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ArcOmni Pro | Global Analytics Edition",
  description: "High-Frequency Token Launchpad on Arc Testnet",
  icons: { icon: "/main-logo.jpg" },
  other: {
    "arcomni-verification": "arcomni-v6dhz4pcxva-1780563092138",
  },
};

// Mobile-first viewport — prevents iOS zoom, enables safe areas
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",        // iPhone notch / Dynamic Island safe
  themeColor: "#eef2f7",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="overflow-x-hidden">
      <body
        className={`${inter.variable} antialiased overflow-x-hidden`}
        style={{ position: "relative" }}
      >
        {/* ── Ambient rain — light mode only, z-0, pointer-events:none ── */}
        <RainBackground />

        <Web3Provider>
          <WelcomeSplash />
          <Toaster
            position="top-center"
            toastOptions={{
              style: {
                background: "#ffffff",
                color: "#1e293b",
                border: "1px solid rgba(226,232,240,0.7)",
                borderRadius: "12px",
                boxShadow: "0 2px 12px rgba(15,23,42,0.08)",
              },
            }}
          />
          {/* Main content — sits above canvas z-index */}
          <div style={{ position: "relative", zIndex: 1 }}>
            {children}
          </div>
        </Web3Provider>
      </body>
    </html>
  );
}
