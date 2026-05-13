'use client';

import { useState } from 'react';
import { Rocket, CheckCircle2, Loader2 } from 'lucide-react';
import { useAccount, useWriteContract, usePublicClient } from 'wagmi';
import { parseUnits, erc20Abi } from 'viem';

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

// Mock contract address for ArcLauncher and USDC
const ARC_LAUNCHER_ADDRESS = process.env.NEXT_PUBLIC_LAUNCHER_ADDRESS || '0x0000000000000000000000000000000000000000';
const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS || '0x0000000000000000000000000000000000000000';

export function LaunchForm() {
  const { isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  
  const [formData, setFormData] = useState({ name: '', ticker: '', supply: '', image: '' });
  
  const [status, setStatus] = useState<'idle' | 'approving' | 'launching' | 'success'>('idle');

  const handleLaunch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected) return alert("Please connect your wallet first.");
    if (!publicClient) return alert("Network error. Please refresh.");

    try {
      // Step 1: Approve 4 USDC
      setStatus('approving');
      const feeAmount = parseUnits('4', 6); // USDC usually has 6 decimals
      
      const approveHash = await writeContractAsync({
        address: USDC_ADDRESS as `0x${string}`,
        abi: erc20Abi,
        functionName: 'approve',
        args: [ARC_LAUNCHER_ADDRESS as `0x${string}`, feeAmount],
      });
      
      // Wait for approval confirmation
      await publicClient.waitForTransactionReceipt({ hash: approveHash });

      // Step 2: Launch Token
      setStatus('launching');
      const launchHash = await writeContractAsync({
        address: ARC_LAUNCHER_ADDRESS as `0x${string}`,
        abi: ARC_LAUNCHER_ABI,
        functionName: 'launchToken',
        args: [formData.name, formData.ticker, parseUnits(formData.supply || '0', 18)],
      });

      // Wait for launch confirmation
      await publicClient.waitForTransactionReceipt({ hash: launchHash });
      
      setStatus('success');
      
      // Reset after a few seconds
      setTimeout(() => {
        setStatus('idle');
        setFormData({ name: '', ticker: '', supply: '', image: '' });
      }, 5000);

    } catch (error) {
      console.error(error);
      setStatus('idle');
      alert("Transaction failed or was rejected.");
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
            disabled={status !== 'idle'}
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
              disabled={status !== 'idle'}
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
              disabled={status !== 'idle'}
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
            disabled={status !== 'idle'}
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
          disabled={status !== 'idle'}
          className="w-full cyber-button py-3 rounded-lg font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === 'approving' && <><Loader2 className="animate-spin" /> Approving USDC...</>}
          {status === 'launching' && <><Loader2 className="animate-spin" /> Deploying Token...</>}
          {status === 'success' && <><CheckCircle2 className="text-green-400" /> Launched Successfully!</>}
          {status === 'idle' && 'Deploy Token'}
        </button>
      </form>
    </div>
  );
}
