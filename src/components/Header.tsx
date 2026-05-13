'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Layers } from 'lucide-react';

export function Header() {
  return (
    <header className="glass-panel px-6 py-4 mb-8 flex items-center justify-between sticky top-4 z-50">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center border border-cyan-500/50">
          <Layers className="text-cyan-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            ArcLauncher <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded border border-yellow-500/30">PRO</span>
          </h1>
          <p className="text-xs text-cyan-400/70 hidden md:block">High-Frequency Token Launchpad</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden md:flex items-center gap-2 text-sm text-gray-400 mr-4">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          Arc Testnet Live
        </div>
        <ConnectButton />
      </div>
    </header>
  );
}
