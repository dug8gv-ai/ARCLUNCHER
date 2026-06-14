import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Web3Provider } from "@/components/Web3Provider";
import { Toaster } from "react-hot-toast";
import { WelcomeSplash } from "@/components/WelcomeSplash";
import { RainBackgroundClient } from "@/components/RainBackgroundClient";
import { AuthGate } from "@/components/AuthGate";

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

import { ThemeProvider } from "@/components/ThemeProvider";

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="overflow-x-hidden" suppressHydrationWarning>
      <body
        className="antialiased overflow-x-hidden"
        style={{ position: "relative" }}
      >
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          {/* ── Ambient rain — client-only, z-0, pointer-events:none ── */}
          <RainBackgroundClient />

          <Web3Provider>
            <WelcomeSplash />
            <Toaster
              position="top-center"
              toastOptions={{
                style: {
                  background: "var(--bg-panel, rgba(8,14,44,0.95))",
                  color: "var(--text-bright, #e8eeff)",
                  border: "1px solid var(--border-dim, rgba(41,121,255,0.25))",
                  borderRadius: "12px",
                  boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
                  backdropFilter: "blur(12px)",
                  fontFamily: "'Rajdhani', sans-serif",
                  letterSpacing: "0.03em",
                },
              }}
            />
            {/* Main content — sits above canvas z-index */}
            <div style={{ position: "relative", zIndex: 1 }}>
              <AuthGate>
                {children}
              </AuthGate>
            </div>
          </Web3Provider>
        </ThemeProvider>
      </body>
    </html>
  );
}
