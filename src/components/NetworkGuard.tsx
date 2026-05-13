'use client';

import { useAccount, useSwitchChain } from 'wagmi';
import { AlertTriangle } from 'lucide-react';

export function NetworkGuard() {
  const { chain, isConnected } = useAccount();
  const { switchChain } = useSwitchChain();
  
  const ARC_TESTNET_ID = 5042002;

  if (!isConnected || chain?.id === ARC_TESTNET_ID) {
    return null; // Return null if not connected or already on correct network
  }

  return (
    <div className="bg-red-900/30 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg flex items-center justify-between mb-8">
      <div className="flex items-center gap-3">
        <AlertTriangle className="text-red-400" />
        <div>
          <h3 className="font-bold">Wrong Network</h3>
          <p className="text-sm opacity-80">Please switch to Arc Testnet to use the application.</p>
        </div>
      </div>
      <button 
        onClick={() => switchChain({ chainId: ARC_TESTNET_ID })}
        className="bg-red-500/20 hover:bg-red-500/40 text-red-100 px-4 py-2 rounded border border-red-500/50 transition-colors"
      >
        Switch Network
      </button>
    </div>
  );
}
