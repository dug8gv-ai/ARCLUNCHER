import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Web3Provider } from "@/components/Web3Provider";
import { Toaster } from "react-hot-toast";
import { WelcomeSplash } from "@/components/WelcomeSplash";
import { RainBackgroundClient } from "@/components/RainBackgroundClient";

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
  themeColor: "#04061a",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="overflow-x-hidden">
      <body
        className="antialiased overflow-x-hidden"
        style={{ position: "relative" }}
      >
        {/* ── Ambient rain — client-only, z-0, pointer-events:none ── */}
        <RainBackgroundClient />

        <Web3Provider>
          <WelcomeSplash />
          <Toaster
            position="top-center"
            toastOptions={{
              style: {
                background: "rgba(8,14,44,0.95)",
                color: "#e8eeff",
                border: "1px solid rgba(41,121,255,0.25)",
                borderRadius: "8px",
                boxShadow: "0 0 24px rgba(41,121,255,0.2)",
                backdropFilter: "blur(12px)",
                fontFamily: "'Rajdhani', sans-serif",
                letterSpacing: "0.03em",
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
