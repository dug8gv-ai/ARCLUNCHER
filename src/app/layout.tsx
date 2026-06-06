import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Web3Provider } from "@/components/Web3Provider";
import { Toaster } from "react-hot-toast";
import { ArcGlobalUXProvider } from "@/context/ArcGlobalUXContext";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ArcOmni Pro | Global Analytics Edition",
  description: "High-Frequency Token Launchpad on Arc Testnet",
  icons: {
    icon: "/main-logo.jpg",
  },
  other: {
    "arcomni-verification": "arcomni-v6dhz4pcxva-1780563092138"
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased`}>
        <ArcGlobalUXProvider>
          <Web3Provider>
            <Toaster position="top-center" />
            {children}
          </Web3Provider>
        </ArcGlobalUXProvider>
      </body>
    </html>
  );
}
