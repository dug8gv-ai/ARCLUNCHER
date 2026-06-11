'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAccount, useWriteContract, usePublicClient, useReadContract } from 'wagmi';
import { formatUnits, parseUnits, erc20Abi } from 'viem';
import { PieChart, Clock, ShieldAlert, CheckCircle, Info, History, Upload, X, ImagePlus, Tag, AlignLeft, Zap, RefreshCw, DollarSign } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { PREDICTION_MARKET_ADDRESS, predictionMarketAbi } from '@/lib/predictionMarketAbi';
import { USDC_ADDRESS } from '@/lib/arcDefiAbi';
import { supabase } from '@/lib/supabase';
import { TaskCreatorWizard } from '@/components/TaskCreatorWizard';
import { BinaryTradingWizard } from '@/components/BinaryTradingWizard';

export function PredictionDashboard() {
  const { isConnected, address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [activeTab, setActiveTab] = useState<'feed' | 'history'>('feed');
  const [markets, setMarkets] = useState<any[]>([]);
  const [isLoadingMarkets, setIsLoadingMarkets] = useState(true);
  const [historyEvents, setHistoryEvents] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  
  // Read Admin
  const { data: adminAddress } = useReadContract({
    address: PREDICTION_MARKET_ADDRESS as `0x${string}`,
    abi: predictionMarketAbi,
    functionName: 'admin',
  });
  const isAdmin = isConnected && address?.toLowerCase() === (adminAddress as string)?.toLowerCase();

  // Read Next Market ID
  const { data: nextMarketIdRaw, refetch: refetchMarketId } = useReadContract({
    address: PREDICTION_MARKET_ADDRESS as `0x${string}`,
    abi: predictionMarketAbi,
    functionName: 'nextMarketId',
  });

  // Fetch Markets
  const fetchMarkets = async () => {
    if (!publicClient) return;
    setIsLoadingMarkets(true);
    try {
      const nextId = await publicClient.readContract({
        address: PREDICTION_MARKET_ADDRESS as `0x${string}`,
        abi: predictionMarketAbi,
        functionName: 'nextMarketId',
      });
      
      const count = Number(nextId);
      if (count === 0) {
        setMarkets([]);
        setIsLoadingMarkets(false);
        return;
      }

      const calls = [];
      for (let i = 0; i < count; i++) {
        calls.push({
          address: PREDICTION_MARKET_ADDRESS as `0x${string}`,
          abi: predictionMarketAbi,
          functionName: 'markets',
          args: [i],
        });
      }
      
      // Use Promise.all instead of multicall to support networks without Multicall3
      const rawResults = await Promise.allSettled(
        calls.map(call => publicClient.readContract(call as any))
      );
      
      const formattedMarkets = rawResults.map((res: any, index: number) => {
        if (res.status === 'fulfilled') {
          const data = res.value as any[];
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

  useEffect(() => {
    fetchMarkets();
  }, [publicClient, nextMarketIdRaw]);

  // Fetch History
  useEffect(() => {
    if (!address) return;
    const fetchHistory = async () => {
      setIsLoadingHistory(true);
      const { data } = await supabase
        .from('prediction_history')
        .select('*')
        .eq('wallet', address.toLowerCase())
        .order('created_at', { ascending: false });
      if (data) setHistoryEvents(data);
      setIsLoadingHistory(false);
    };

    fetchHistory();

    const sub = supabase
      .channel('prediction_history_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prediction_history', filter: `wallet=eq.${address.toLowerCase()}` }, fetchHistory)
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, [address]);
  
  const [betAmount, setBetAmount] = useState('');
  const [selectedMarketId, setSelectedMarketId] = useState<number | null>(null);
  const [selectedSide, setSelectedSide] = useState<1 | 2 | null>(null); // 1 = Yes, 2 = No
  
  // Admin form state
  const [newTitle, setNewTitle] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newExpiration, setNewExpiration] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCategory, setNewCategory] = useState('crypto');
  const [selectedCategory, setSelectedCategory] = useState('crypto');
  const [isUploading, setIsUploading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isBetting, setIsBetting] = useState(false);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const categories = [
    { value: 'crypto', label: '₿ Crypto', color: 'bg-orange-100 text-orange-700' },
    { value: 'defi', label: '🏦 DeFi', color: 'bg-[rgba(0,242,254,0.1)] text-[var(--accent-cyan)]' },
    { value: 'nft', label: '🖼️ NFT', color: 'bg-purple-100 text-purple-700' },
    { value: 'sports', label: '⚽ Sports', color: 'bg-green-100 text-green-700' },
    { value: 'politics', label: '🏛️ Politics', color: 'bg-red-100 text-red-700' },
    { value: 'tech', label: '💻 Tech', color: 'bg-cyan-100 text-cyan-700' },
    { value: 'entertainment', label: '🎬 Entertainment', color: 'bg-pink-100 text-pink-700' },
    { value: 'other', label: '🔮 Other', color: 'bg-[rgba(8,14,44,0.8)] text-[var(--text-primary)]' },
  ];

  const handleImageUpload = async (file: File) => {
    
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (PNG, JPG, GIF, WEBP)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB');
      return;
    }

    try {
      // Compress image client-side to base64
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Max width/height
          const MAX_SIZE = 400;
          if (width > height && width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          } else if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          const base64Url = canvas.toDataURL('image/jpeg', 0.6);
          setUploadPreview(base64Url);
          setNewImageUrl(base64Url);
          toast.success('Image compressed and attached!');
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Compression error:', error);
      toast.error('Upload failed. Try pasting a URL instead.');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleImageUpload(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const clearImage = () => {
    setUploadPreview(null);
    setNewImageUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const setQuickExpiration = (hours: number) => {
    const d = new Date(Date.now() + hours * 60 * 60 * 1000);
    const pad = (n: number) => n.toString().padStart(2, '0');
    setNewExpiration(`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
  };

  const calculateRatio = (yes: number, no: number) => {
    const total = yes + no;
    if (total === 0) return { yes: 50, no: 50 };
    return {
      yes: Math.round((yes / total) * 100),
      no: Math.round((no / total) * 100)
    };
  };

  const handleCreateMarket = async () => {
    if (!newTitle || !newExpiration) return toast.error("Please fill the market question and expiration date.");
    if (!isConnected) return toast.error("Please connect your wallet first.");

    setIsCreating(true);
    const expTimestamp = Math.floor(new Date(newExpiration).getTime() / 1000);
    const imageData = newImageUrl || '';
    
    try {
      const tx = await writeContractAsync({
        address: PREDICTION_MARKET_ADDRESS as `0x${string}`,
        abi: predictionMarketAbi,
        functionName: 'createMarket',
        args: [newTitle, imageData, BigInt(expTimestamp), USDC_ADDRESS as `0x${string}`],
      });
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: tx });
        toast.success("🎉 Market Created Successfully!");
        
        // Log to Supabase History safely
        try {
          const mId = Number(nextMarketIdRaw);
          await supabase.from('prediction_history').insert({
            wallet: address?.toLowerCase(),
            action_type: 'CREATE_MARKET',
            market_id: mId,
            details: { title: newTitle, category: selectedCategory || newCategory }
          });
        } catch (dbErr) {
          console.error("Supabase log error:", dbErr);
        }

        setNewTitle('');
        setNewDescription('');
        setSelectedCategory('');
        setNewImageUrl('');
        setUploadPreview(null);
        setNewExpiration('');
        
        setTimeout(async () => {
          await refetchMarketId();
          fetchMarkets();
        }, 6000);
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e.shortMessage || e.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handlePlaceBet = async (marketId: number) => {
    if (!isConnected) return toast.error("Please connect your wallet");
    if (!betAmount || Number(betAmount) <= 0) return toast.error("Enter valid amount");
    if (!selectedSide) return toast.error("Select Yes or No");
    
    setIsBetting(true);
    try {
       const amountWei = parseUnits(betAmount, 6);

       const approveTx = await writeContractAsync({
         address: USDC_ADDRESS as `0x${string}`,
         abi: erc20Abi,
         functionName: 'approve',
         args: [PREDICTION_MARKET_ADDRESS as `0x${string}`, amountWei],
       });
       if (publicClient) {
         await publicClient.waitForTransactionReceipt({ hash: approveTx });
       }

       const betTx = await writeContractAsync({
         address: PREDICTION_MARKET_ADDRESS as `0x${string}`,
         abi: predictionMarketAbi,
         functionName: 'placeBet',
         args: [BigInt(marketId), selectedSide, amountWei],
       });
       if (publicClient) {
         await publicClient.waitForTransactionReceipt({ hash: betTx });
         toast.success("Bet Placed Successfully!");
         
         // Log to Supabase safely
         try {
           const market = markets.find(m => m.id === marketId);
           await supabase.from('prediction_history').insert({
             wallet: address?.toLowerCase(),
             action_type: 'PLACE_BET',
             market_id: marketId,
             details: { title: market?.title, amount: betAmount, side: selectedSide === 1 ? 'YES' : 'NO' }
           });
         } catch (dbErr) {
           console.error("Supabase log error:", dbErr);
         }

         setBetAmount('');
         setSelectedMarketId(null);
         setSelectedSide(null);
         setTimeout(() => fetchMarkets(), 3000);
       }
    } catch (e: any) {
      console.error(e);
      toast.error("Bet Failed: " + (e.shortMessage || e.message));
    } finally {
      setIsBetting(false);
    }
  };

  const handleClaimReward = async (marketId: number) => {
    if (!isConnected) return toast.error("Please connect your wallet");
    try {
      const claimTx = await writeContractAsync({
        address: PREDICTION_MARKET_ADDRESS as `0x${string}`,
        abi: predictionMarketAbi,
        functionName: 'claimReward',
        args: [BigInt(marketId)],
      });
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: claimTx });
        toast.success("Reward Claimed!");
        
        // Log to Supabase safely
        try {
          const market = markets.find(m => m.id === marketId);
          await supabase.from('prediction_history').insert({
            wallet: address?.toLowerCase(),
            action_type: 'CLAIM_REWARD',
            market_id: marketId,
            details: { title: market?.title }
          });
        } catch (dbErr) {
          console.error("Supabase log error:", dbErr);
        }

        setTimeout(() => fetchMarkets(), 3000);
      }
    } catch (e: any) {
      console.error(e);
      toast.error("Claim Failed: " + (e.shortMessage || e.message));
    }
  };

  const handleResolveMarket = async (marketId: number, winningSide: 1 | 2) => {
    if (!isAdmin) return;
    try {
      const hash = await writeContractAsync({
        address: PREDICTION_MARKET_ADDRESS as `0x${string}`,
        abi: predictionMarketAbi,
        functionName: 'resolveMarket',
        args: [BigInt(marketId), winningSide],
      });
      if (hash) {
        toast.success("Market Resolved!");
        setTimeout(() => fetchMarkets(), 3000);
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e.shortMessage || e.message);
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
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 card rounded-[32px] p-6 shadow-sm"
      >
        <div>
          <h2 className="text-2xl font-black text-[var(--text-primary)] flex items-center gap-2">
            <PieChart className="text-[var(--accent-cyan)]" /> Prediction Markets
          </h2>
          <p className="text-xs text-[var(--text-secondary)] font-semibold mt-0.5">Bet on future events, claim rewards, and build your track record.</p>
        </div>
        
        <div className="flex gap-2 bg-slate-100 p-1 rounded-2xl">
          <button 
            onClick={() => setActiveTab('feed')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'feed' ? 'card shadow-sm text-[var(--accent-cyan)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
          >
            Live Feed
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'history' ? 'card shadow-sm text-[var(--accent-cyan)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
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
                <div className="text-center py-10 text-[var(--text-secondary)] font-bold animate-pulse">Loading Markets from blockchain...</div>
              ) : markets.filter(m => m.state !== 2).length === 0 ? (
                <div className="card rounded-[24px] p-8 text-center shadow-sm">
                  <PieChart className="mx-auto text-slate-300 mb-3" size={40} />
                  <h3 className="text-lg font-black text-[var(--text-primary)]">No Markets Live</h3>
                  <p className="text-xs text-[var(--text-secondary)] font-semibold mt-1">Check back later for new predictions.</p>
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
                    className="card rounded-[24px] p-6 shadow-sm transition-all hover:shadow-md"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-16 h-16 rounded-2xl overflow-hidden bg-[var(--bg-card)] border border-[var(--border-dim)] flex-shrink-0">
                        {market.imageUrl ? <img src={market.imageUrl} className="w-full h-full object-contain p-0.5" alt="" /> : <PieChart className="w-8 h-8 m-4 text-slate-300" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <h3 className="font-extrabold text-[var(--text-primary)] text-lg leading-tight">{market.title}</h3>
                          <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg ${isExpired ? 'bg-slate-100 text-[var(--text-secondary)]' : 'bg-emerald-100 text-emerald-700'}`}>
                            {market.state === 1 ? 'Resolved' : isExpired ? 'Ended' : 'Active'}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-4 mt-3 text-xs font-semibold text-[var(--text-secondary)]">
                          <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-md">
                            <Clock size={14} className="text-[var(--text-secondary)]" />
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
                        <span className="text-[var(--accent-cyan)]">Yes {ratios.yes}%</span>
                        <span className="text-red-500">{ratios.no}% No</span>
                      </div>
                      <div className="w-full h-3 rounded-full flex overflow-hidden bg-slate-100">
                        <div className="h-full bg-[rgba(0,242,254,0.05)]0 transition-all duration-500" style={{ width: `${ratios.yes}%` }}></div>
                        <div className="h-full bg-red-500 transition-all duration-500" style={{ width: `${ratios.no}%` }}></div>
                      </div>
                    </div>

                    {/* Action Area */}
                    <div className="mt-6 pt-5 border-t border-[var(--border-dim)]">
                      {market.state === 0 && !isExpired ? (
                        <div className="space-y-4">
                          <div className="flex gap-3">
                            <button 
                              onClick={() => { setSelectedMarketId(market.id); setSelectedSide(1); }}
                              className={`flex-1 py-2.5 rounded-xl text-sm font-black border transition-all ${selectedMarketId === market.id && selectedSide === 1 ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20' : 'bg-[var(--bg-card)] text-[var(--accent-cyan)] border-[var(--border-dim)] hover:bg-[rgba(0,242,254,0.05)]'}`}
                            >
                              👍 YES
                            </button>
                            <button 
                              onClick={() => { setSelectedMarketId(market.id); setSelectedSide(2); }}
                              className={`flex-1 py-2.5 rounded-xl text-sm font-black border transition-all ${selectedMarketId === market.id && selectedSide === 2 ? 'bg-red-500 text-white border-red-500 shadow-md shadow-red-500/20' : 'bg-[var(--bg-card)] text-red-500 border-red-200 hover:bg-red-50'}`}
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
                                className="flex-1 bg-[var(--bg-card)] border border-[var(--border-dim)] rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:border-blue-500"
                              />
                              <button 
                                onClick={() => handlePlaceBet(market.id)}
                                className="bg-[var(--bg-card)] hover:bg-slate-800 text-white font-bold py-2.5 px-6 rounded-xl text-sm transition-all"
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
                              {market.winningSide === 1 ? <span className="text-[var(--accent-cyan)]">YES</span> : market.winningSide === 2 ? <span className="text-red-500">NO</span> : <span className="text-[var(--text-secondary)]">Pending Admin Resolution</span>}
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
            <div className="card rounded-[24px] p-6 shadow-sm min-h-[400px]">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-[var(--text-secondary)]">
                  <History size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-[var(--text-primary)]">My History</h3>
                  <p className="text-xs text-[var(--text-secondary)] font-semibold">Your recent interactions on Prediction Markets.</p>
                </div>
              </div>

              {isLoadingHistory ? (
                <div className="text-center py-10">
                  <RefreshCw className="mx-auto text-slate-300 animate-spin mb-2" size={24} />
                  <p className="text-sm text-[var(--text-secondary)]">Loading history...</p>
                </div>
              ) : historyEvents.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-[var(--text-secondary)] font-bold">No history found.</p>
                  <p className="text-sm text-[var(--text-secondary)] mt-1">Place a bet or create a market to see activity here.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {historyEvents.map((evt) => (
                    <div key={evt.id} className="flex items-start gap-4 p-4 border border-[var(--border-dim)] rounded-xl hover:bg-slate-50 transition-colors">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                        evt.action_type === 'CREATE_MARKET' ? 'bg-indigo-100 text-indigo-600' : 
                        evt.action_type === 'PLACE_BET' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
                      }`}>
                        {evt.action_type === 'CREATE_MARKET' ? <Zap size={18} /> : 
                         evt.action_type === 'PLACE_BET' ? <DollarSign size={18} /> : <CheckCircle size={18} />}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-200 text-[var(--text-primary)]">
                            {evt.action_type === 'CREATE_MARKET' ? 'Created Market' : 
                             evt.action_type === 'PLACE_BET' ? 'Placed Bet' : 'Claimed Reward'}
                          </span>
                          <span className="text-[10px] font-semibold text-[var(--text-secondary)]">
                            {new Date(evt.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm font-bold text-[var(--text-primary)] leading-snug">
                          {evt.details?.title || `Market #${evt.market_id}`}
                        </p>
                        {evt.action_type === 'PLACE_BET' && (
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs font-bold text-[var(--text-secondary)]">Bet Amount:</span>
                            <span className="text-xs font-black text-[var(--text-primary)]">${evt.details?.amount}</span>
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-sm ${evt.details?.side === 'YES' ? 'bg-[rgba(0,242,254,0.1)] text-[var(--accent-cyan)]' : 'bg-red-100 text-red-700'}`}>
                              {evt.details?.side}
                            </span>
                          </div>
                        )}
                        {evt.action_type === 'CREATE_MARKET' && evt.details?.category && (
                          <div className="mt-2 text-xs font-semibold text-[var(--text-secondary)]">
                            Category: {evt.details?.category}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Sidebar — Task Creator Wizard */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="lg:col-span-1"
        >
          <div className="sticky top-8 space-y-4">
            <BinaryTradingWizard onTaskCreated={() => { setTimeout(() => fetchMarkets(), 4000); }} />
          </div>
        </motion.div>

      </div>
    </motion.div>
  );
}
