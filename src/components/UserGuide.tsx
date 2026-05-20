'use client';

import { useState } from 'react';
import { BookOpen, Coins, Send, Rocket, TrendingUp, CheckCircle, PlusCircle, AlertCircle, Info } from 'lucide-react';
import { USDC_ADDRESS, EURC_ADDRESS } from '@/lib/arcDefiAbi';

export default function UserGuide() {
  const [addingUsdc, setAddingUsdc] = useState(false);
  const [addingEurc, setAddingEurc] = useState(false);
  const [addStatus, setAddStatus] = useState<{ token: string, status: 'success' | 'error' | null }>({ token: '', status: null });

  const handleAddToWallet = async (tokenSymbol: string, tokenAddress: string) => {
    if (tokenSymbol === 'USDC') setAddingUsdc(true);
    if (tokenSymbol === 'EURC') setAddingEurc(true);
    setAddStatus({ token: '', status: null });

    try {
      if (typeof window.ethereum !== 'undefined') {
        const wasAdded = await window.ethereum.request({
          method: 'wallet_watchAsset',
          params: {
            type: 'ERC20',
            options: {
              address: tokenAddress,
              symbol: tokenSymbol,
              decimals: 6,
            },
          },
        });

        if (wasAdded) {
          setAddStatus({ token: tokenSymbol, status: 'success' });
        } else {
          setAddStatus({ token: tokenSymbol, status: 'error' });
        }
      } else {
        alert('Web3 wallet (like MetaMask) is not detected. Please install one to use this feature.');
      }
    } catch (error) {
      console.error(`Error adding ${tokenSymbol} to wallet:`, error);
      setAddStatus({ token: tokenSymbol, status: 'error' });
    } finally {
      if (tokenSymbol === 'USDC') setAddingUsdc(false);
      if (tokenSymbol === 'EURC') setAddingEurc(false);
      
      // Clear status after 3 seconds
      setTimeout(() => setAddStatus({ token: '', status: null }), 3000);
    }
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <BookOpen size={120} />
        </div>
        <div className="relative z-10">
          <h1 className="text-3xl font-black mb-2 flex items-center gap-3">
            <BookOpen className="text-indigo-200" />
            Arc Launcher Guide
          </h1>
          <p className="text-indigo-100 max-w-2xl text-sm leading-relaxed font-medium">
            Welcome to the ultimate hub for decentralized finance on the ARC Testnet. This guide will walk you through everything you need to know to swap, send, launch, and trade assets seamlessly.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* CircleBridge */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-all">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-4">
            <Coins size={24} />
          </div>
          <h2 className="text-lg font-black text-slate-800 mb-2">1. Circle Bridge & Swaps</h2>
          <p className="text-sm text-slate-500 mb-4 leading-relaxed">
            The Financial Layer allows you to instantly swap between Native USDC and EURC stablecoins. 
            Because ARC Testnet uses USDC natively, you can swap it directly for EURC with very low fees.
          </p>
          <ul className="text-xs text-slate-600 space-y-2 font-medium">
            <li className="flex items-start gap-2">
              <CheckCircle size={14} className="text-green-500 mt-0.5 shrink-0" />
              <span>Swap USDC to EURC (or vice versa) instantly via our liquidity pools.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle size={14} className="text-green-500 mt-0.5 shrink-0" />
              <span>Cross-chain compatible design using standard ERC-20 structures.</span>
            </li>
          </ul>
        </div>

        {/* SocialPay */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-all">
          <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center mb-4">
            <Send size={24} />
          </div>
          <h2 className="text-lg font-black text-slate-800 mb-2">2. SocialPay</h2>
          <p className="text-sm text-slate-500 mb-4 leading-relaxed">
            Forget complex wallet addresses. SocialPay lets you send USDC, EURC, or any ARC token directly to your friends using their connected Discord or Twitter handles.
          </p>
          <ul className="text-xs text-slate-600 space-y-2 font-medium">
            <li className="flex items-start gap-2">
              <CheckCircle size={14} className="text-green-500 mt-0.5 shrink-0" />
              <span>Send funds by searching @username.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle size={14} className="text-green-500 mt-0.5 shrink-0" />
              <span>Standard 0x... address transfers are also fully supported.</span>
            </li>
          </ul>
        </div>

        {/* Token Launchpad */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-all">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-4">
            <Rocket size={24} />
          </div>
          <h2 className="text-lg font-black text-slate-800 mb-2">3. Arc Token Launchpad</h2>
          <p className="text-sm text-slate-500 mb-4 leading-relaxed">
            Deploy your own cryptocurrency in seconds. The Launchpad handles the complex smart contract compilation behind the scenes.
          </p>
          <ul className="text-xs text-slate-600 space-y-2 font-medium">
            <li className="flex items-start gap-2">
              <CheckCircle size={14} className="text-green-500 mt-0.5 shrink-0" />
              <span>Set your Token Name, Symbol, and Initial Supply.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle size={14} className="text-green-500 mt-0.5 shrink-0" />
              <span>Deploy securely to the ARC Testnet instantly.</span>
            </li>
          </ul>
        </div>

        {/* Trading & Airdrops */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-all">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-4">
            <TrendingUp size={24} />
          </div>
          <h2 className="text-lg font-black text-slate-800 mb-2">4. Trading & Airdrops</h2>
          <p className="text-sm text-slate-500 mb-4 leading-relaxed">
            Trade top assets on the decentralized exchange and climb the leaderboard. Engaging with the platform earns you valuable ARCL points.
          </p>
          <ul className="text-xs text-slate-600 space-y-2 font-medium">
            <li className="flex items-start gap-2">
              <CheckCircle size={14} className="text-green-500 mt-0.5 shrink-0" />
              <span>Earn ARCL Airdrop points for every transaction.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle size={14} className="text-green-500 mt-0.5 shrink-0" />
              <span>Check your rank on the live community leaderboard.</span>
            </li>
          </ul>
        </div>

      </div>

      {/* Add to Wallet Section */}
      <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-3xl p-6 mt-8">
        <div className="flex items-center gap-2 mb-4">
          <Info className="text-slate-500" size={20} />
          <h2 className="text-lg font-black text-slate-800">Official Token Contracts</h2>
        </div>
        <p className="text-sm text-slate-500 mb-6 font-medium">
          To see your USDC and EURC balances correctly in your Web3 wallet (like MetaMask), you need to import their contract addresses. Click the buttons below to automatically add them.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* USDC Add */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-sm">
            <div>
              <div className="font-black text-slate-800 text-sm">USDC (USD Coin)</div>
              <div className="text-[10px] font-mono text-slate-500 mt-1 truncate max-w-[150px] sm:max-w-[200px]">{USDC_ADDRESS}</div>
            </div>
            <button
              onClick={() => handleAddToWallet('USDC', USDC_ADDRESS)}
              disabled={addingUsdc}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2
                ${addStatus.token === 'USDC' && addStatus.status === 'success' ? 'bg-green-100 text-green-700' : 
                  addStatus.token === 'USDC' && addStatus.status === 'error' ? 'bg-red-100 text-red-700' :
                  'bg-blue-600 hover:bg-blue-700 text-white shadow-md'}`}
            >
              {addingUsdc ? 'Adding...' : 
               addStatus.token === 'USDC' && addStatus.status === 'success' ? <><CheckCircle size={14} /> Added</> :
               addStatus.token === 'USDC' && addStatus.status === 'error' ? <><AlertCircle size={14} /> Failed</> :
               <><PlusCircle size={14} /> Add to Wallet</>}
            </button>
          </div>

          {/* EURC Add */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-sm">
            <div>
              <div className="font-black text-slate-800 text-sm">EURC (Euro Coin)</div>
              <div className="text-[10px] font-mono text-slate-500 mt-1 truncate max-w-[150px] sm:max-w-[200px]">{EURC_ADDRESS}</div>
            </div>
            <button
              onClick={() => handleAddToWallet('EURC', EURC_ADDRESS)}
              disabled={addingEurc}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2
                ${addStatus.token === 'EURC' && addStatus.status === 'success' ? 'bg-green-100 text-green-700' : 
                  addStatus.token === 'EURC' && addStatus.status === 'error' ? 'bg-red-100 text-red-700' :
                  'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md'}`}
            >
              {addingEurc ? 'Adding...' : 
               addStatus.token === 'EURC' && addStatus.status === 'success' ? <><CheckCircle size={14} /> Added</> :
               addStatus.token === 'EURC' && addStatus.status === 'error' ? <><AlertCircle size={14} /> Failed</> :
               <><PlusCircle size={14} /> Add to Wallet</>}
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
