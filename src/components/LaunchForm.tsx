'use client';

import { useState } from 'react';
import { Rocket, CheckCircle2, Loader2 } from 'lucide-react';
import { useAccount, useWriteContract, usePublicClient } from 'wagmi';
import { parseUnits, erc20Abi, decodeEventLog } from 'viem';
import { supabase } from '@/lib/supabase';

// ABI snippet for ArcOmni
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
  },
  {
    "inputs": [{"internalType": "string", "name": "ticker", "type": "string"}],
    "name": "tickerToToken",
    "outputs": [{"internalType": "address", "name": "", "type": "address"}],
    "stateMutability": "view",
    "type": "function"
  }
];

// Standard ERC20 ABI but with more permissive return types for system contracts
const USDC_ABI = [
  {
    "inputs": [
      {"internalType": "address", "name": "spender", "type": "address"},
      {"internalType": "uint256", "name": "amount", "type": "uint256"}
    ],
    "name": "approve",
    "outputs": [], // Changed from bool to void to handle Arc Testnet system contract
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "account", "type": "address"}
    ],
    "name": "balanceOf",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  }
];

// Arc Testnet Constants (Default fallbacks)
const ARC_USDC_ADDRESS = '0x3600000000000000000000000000000000000000';

const ARC_LAUNCHER_ADDRESS = process.env.NEXT_PUBLIC_LAUNCHER_ADDRESS || '0x0000000000000000000000000000000000000000';
const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS || ARC_USDC_ADDRESS;

export function LaunchForm() {
  const { isConnected, address: userAddress } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  
  const [formData, setFormData] = useState({ name: '', ticker: '', supply: '', image: '' });
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'approving' | 'launching' | 'success'>('idle');

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { data, error } = await supabase.storage
        .from('token-images')
        .upload(filePath, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('token-images')
        .getPublicUrl(filePath);

      setFormData({ ...formData, image: publicUrl });
    } catch (error: any) {
      console.error('Error uploading image:', error.message);
      alert('Error uploading image: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleLaunch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected) return alert("Please connect your wallet first.");
    if (!publicClient) return alert("Network error. Please refresh.");
    
    if (ARC_LAUNCHER_ADDRESS === '0x0000000000000000000000000000000000000000') {
      return alert("Launcher address is not configured. Please set NEXT_PUBLIC_LAUNCHER_ADDRESS.");
    }

    try {
      console.log("Starting launch process...");
      console.log("Launcher Address:", ARC_LAUNCHER_ADDRESS);
      console.log("USDC Address:", USDC_ADDRESS);

      // Step 1: Approve 4 USDC
      setStatus('approving');
      // Arc Testnet USDC ERC-20 interface (0x3600...) uses 6 decimals
      const decimals = 6;
      const feeAmount = parseUnits('4', decimals); 
      console.log("Approving USDC Amount:", feeAmount.toString());
      
      const approveHash = await writeContractAsync({
        address: USDC_ADDRESS as `0x${string}`,
        abi: USDC_ABI,
        functionName: 'approve',
        args: [ARC_LAUNCHER_ADDRESS as `0x${string}`, feeAmount],
      });
      
      console.log("Approval Hash:", approveHash);
      await publicClient.waitForTransactionReceipt({ hash: approveHash });
      console.log("Approval confirmed.");

      // Step 2: Launch Token
      setStatus('launching');
      const supplyAmount = parseUnits(formData.supply || '0', 18);
      console.log("Launching Token with Supply:", supplyAmount.toString());

      const launchHash = await writeContractAsync({
        address: ARC_LAUNCHER_ADDRESS as `0x${string}`,
        abi: ARC_LAUNCHER_ABI,
        functionName: 'launchToken',
        args: [formData.name, formData.ticker, supplyAmount],
      });

      console.log("Launch Hash:", launchHash);
      const receipt = await publicClient.waitForTransactionReceipt({ hash: launchHash });
      console.log("Token launched successfully!");

      // Step 3: GET REAL ADDRESS FROM EVENT LOGS (Foolproof)
      console.log("Extracting real address from logs...");
      
      const LAUNCHED_EVENT_ABI = {
        "anonymous": false,
        "inputs": [
          {"indexed": true, "internalType": "address", "name": "tokenAddress", "type": "address"},
          {"indexed": false, "internalType": "string", "name": "name", "type": "string"},
          {"indexed": false, "internalType": "string", "name": "ticker", "type": "string"},
          {"indexed": false, "internalType": "uint256", "name": "supply", "type": "uint256"},
          {"indexed": true, "internalType": "address", "name": "creator", "type": "address"}
        ],
        "name": "TokenLaunched",
        "type": "event"
      };

      let finalTokenAddress = '';
      
      // Look through logs for TokenLaunched event
      for (const log of receipt.logs) {
        try {
          const decodedLog = decodeEventLog({
            abi: [LAUNCHED_EVENT_ABI],
            data: log.data,
            topics: log.topics,
          });
          if (decodedLog.eventName === 'TokenLaunched') {
            finalTokenAddress = (decodedLog.args as any).tokenAddress;
            break;
          }
        } catch (e) {
          // Continue if log doesn't match
        }
      }

      if (!finalTokenAddress) {
        console.warn("Could not find TokenLaunched event in logs, falling back to contract call");
        finalTokenAddress = await publicClient.readContract({
          address: ARC_LAUNCHER_ADDRESS as `0x${string}`,
          abi: ARC_LAUNCHER_ABI,
          functionName: 'tickerToToken',
          args: [formData.ticker],
        }) as string;
      }

      if (!finalTokenAddress || finalTokenAddress === '0x0000000000000000000000000000000000000000') {
        throw new Error("Could not retrieve token address from blockchain.");
      }

      console.log("FINAL TOKEN ADDRESS:", finalTokenAddress);
      alert(`TOKEN CREATED!\nAddress: ${finalTokenAddress}\nSyncing with dashboard...`);


      // Step 4: Sync with Database (Supabase)
      console.log("Syncing with database with real address:", finalTokenAddress);
      const { error: dbError } = await supabase
        .from('token_launches')
        .insert({
          creator_address: userAddress?.toLowerCase(),
          token_address: finalTokenAddress.toLowerCase(),
          name: formData.name,
          ticker: formData.ticker,
          supply: Number(formData.supply), 
          initial_supply: Number(formData.supply),
          initial_liquidity: 3,  // 3 USDC initial liquidity (real launch amount)
          liquidity: 3,           // current liquidity
          image_url: formData.image || null
        });

      if (dbError) {
        console.error("Database sync error:", dbError);
        alert("Transaction successful, but failed to sync with dashboard: " + dbError.message);
      } else {
        console.log("Database synced successfully!");
      }
      
      setStatus('success');
      
      // Reset after a few seconds
      setTimeout(() => {
        setStatus('idle');
        setFormData({ name: '', ticker: '', supply: '', image: '' });
      }, 5000);

    } catch (error: any) {
      console.error("Detailed Transaction Error:", error);
      setStatus('idle');
      // Show more specific error if available
      const errorMsg = error?.shortMessage || error?.message || "Transaction failed or was rejected.";
      alert(errorMsg);
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
          <label className="block text-sm text-gray-400 mb-1 text-left">Token Logo</label>
          <div className="flex items-center gap-4">
            <input 
              type="file" 
              accept="image/*"
              className="hidden"
              id="image-upload"
              onChange={handleImageUpload}
              disabled={status !== 'idle' || uploading}
            />
            <label 
              htmlFor="image-upload"
              className={`flex-1 cyber-input rounded-lg p-3 cursor-pointer text-center border-dashed border-2 ${
                uploading ? 'opacity-50' : 'hover:border-cyan-500'
              } flex items-center justify-center gap-2`}
            >
              {uploading ? (
                <Loader2 className="animate-spin size-4 text-cyan-400" />
              ) : formData.image ? (
                <span className="text-green-400 flex items-center gap-2">
                  <CheckCircle2 size={16} /> Image Selected
                </span>
              ) : (
                <span className="text-gray-500">Click to upload logo</span>
              )}
            </label>
            {formData.image && (
              <div className="w-12 h-12 rounded-lg border border-gray-700 overflow-hidden bg-black/40">
                <img src={formData.image} alt="Preview" className="w-full h-full object-contain p-0.5" />
              </div>
            )}
          </div>
        </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 my-4 text-xs font-semibold text-slate-500 space-y-2">
          <div className="flex justify-between text-slate-700">
            <span className="font-extrabold">Fixed Fee</span>
            <span className="font-black text-slate-900">4.00 USDC</span>
          </div>
          <div className="flex justify-between">
            <span className="font-medium">↳ Initial Liquidity (99% Supply)</span>
            <span className="text-blue-600 font-extrabold">3.00 USDC</span>
          </div>
          <div className="flex justify-between">
            <span className="font-medium">↳ Platform Treasury</span>
            <span className="text-amber-600 font-extrabold">1.00 USDC</span>
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
