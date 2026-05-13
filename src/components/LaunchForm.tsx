'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Rocket } from 'lucide-react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';

// ABI snippet for ArcLauncher
const ARC_LAUNCHER_ABI = [
  {
    "inputs": [
      {"internalType": "string", "name": "name", "type": "string"},
      {"internalType": "string", "name": "ticker", "type": "string"},
      {"internalType": "uint256", "name": "supply", "type": "uint256"}
    ],
    "name": "launchToken",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

// Mock contract address for ArcLauncher
const ARC_LAUNCHER_ADDRESS = '0x1234567890123456789012345678901234567890';

export function LaunchForm() {
  const { isConnected } = useAccount();
  const [formData, setFormData] = useState({ name: '', ticker: '', supply: '', image: '' });
  
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const handleLaunch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected) return alert("Please connect your wallet first.");
    
    // In a real flow, you would first call USDC approve() for 4 USDC.
    // For brevity, we assume approval is done or we call it here.
    try {
      writeContract({
        address: ARC_LAUNCHER_ADDRESS as `0x${string}`,
        abi: ARC_LAUNCHER_ABI,
        functionName: 'launchToken',
        args: [formData.name, formData.ticker, parseUnits(formData.supply || '0', 18)],
      });
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="glass-panel p-8">
      <div className="flex items-center gap-3 mb-6">
        <Rocket className="text-cyan-400" />
        <h2 className="text-2xl font-bold neon-text-cyan">Launch New Token</h2>
      </div>
      
      <form onSubmit={handleLaunch} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Token Name</label>
          <input 
            type="text" 
            placeholder="ArcDoge"
            className="w-full cyber-input rounded-lg p-3"
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            required
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Ticker</label>
            <input 
              type="text" 
              placeholder="ADOGE"
              className="w-full cyber-input rounded-lg p-3"
              value={formData.ticker}
              onChange={(e) => setFormData({...formData, ticker: e.target.value})}
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Total Supply</label>
            <input 
              type="number" 
              placeholder="1000000000"
              className="w-full cyber-input rounded-lg p-3"
              value={formData.supply}
              onChange={(e) => setFormData({...formData, supply: e.target.value})}
              required
            />
          </div>
        </div>
        
        <div>
          <label className="block text-sm text-gray-400 mb-1">Image URL</label>
          <input 
            type="url" 
            placeholder="https://..."
            className="w-full cyber-input rounded-lg p-3"
            value={formData.image}
            onChange={(e) => setFormData({...formData, image: e.target.value})}
          />
        </div>

        <div className="bg-black/30 p-4 rounded-lg border border-gray-800 my-4 text-sm">
          <div className="flex justify-between mb-2">
            <span className="text-gray-400">Fixed Fee</span>
            <span className="text-white font-medium">4.00 USDC</span>
          </div>
          <div className="flex justify-between mb-2 text-xs">
            <span className="text-gray-500">↳ Initial Liquidity (99% Supply)</span>
            <span className="text-cyan-400">3.00 USDC</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">↳ Platform Treasury</span>
            <span className="text-yellow-400">1.00 USDC</span>
          </div>
        </div>

        <button 
          type="submit" 
          disabled={isPending || isConfirming}
          className="w-full cyber-button py-3 rounded-lg font-bold text-lg flex items-center justify-center gap-2"
        >
          {isPending ? 'Confirm in Wallet...' : isConfirming ? 'Deploying...' : 'Deploy Token'}
        </button>
        
        {isConfirmed && (
          <p className="text-green-400 text-sm text-center mt-2">Token Launched Successfully!</p>
        )}
      </form>
    </div>
  );
}
