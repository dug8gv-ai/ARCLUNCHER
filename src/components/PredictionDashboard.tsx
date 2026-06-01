'use client';

import React, { useState, useEffect } from 'react';
import { useAccount, useWriteContract, usePublicClient, useReadContract } from 'wagmi';
import { formatUnits, parseUnits, erc20Abi } from 'viem';
import { PieChart, Clock, ShieldAlert, CheckCircle, Info, History } from 'lucide-react';
import { motion } from 'framer-motion';
import { PREDICTION_MARKET_ADDRESS, predictionMarketAbi } from '@/lib/predictionMarketAbi';
import { USDC_ADDRESS } from '@/lib/arcDefiAbi';

export function PredictionDashboard() {
  const { isConnected, address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [activeTab, setActiveTab] = useState<'feed' | 'history'>('feed');
  const [markets, setMarkets] = useState<any[]>([]);
  const [isLoadingMarkets, setIsLoadingMarkets] = useState(true);
  
  // Read Admin
  const { data: adminAddress } = useReadContract({
    address: PREDICTION_MARKET_ADDRESS as `0x${string}`,
    abi: predictionMarketAbi,
    functionName: 'admin',
  });
  const isAdmin = isConnected && address?.toLowerCase() === (adminAddress as string)?.toLowerCase();

  // Read Next Market ID
  const { data: nextMarketIdRaw } = useReadContract({
    address: PREDICTION_MARKET_ADDRESS as `0x${string}`,
    abi: predictionMarketAbi,
    functionName: 'nextMarketId',
  });

  // Fetch Markets
  useEffect(() => {
    const fetchMarkets = async () => {
      if (!publicClient || nextMarketIdRaw === undefined) return;
      const count = Number(nextMarketIdRaw);
      if (count === 0) {
        setMarkets([]);
        setIsLoadingMarkets(false);
        return;
      }

      try {
        const calls = [];
        for (let i = 0; i < count; i++) {
          calls.push({
            address: PREDICTION_MARKET_ADDRESS as `0x${string}`,
            abi: predictionMarketAbi,
            functionName: 'markets',
            args: [i],
          });
        }
        
        // Use multicall
        const results = await publicClient.multicall({ contracts: calls });
        
        const formattedMarkets = results.map((res: any, index: number) => {
          if (res.status === 'success') {
            const data = res.result as any[];
            return {
              id: index,
              title: data[0],
              imageUrl: data[1],
              expirationTime: Number(data[2]) * 1000, // JS timestamp
              resolvedTime: Number(data[3]) * 1000,
              totalYesPool: Number(formatUnits(data[4], 6)), // assuming USDC
              totalNoPool: Number(formatUnits(data[5], 6)),
              state: data[6], // 0 Active, 1 Resolved, 2 Deleted
              winningSide: data[7], // 0 None, 1 Yes, 2 No
              token: data[8]
            };
          }
          return null;
        }).filter(Boolean);

        setMarkets(formattedMarkets);
      } catch (e) {
        console.error("Error fetching markets", e);
      } finally {
        setIsLoadingMarkets(false);
      }
    };

    fetchMarkets();
  }, [publicClient, nextMarketIdRaw]);
  
  const [betAmount, setBetAmount] = useState('');
  const [selectedMarketId, setSelectedMarketId] = useState<number | null>(null);
  const [selectedSide, setSelectedSide] = useState<1 | 2 | null>(null); // 1 = Yes, 2 = No
  
  // Admin form state
  const [newTitle, setNewTitle] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newExpiration, setNewExpiration] = useState('');

  const calculateRatio = (yes: number, no: number) => {
    const total = yes + no;
    if (total === 0) return { yes: 50, no: 50 };
    return {
      yes: Math.round((yes / total) * 100),
      no: Math.round((no / total) * 100)
    };
  };

  const handleCreateTask = async () => {
    if (!isAdmin) return alert("Viewing Mode Only: Admin rights required.");
    if (!newTitle || !newExpiration) return alert("Please fill title and expiration");

    const expTimestamp = Math.floor(new Date(newExpiration).getTime() / 1000);
    
    try {
      const tx = await writeContractAsync({
        address: PREDICTION_MARKET_ADDRESS as `0x${string}`,
        abi: predictionMarketAbi,
        functionName: 'createMarket',
        args: [newTitle, newImageUrl, BigInt(expTimestamp), USDC_ADDRESS as `0x${string}`],
      });
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: tx });
        alert("Market Created Successfully!");
        setNewTitle('');
        setNewImageUrl('');
        setNewExpiration('');
      }
    } catch (e: any) {
      console.error(e);
      alert(e.shortMessage || e.message);
    }
  };

  const handlePlaceBet = async (marketId: number) => {
    if (!isConnected) return alert("Please connect your wallet");
    if (!betAmount || Number(betAmount) <= 0) return alert("Enter valid amount");
    if (!selectedSide) return alert("Select Yes or No");
    
    try {
       const amountWei = parseUnits(betAmount, 6); // Assuming USDC 6 decimals

       // 1. Approve
       const approveTx = await writeContractAsync({
         address: USDC_ADDRESS as `0x${string}`,
         abi: erc20Abi,
         functionName: 'approve',
         args: [PREDICTION_MARKET_ADDRESS as `0x${string}`, amountWei],
       });
       if (publicClient) {
         await publicClient.waitForTransactionReceipt({ hash: approveTx });
       }

       // 2. Bet
       const betTx = await writeContractAsync({
         address: PREDICTION_MARKET_ADDRESS as `0x${string}`,
         abi: predictionMarketAbi,
         functionName: 'placeBet',
         args: [BigInt(marketId), selectedSide, amountWei],
       });
       if (publicClient) {
         await publicClient.waitForTransactionReceipt({ hash: betTx });
         alert("Bet Placed Successfully!");
         setBetAmount('');
         setSelectedMarketId(null);
         setSelectedSide(null);
       }
    } catch (e: any) {
      console.error(e);
      alert("Bet Failed: " + (e.shortMessage || e.message));
    }
  };

  const handleClaimReward = async (marketId: number) => {
    if (!isConnected) return alert("Please connect your wallet");
    try {
      const claimTx = await writeContractAsync({
        address: PREDICTION_MARKET_ADDRESS as `0x${string}`,
        abi: predictionMarketAbi,
        functionName: 'claimReward',
        args: [BigInt(marketId)],
      });
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: claimTx });
        alert("Reward Claimed Successfully!");
      }
    } catch (e: any) {
      console.error(e);
      alert("Claim Failed: " + (e.shortMessage || e.message));
    }
  };

  const handleResolveMarket = async (marketId: number, winningSide: 1 | 2) => {
    if (!isAdmin) return;
    try {
      const resolveTx = await writeContractAsync({
        address: PREDICTION_MARKET_ADDRESS as `0x${string}`,
        abi: predictionMarketAbi,
        functionName: 'resolveMarket',
        args: [BigInt(marketId), winningSide],
      });
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: resolveTx });
        alert("Market Resolved!");
      }
    } catch (e: any) {
      console.error(e);
      alert(e.shortMessage || e.message);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="space-y-8"
    >
      
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200/80 rounded-[32px] p-6 shadow-sm"
      >
        <div>
          <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <PieChart className="text-blue-600" /> Prediction Markets
          </h2>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">Bet on future events, claim rewards, and build your track record.</p>
        </div>
        
        <div className="flex gap-2 bg-slate-100 p-1 rounded-2xl">
          <button 
            onClick={() => setActiveTab('feed')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'feed' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Live Feed
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'history' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
          >
            My History
          </button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-6">
          {activeTab === 'feed' && (
            <div className="space-y-6">
              {isLoadingMarkets ? (
                <div className="text-center py-10 text-slate-500 font-bold animate-pulse">Loading Markets from blockchain...</div>
              ) : markets.filter(m => m.state !== 2).length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-[24px] p-8 text-center shadow-sm">
                  <PieChart className="mx-auto text-slate-300 mb-3" size={40} />
                  <h3 className="text-lg font-black text-slate-800">No Markets Live</h3>
                  <p className="text-xs text-slate-500 font-semibold mt-1">Check back later for new predictions.</p>
                </div>
              ) : markets.filter(m => m.state !== 2).map((market: any, index: number) => {
                const ratios = calculateRatio(market.totalYesPool, market.totalNoPool);
                const isExpired = Date.now() > market.expirationTime;

                return (
                  <motion.div
                    key={market.id}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.08 }}
                    className="bg-white border border-slate-200 rounded-[24px] p-6 shadow-sm transition-all hover:shadow-md"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-16 h-16 rounded-2xl overflow-hidden bg-slate-50 border border-slate-100 flex-shrink-0">
                        {market.imageUrl ? <img src={market.imageUrl} className="w-full h-full object-contain p-0.5" alt="" /> : <PieChart className="w-8 h-8 m-4 text-slate-300" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <h3 className="font-extrabold text-slate-800 text-lg leading-tight">{market.title}</h3>
                          <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg ${isExpired ? 'bg-slate-100 text-slate-500' : 'bg-emerald-100 text-emerald-700'}`}>
                            {market.state === 1 ? 'Resolved' : isExpired ? 'Ended' : 'Active'}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-4 mt-3 text-xs font-semibold text-slate-500">
                          <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-md">
                            <Clock size={14} className="text-slate-400" />
                            {isExpired ? 'Expired' : new Date(market.expirationTime).toLocaleString()}
                          </div>
                          <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-md">
                            💰 {(market.totalYesPool + market.totalNoPool).toLocaleString()} USDC Pool
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-5 space-y-2">
                      <div className="flex justify-between text-xs font-black">
                        <span className="text-blue-600">Yes {ratios.yes}%</span>
                        <span className="text-red-500">{ratios.no}% No</span>
                      </div>
                      <div className="w-full h-3 rounded-full flex overflow-hidden bg-slate-100">
                        <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${ratios.yes}%` }}></div>
                        <div className="h-full bg-red-500 transition-all duration-500" style={{ width: `${ratios.no}%` }}></div>
                      </div>
                    </div>

                    {/* Action Area */}
                    <div className="mt-6 pt-5 border-t border-slate-100">
                      {market.state === 0 && !isExpired ? (
                        <div className="space-y-4">
                          <div className="flex gap-3">
                            <button 
                              onClick={() => { setSelectedMarketId(market.id); setSelectedSide(1); }}
                              className={`flex-1 py-2.5 rounded-xl text-sm font-black border transition-all ${selectedMarketId === market.id && selectedSide === 1 ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20' : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50'}`}
                            >
                              👍 YES
                            </button>
                            <button 
                              onClick={() => { setSelectedMarketId(market.id); setSelectedSide(2); }}
                              className={`flex-1 py-2.5 rounded-xl text-sm font-black border transition-all ${selectedMarketId === market.id && selectedSide === 2 ? 'bg-red-500 text-white border-red-500 shadow-md shadow-red-500/20' : 'bg-white text-red-500 border-red-200 hover:bg-red-50'}`}
                            >
                              👎 NO
                            </button>
                          </div>
                          
                          {selectedMarketId === market.id && selectedSide && (
                            <div className="flex items-center gap-3 animate-in slide-in-from-top-2">
                              <input 
                                type="number" 
                                placeholder="Amount in USDC"
                                value={betAmount}
                                onChange={(e) => setBetAmount(e.target.value)}
                                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:border-blue-500"
                              />
                              <button 
                                onClick={() => handlePlaceBet(market.id)}
                                className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-6 rounded-xl text-sm transition-all"
                              >
                                Submit Tx
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm font-bold">
                              Winning Side: 
                              {market.winningSide === 1 ? <span className="text-blue-600">YES</span> : market.winningSide === 2 ? <span className="text-red-500">NO</span> : <span className="text-slate-500">Pending Admin Resolution</span>}
                            </div>
                            {market.state === 1 && (
                              <button 
                                onClick={() => handleClaimReward(market.id)}
                                className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white text-xs font-bold py-2 px-4 rounded-xl shadow-md transition-all flex items-center gap-1.5"
                              >
                                <CheckCircle size={14} /> Claim Reward
                              </button>
                            )}
                          </div>
                          
                          {/* Admin Resolution Area */}
                          {isAdmin && market.state === 0 && isExpired && (
                            <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex items-center justify-between">
                              <span className="text-xs font-bold text-amber-800">Admin: Resolve Market</span>
                              <div className="flex gap-2">
                                <button onClick={() => handleResolveMarket(market.id, 1)} className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded-lg font-bold">Set YES</button>
                                <button onClick={() => handleResolveMarket(market.id, 2)} className="bg-red-500 text-white text-xs px-3 py-1.5 rounded-lg font-bold">Set NO</button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="bg-white border border-slate-200 rounded-[24px] p-8 text-center shadow-sm">
              <History className="mx-auto text-slate-300 mb-3" size={40} />
              <h3 className="text-lg font-black text-slate-800">Transaction History</h3>
              <p className="text-xs text-slate-500 font-semibold mt-1">Check your wallet explorer for recent interactions.</p>
            </div>
          )}
        </div>

        {/* Right Sidebar - Admin Controls */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="lg:col-span-1"
          >
          <div className="bg-white border border-slate-200 rounded-[24px] p-6 shadow-sm sticky top-8">
            <div className="flex items-center gap-2 mb-4">
              <ShieldAlert className={isAdmin ? "text-emerald-500" : "text-amber-500"} size={18} />
              <h3 className="font-extrabold text-slate-800">Admin Controls</h3>
            </div>
            
            {!isAdmin && (
              <div className="bg-amber-50 text-amber-800 text-[11px] font-bold p-3 rounded-xl border border-amber-200/50 flex items-start gap-2 mb-5">
                <Info size={14} className="mt-0.5 flex-shrink-0" />
                <p>Public Launch Pending - Viewing Mode Only. Task creation and resolution are restricted to the Protocol Admin.</p>
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Market Question</label>
                <input 
                  disabled={!isAdmin}
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  type="text" 
                  placeholder="e.g. Will ETH reach $4000?" 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold outline-none focus:border-blue-500 disabled:opacity-50"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Image URL</label>
                <input 
                  disabled={!isAdmin}
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  type="text" 
                  placeholder="https://..." 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold outline-none focus:border-blue-500 disabled:opacity-50"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Expiration Date</label>
                <input 
                  disabled={!isAdmin}
                  value={newExpiration}
                  onChange={(e) => setNewExpiration(e.target.value)}
                  type="datetime-local" 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold outline-none focus:border-blue-500 disabled:opacity-50"
                />
              </div>
              
              <button 
                disabled={!isAdmin}
                onClick={handleCreateTask}
                className="w-full mt-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-black py-3 rounded-xl transition-all"
              >
                Create Market
              </button>
            </div>
          </div>
          </motion.div>

      </div>
    </motion.div>
  );
}
