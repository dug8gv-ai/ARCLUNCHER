'use client';

import { useEffect, useState } from 'react';

export interface DetectedWallet {
  name: string;
  installed: boolean;
  deepLink: string;
}

/**
 * Detects installed wallet browser extensions and mobile wallet apps.
 * Checks window.ethereum and known injected providers.
 * Returns a list of detected wallets for the UI to display.
 */
export function useDetectedWallets(): DetectedWallet[] {
  const [wallets, setWallets] = useState<DetectedWallet[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Small delay to let wallet providers inject
    const timer = setTimeout(() => {
      const detected: DetectedWallet[] = [];
      const ethereum = (window as any).ethereum;

      // MetaMask detection
      const hasMetaMask = ethereum?.isMetaMask || 
        (ethereum?.providers?.some((p: any) => p.isMetaMask));
      detected.push({
        name: 'MetaMask',
        installed: !!hasMetaMask,
        deepLink: 'https://metamask.app.link/dapp/arcomni.vercel.app',
      });

      // Trust Wallet detection
      const hasTrust = ethereum?.isTrust || 
        (ethereum?.providers?.some((p: any) => p.isTrust)) ||
        !!(window as any).trustwallet;
      detected.push({
        name: 'Trust Wallet',
        installed: !!hasTrust,
        deepLink: 'https://link.trustwallet.com/open_url?coin_id=60&url=https://arcomni.vercel.app',
      });

      // Coinbase Wallet detection
      const hasCoinbase = ethereum?.isCoinbaseWallet || 
        (ethereum?.providers?.some((p: any) => p.isCoinbaseWallet)) ||
        !!(window as any).coinbaseWalletExtension;
      detected.push({
        name: 'Coinbase Wallet',
        installed: !!hasCoinbase,
        deepLink: 'https://go.cb-w.com/dapp?cb_url=https://arcomni.vercel.app',
      });

      // Rainbow detection
      const hasRainbow = ethereum?.isRainbow || 
        (ethereum?.providers?.some((p: any) => p.isRainbow));
      detected.push({
        name: 'Rainbow',
        installed: !!hasRainbow,
        deepLink: 'https://rainbow.me/dapp?url=https://arcomni.vercel.app',
      });

      // Rabby detection
      const hasRabby = ethereum?.isRabby || 
        (ethereum?.providers?.some((p: any) => p.isRabby));
      detected.push({
        name: 'Rabby',
        installed: !!hasRabby,
        deepLink: '',
      });

      // Generic injected wallet
      if (ethereum && !hasMetaMask && !hasTrust && !hasCoinbase && !hasRainbow && !hasRabby) {
        detected.push({
          name: 'Browser Wallet',
          installed: true,
          deepLink: '',
        });
      }

      setWallets(detected);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  return wallets;
}

/**
 * Component that renders nothing but logs detected wallets.
 * Import useDetectedWallets hook directly for custom UI usage.
 */
export function WalletDetector() {
  const wallets = useDetectedWallets();

  useEffect(() => {
    const installed = wallets.filter(w => w.installed);
    if (installed.length > 0) {
      console.log('[ArcOmni] Detected wallets:', installed.map(w => w.name).join(', '));
    }
  }, [wallets]);

  return null;
}
