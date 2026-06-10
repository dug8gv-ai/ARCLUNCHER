'use client';

import { useState, useEffect } from 'react';
import { useAccount, useSendTransaction, usePublicClient, useWriteContract, useWalletClient } from 'wagmi';
import { parseUnits, erc20Abi, isAddress } from 'viem';
import { supabase } from '@/lib/supabase';
import { Search, Send, QrCode, Copy, Check, Users, Loader2, DollarSign, Wallet, ArrowRight, Info, HelpCircle, History, ExternalLink, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { SocialPayHistory } from '@/components/SocialPayHistory';
import { USDC_ADDRESS } from '@/lib/arcDefiAbi';
import { appKitSend, createBrowserAdapter } from '@/lib/appKit';

interface RecipientProfile {
  wallet: string;
  name: string;
  avatar: string;
  discord?: string;
  twitter?: string;
}

export function SocialPay() {
  const { isConnected, address: userAddress } = useAccount();
  const publicClient = usePublicClient();
  const { sendTransactionAsync } = useSendTransaction();
  const { writeContractAsync } = useWriteContract();
  const { data: walletClient } = useWalletClient();

  // Connected Profile (For QR code & link)
  const [myProfile, setMyProfile] = useState<RecipientProfile | null>(null);

  // Search recipient states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<RecipientProfile[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<RecipientProfile | null>(null);
  
  // Custom wallet input fallback
  const [customWalletAddress, setCustomWalletAddress] = useState('');

  // Asset selection states
  const [tokensList, setTokensList] = useState<any[]>([]);
  const [selectedAssetType, setSelectedAssetType] = useState<'USDC' | 'LAUNCHED' | 'CUSTOM' | 'NATIVE'>('USDC');
  const [selectedMemeToken, setSelectedMemeToken] = useState<any>(null);
  
  // Custom token input details
  const [customTokenAddress, setCustomTokenAddress] = useState('');
  const [customTokenSymbol, setCustomTokenSymbol] = useState('');
  const [customTokenDecimals, setCustomTokenDecimals] = useState(18);
  const [customTokenLoading, setCustomTokenLoading] = useState(false);

  // Transfer forms
  const [sendAmount, setSendAmount] = useState('');
  const [txStatus, setTxStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [successTxHash, setSuccessTxHash] = useState('');

  // Copy alerts
  const [copiedWallet, setCopiedWallet] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedRecipient, setCopiedRecipient] = useState(false);

  // Alerts
  const [alertInfo, setAlertInfo] = useState<{ title: string; message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const triggerAlert = (title: string, message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setAlertInfo({ title, message, type });
  };

  // Tabs
  const [activeTab, setActiveTab] = useState<'pay' | 'history'>('pay');
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchHistory = async () => {
    if (!userAddress) return;
    try {
      setHistoryLoading(true);
      const walletLower = userAddress.toLowerCase();
      // Fetch transactions where user is sender or receiver
      const { data, error } = await supabase
        .from('social_transactions')
        .select('*')
        .or(`sender_wallet.eq.${walletLower},receiver_wallet.eq.${walletLower}`)
        .order('created_at', { ascending: false });
        
      if (!error && data) {
        // Fetch profiles for the counterparties
        const counterparties = new Set<string>();
        data.forEach(tx => {
          if (tx.sender_wallet !== walletLower) counterparties.add(tx.sender_wallet);
          if (tx.receiver_wallet !== walletLower) counterparties.add(tx.receiver_wallet);
        });

        let profilesMap: Record<string, any> = {};
        if (counterparties.size > 0) {
          const { data: profData } = await supabase
            .from('profiles')
            .select('*')
            .in('wallet', Array.from(counterparties));
          if (profData) {
            profData.forEach(p => {
              profilesMap[p.wallet] = p;
            });
          }
        }

        const enrichedHistory = data.map(tx => {
          const isSent = tx.sender_wallet === walletLower;
          const counterpartyWallet = isSent ? tx.receiver_wallet : tx.sender_wallet;
          const profile = profilesMap[counterpartyWallet] || { 
            name: 'Anonymous', 
            avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${counterpartyWallet}` 
          };
          return {
            ...tx,
            isSent,
            counterpartyProfile: profile,
            counterpartyWallet
          };
        });
        
        setHistory(enrichedHistory);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history' && userAddress) {
      fetchHistory();
    }
  }, [activeTab, userAddress]);

  // Fetch tokens list from platform Launches
  const fetchLaunchedTokens = async () => {
    try {
      const { data, error } = await supabase
        .from('token_launches')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) {
        setTokensList(data);
      }
    } catch (err) {
      console.error('Error fetching launched tokens for pay:', err);
    }
  };

  // Fetch my profile for QR
  const fetchMyProfile = async () => {
    if (!userAddress) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('wallet', userAddress.toLowerCase())
        .single();
      if (data && !error) {
        setMyProfile({
          wallet: data.wallet,
          name: data.name || 'Anonymous',
          avatar: data.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${userAddress.toLowerCase()}`,
          discord: data.discord,
          twitter: data.twitter
        });
      } else {
        setMyProfile({
          wallet: userAddress.toLowerCase(),
          name: 'Anonymous',
          avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${userAddress.toLowerCase()}`
        });
      }
    } catch (e) {
      setMyProfile({
        wallet: userAddress.toLowerCase(),
        name: 'Anonymous',
        avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${userAddress.toLowerCase()}`
      });
    }
  };

  useEffect(() => {
    fetchLaunchedTokens();
    if (isConnected && userAddress) {
      fetchMyProfile();
    }
  }, [isConnected, userAddress]);

  // Read URL search params on mount/change to see if we have prefilled payTo
  useEffect(() => {
    const handleUrlPrefill = async () => {
      const params = new URLSearchParams(window.location.search);
      const payTo = params.get('payTo');
      if (payTo) {
        // Check if address
        if (isAddress(payTo)) {
          // Check if they have a profile
          try {
            const { data } = await supabase
              .from('profiles')
              .select('*')
              .eq('wallet', payTo.toLowerCase())
              .single();
            if (data) {
              setSelectedRecipient({
                wallet: data.wallet,
                name: data.name || 'Anonymous',
                avatar: data.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${data.wallet}`,
                discord: data.discord,
                twitter: data.twitter
              });
            } else {
              setSelectedRecipient({
                wallet: payTo.toLowerCase(),
                name: 'Custom Address',
                avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${payTo.toLowerCase()}`
              });
            }
          } catch (e) {
            setSelectedRecipient({
              wallet: payTo.toLowerCase(),
              name: 'Custom Address',
              avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${payTo.toLowerCase()}`
            });
          }
        } else {
          // Search by name
          try {
            const { data } = await supabase
              .from('profiles')
              .select('*')
              .eq('name', payTo)
              .limit(1);
            if (data && data.length > 0) {
              setSelectedRecipient({
                wallet: data[0].wallet,
                name: data[0].name || 'Anonymous',
                avatar: data[0].avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${data[0].wallet}`,
                discord: data[0].discord,
                twitter: data[0].twitter
              });
            }
          } catch (e) {
            console.error('Error fetching URL prefill profile by name:', e);
          }
        }
      }
    };
    handleUrlPrefill();
  }, []);

  // Handle username search query
  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      if (searchQuery.trim().length >= 2) {
        try {
          setSearchLoading(true);
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .ilike('name', `%${searchQuery}%`)
            .limit(5);
          if (!error && data) {
            setSearchResults(data.map(p => ({
              wallet: p.wallet,
              name: p.name || 'Anonymous',
              avatar: p.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${p.wallet}`,
              discord: p.discord,
              twitter: p.twitter
            })));
          }
        } catch (e) {
          console.error(e);
        } finally {
          setSearchLoading(false);
        }
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  // Handle custom contract address inputs
  useEffect(() => {
    const fetchCustomTokenDetails = async () => {
      if (isAddress(customTokenAddress) && publicClient) {
        try {
          setCustomTokenLoading(true);
          setCustomTokenSymbol('');
          
          const symbol = await publicClient.readContract({
            address: customTokenAddress as `0x${string}`,
            abi: erc20Abi,
            functionName: 'symbol'
          }) as string;

          const decimals = await publicClient.readContract({
            address: customTokenAddress as `0x${string}`,
            abi: erc20Abi,
            functionName: 'decimals'
          }) as number;

          setCustomTokenSymbol(symbol || 'ERC20');
          setCustomTokenDecimals(Number(decimals) || 18);
        } catch (err: any) {
          console.error('Error fetching custom token details:', err);
          triggerAlert('TOKEN INFO ERROR', 'Could not read contract symbol or decimals. Ensure it is a valid ERC-20 contract address.', 'error');
        } finally {
          setCustomTokenLoading(false);
        }
      } else {
        setCustomTokenSymbol('');
      }
    };
    fetchCustomTokenDetails();
  }, [customTokenAddress, publicClient]);

  // Handle copy utilities
  const handleCopyWallet = () => {
    if (!userAddress) return;
    navigator.clipboard.writeText(userAddress);
    setCopiedWallet(true);
    setTimeout(() => setCopiedWallet(false), 2000);
  };

  const handleCopyLink = () => {
    if (!userAddress) return;
    const shareName = myProfile?.name !== 'Anonymous' ? myProfile?.name : userAddress;
    const link = `${window.location.origin}/dashboard?payTo=${shareName}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyRecipient = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopiedRecipient(true);
    setTimeout(() => setCopiedRecipient(false), 2000);
  };

  // Perform transaction execution
  const handleSendPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected) {
      triggerAlert('CONNECT WALLET', 'Please connect your wallet first!', 'info');
      return;
    }

    const recipient = selectedRecipient?.wallet || customWalletAddress;
    if (!isAddress(recipient)) {
      triggerAlert('INVALID RECIPIENT', 'Please search for a user or enter a valid recipient wallet address.', 'error');
      return;
    }

    if (!sendAmount || Number(sendAmount) <= 0) {
      triggerAlert('INVALID AMOUNT', 'Please enter a valid amount to send.', 'error');
      return;
    }

    setTxStatus('sending');
    setSuccessTxHash('');

    try {
      let txHash = '';

      if (selectedAssetType === 'NATIVE') {
        // NATIVE transfer (native gas/USDC native chain balance)
        const amtWei = parseUnits(sendAmount, 18);
        txHash = await sendTransactionAsync({
          to: recipient as `0x${string}`,
          value: amtWei
        });
      } else {
        // ERC-20 transfer
        let tokenAddress = '';
        let decimals = 18;
        let symbol = 'TOKEN';

        if (selectedAssetType === 'USDC') {
          tokenAddress = USDC_ADDRESS;
          decimals = 6;
          symbol = 'USDC';
        } else if (selectedAssetType === 'LAUNCHED') {
          if (!selectedMemeToken) {
            throw new Error('Please select a meme token.');
          }
          tokenAddress = selectedMemeToken.token_address;
          decimals = 18;
          symbol = selectedMemeToken.ticker;
        } else if (selectedAssetType === 'CUSTOM') {
          if (!isAddress(customTokenAddress)) {
            throw new Error('Please enter a valid custom contract address.');
          }
          tokenAddress = customTokenAddress;
          decimals = customTokenDecimals;
          symbol = customTokenSymbol || 'ERC20';
        }

        const amtWei = parseUnits(sendAmount, decimals);

        if (selectedAssetType === 'USDC') {
          // Arc App Kit Native Send for USDC
          let provider = typeof window !== 'undefined' && (window as any).ethereum ? (window as any).ethereum : walletClient;
          if (!provider) {
             throw new Error("No Web3 Provider available");
          }
          const adapter = createBrowserAdapter(provider);
          
          await appKitSend(adapter, sendAmount, "USDC", recipient, "Arc_Testnet");
          // Wait briefly for indexer sync or block confirmation
          await new Promise(r => setTimeout(r, 1500));
        } else {
          // Standard ERC-20 transfer for others
          txHash = await writeContractAsync({
            address: tokenAddress as `0x${string}`,
            abi: erc20Abi,
            functionName: 'transfer',
            args: [recipient as `0x${string}`, amtWei]
          });
        }
      }

      if (publicClient && txHash) {
        await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}` });
      }

      setSuccessTxHash(txHash);
      setTxStatus('success');

      // Save to history
      try {
        const tokenSymbol = selectedAssetType === 'USDC' ? 'USDC' : 
                            selectedAssetType === 'LAUNCHED' ? selectedMemeToken?.ticker : 
                            selectedAssetType === 'CUSTOM' ? customTokenSymbol : 'NATIVE';
        await supabase.from('social_transactions').insert({
          sender_wallet: userAddress?.toLowerCase(),
          receiver_wallet: recipient.toLowerCase(),
          amount: Number(sendAmount),
          asset_type: tokenSymbol,
          tx_hash: txHash
        });
      } catch (err) {
        console.error("Failed to save social transaction to db:", err);
      }

      setSendAmount('');
      triggerAlert('PAYMENT SENT', `Successfully sent ${sendAmount} to ${selectedRecipient?.name || 'custom recipient'}!`, 'success');
      
      // Dispatch app-wide balance update event
      window.dispatchEvent(new Event('arc-balance-update'));

      // Add point trigger for Social Payment volume tracker if sending USDC
      if (selectedAssetType === 'USDC') {
        try {
          const swapUsdcAmount = Number(sendAmount);
          const pointsEarned = swapUsdcAmount / 10;
          const walletLower = userAddress?.toLowerCase();
          
          if (walletLower) {
            const { data: existingStats } = await supabase
              .from('user_stats')
              .select('*')
              .eq('wallet', walletLower);

            const currentStats = existingStats && existingStats.length > 0 ? existingStats[0] : null;

            if (currentStats) {
              await supabase
                .from('user_stats')
                .update({
                  total_volume: Number(currentStats.total_volume || 0) + swapUsdcAmount,
                  points: Number(currentStats.points || 0) + pointsEarned
                })
                .eq('wallet', walletLower);
            } else {
              await supabase
                .from('user_stats')
                .insert({
                  wallet: walletLower,
                  total_volume: swapUsdcAmount,
                  points: pointsEarned
                });
            }
          }
        } catch (statsErr) {
          console.error('Error tracking points for Social Pay USDC volume:', statsErr);
        }
      }

    } catch (err: any) {
      console.error(err);
      setTxStatus('error');
      triggerAlert('PAYMENT FAILED', err.shortMessage || err.message || 'Transaction rejected.', 'error');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      
      {/* LEFT COLUMN: Send Funds UI */}
      <div className="lg:col-span-8 space-y-6">
        <div className="card rounded-[32px] p-6 sm:p-8 shadow-sm space-y-6">
          
          {/* Header & Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-dim)] pb-5">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-[rgba(0,242,254,0.05)] flex items-center justify-center border border-[var(--border-dim)] text-[var(--accent-cyan)] shadow-sm shadow-blue-500/5">
                <Send size={22} />
              </div>
              <div>
                <h2 className="text-xl font-black text-[var(--text-primary)]">Arc Social Pay</h2>
                <p className="text-xs text-[var(--text-secondary)] font-semibold">Send funds to friends by name or address.</p>
              </div>
            </div>

            <div className="flex items-center bg-[rgba(6,10,38,0.9)] border border-[var(--border-dim)] p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('pay')}
                className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${
                  activeTab === 'pay' ? 'bg-[var(--bg-card)] text-[var(--accent-cyan)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Send Payment
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-black transition-all ${
                  activeTab === 'history' ? 'bg-[var(--bg-card)] text-[var(--accent-cyan)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <History size={14} /> History
              </button>
            </div>
          </div>

          {activeTab === 'history' ? (
            <div className="min-h-[400px]">
              <SocialPayHistory />
            </div>
          ) : (
          <form onSubmit={handleSendPayment} className="space-y-6">
            
            {/* Step 1: Select Recipient */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-widest">1. Choose Recipient</label>
              
              {selectedRecipient ? (
                /* Selected Recipient Card */
                <div className="flex items-center justify-between p-4 bg-[rgba(0,242,254,0.05)] border border-[var(--border-dim)] rounded-2xl animate-in fade-in zoom-in-95 duration-200">
                  <div className="flex items-center gap-4.5">
                    <div className="w-12 h-12 rounded-xl overflow-hidden border border-[var(--border-dim)] shadow-sm bg-[var(--bg-card)]">
                      <img src={selectedRecipient.avatar} alt="" className="w-full h-full object-contain p-0.5" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-[var(--text-primary)] text-sm flex items-center gap-1.5">
                        {selectedRecipient.name}
                        {selectedRecipient.name === 'Custom Address' && (
                          <span className="text-[9px] bg-[rgba(41,121,255,0.12)] text-[var(--text-secondary)] border border-[var(--border-dim)] px-2 py-0.5 rounded-full font-black uppercase">Custom</span>
                        )}
                      </h4>
                      <p className="text-[10px] text-[var(--text-secondary)] font-semibold font-mono flex items-center gap-1 mt-0.5">
                        {selectedRecipient.wallet.slice(0, 10)}...{selectedRecipient.wallet.slice(-8)}
                        <button
                          type="button"
                          onClick={() => handleCopyRecipient(selectedRecipient.wallet)}
                          className="text-[var(--text-secondary)] hover:text-[var(--accent-cyan)] p-0.5 hover:bg-[rgba(0,229,255,0.08)] rounded transition-all"
                          title="Copy Wallet Address"
                        >
                          {copiedRecipient ? <Check size={11} className="text-green-600" /> : <Copy size={11} />}
                        </button>
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRecipient(null);
                      setCustomWalletAddress('');
                    }}
                    className="text-xs card hover:border-[var(--border-dim)] text-[var(--text-secondary)] font-extrabold px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-sm hover:scale-[1.02]"
                  >
                    Change
                  </button>
                </div>
              ) : (
                /* Search Recipients or Enter Address Input */
                <div className="space-y-4">
                  {/* Search username box */}
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" size={16} />
                    <input
                      type="text"
                      placeholder="Search by username (e.g. Frianowzki)..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-11 pr-4 py-3.5 bg-[var(--bg-input)] border border-[var(--border-dim)] rounded-2xl text-xs outline-none focus:bg-[var(--bg-card)] focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all font-semibold"
                    />
                    {searchLoading && (
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        <Loader2 className="animate-spin text-[var(--accent-cyan)] size-4" />
                      </div>
                    )}
                  </div>

                  {/* Search results dropdown panel */}
                  {searchResults.length > 0 && (
                    <div className="border border-[var(--border-dim)] rounded-2xl overflow-hidden shadow-xl bg-[var(--bg-card)] animate-in slide-in-from-top-2 duration-150 relative z-10 max-h-[220px] overflow-y-auto">
                      {searchResults.map((p) => (
                        <button
                          key={p.wallet}
                          type="button"
                          onClick={() => {
                            setSelectedRecipient(p);
                            setSearchQuery('');
                            setSearchResults([]);
                          }}
                          className="w-full flex items-center justify-between p-3.5 hover:bg-[rgba(8,16,50,0.8)] border-b border-[var(--border-dim)] last:border-0 text-left transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg overflow-hidden border border-[var(--border-dim)] bg-[var(--bg-card)]">
                              <img src={p.avatar} alt="" className="w-full h-full object-contain p-0.5" />
                            </div>
                            <div>
                              <span className="text-xs font-black text-[var(--text-primary)] block leading-tight">{p.name}</span>
                              <span className="text-[9px] text-[var(--text-secondary)] font-mono block mt-0.5">{p.wallet.slice(0, 8)}...{p.wallet.slice(-6)}</span>
                            </div>
                          </div>
                          <ArrowRight size={14} className="text-slate-300 group-hover:text-[var(--accent-cyan)]" />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Manual wallet address entry option */}
                  <div className="flex items-center gap-3.5">
                    <span className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">Or Paste Custom Wallet</span>
                    <hr className="flex-1 border-[var(--border-dim)]" />
                  </div>

                  <div className="relative">
                    <Wallet className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" size={16} />
                    <input
                      type="text"
                      placeholder="Paste wallet address (0x...) here..."
                      value={customWalletAddress}
                      onChange={(e) => {
                        setCustomWalletAddress(e.target.value);
                        if (isAddress(e.target.value)) {
                          setSelectedRecipient({
                            wallet: e.target.value.toLowerCase(),
                            name: 'Custom Address',
                            avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${e.target.value.toLowerCase()}`
                          });
                        }
                      }}
                      className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-[var(--border-dim)] rounded-2xl text-xs font-mono outline-none focus:bg-[var(--bg-card)] focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Step 2: Choose Token Asset */}
            <div className="space-y-3.5">
              <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-widest">2. Select Token Asset</label>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* USDC */}
                <button
                  type="button"
                  onClick={() => setSelectedAssetType('USDC')}
                  className={`py-3.5 rounded-2xl border text-center transition-all cursor-pointer font-bold text-xs flex flex-col items-center gap-1.5 ${
                    selectedAssetType === 'USDC'
                      ? 'border-blue-500 bg-[rgba(0,242,254,0.05)] text-[var(--accent-cyan)] shadow-sm shadow-blue-500/5'
                      : 'border-[var(--border-dim)] bg-[rgba(6,10,38,0.7)] hover:bg-[rgba(8,16,50,0.9)] text-[var(--text-secondary)]'
                  }`}
                >
                  <DollarSign size={16} />
                  USDC (6 Decimals)
                </button>

                {/* Arc Meme Token launches */}
                <button
                  type="button"
                  onClick={() => setSelectedAssetType('LAUNCHED')}
                  className={`py-3.5 rounded-2xl border text-center transition-all cursor-pointer font-bold text-xs flex flex-col items-center gap-1.5 ${
                    selectedAssetType === 'LAUNCHED'
                      ? 'border-blue-500 bg-[rgba(0,242,254,0.05)] text-[var(--accent-cyan)] shadow-sm shadow-blue-500/5'
                      : 'border-[var(--border-dim)] bg-[rgba(6,10,38,0.7)] hover:bg-[rgba(8,16,50,0.9)] text-[var(--text-secondary)]'
                  }`}
                >
                  <Users size={16} />
                  Meme Tokens
                </button>

                {/* Custom Token */}
                <button
                  type="button"
                  onClick={() => setSelectedAssetType('CUSTOM')}
                  className={`py-3.5 rounded-2xl border text-center transition-all cursor-pointer font-bold text-xs flex flex-col items-center gap-1.5 ${
                    selectedAssetType === 'CUSTOM'
                      ? 'border-blue-500 bg-[rgba(0,242,254,0.05)] text-[var(--accent-cyan)] shadow-sm shadow-blue-500/5'
                      : 'border-[var(--border-dim)] bg-[rgba(6,10,38,0.7)] hover:bg-[rgba(8,16,50,0.9)] text-[var(--text-secondary)]'
                  }`}
                >
                  <HelpCircle size={16} />
                  Custom ERC-20
                </button>

                {/* Native Gas Token */}
                <button
                  type="button"
                  onClick={() => setSelectedAssetType('NATIVE')}
                  className={`py-3.5 rounded-2xl border text-center transition-all cursor-pointer font-bold text-xs flex flex-col items-center gap-1.5 ${
                    selectedAssetType === 'NATIVE'
                      ? 'border-blue-500 bg-[rgba(0,242,254,0.05)] text-[var(--accent-cyan)] shadow-sm shadow-blue-500/5'
                      : 'border-[var(--border-dim)] bg-[rgba(6,10,38,0.7)] hover:bg-[rgba(8,16,50,0.9)] text-[var(--text-secondary)]'
                  }`}
                >
                  <QrCode size={16} />
                  Native Coin
                </button>
              </div>

              {/* Dynamic asset inputs */}
              {selectedAssetType === 'LAUNCHED' && (
                <div className="bg-[rgba(6,10,38,0.9)] border border-[var(--border-dim)] rounded-2xl p-4.5 space-y-3.5 animate-in fade-in slide-in-from-top-1 duration-150">
                  <span className="text-[10px] text-[var(--text-secondary)] font-extrabold uppercase tracking-wider block">Choose Launched Token</span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-h-[140px] overflow-y-auto pr-1">
                    {tokensList.length === 0 ? (
                      <p className="text-[10px] text-[var(--text-secondary)] font-medium py-3 col-span-4 text-center">No meme tokens launched yet.</p>
                    ) : (
                      tokensList.map((tok) => (
                        <button
                          key={tok.id}
                          type="button"
                          onClick={() => setSelectedMemeToken(tok)}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between hover:scale-[1.01] ${
                            selectedMemeToken?.token_address === tok.token_address
                              ? 'border-blue-500 bg-[var(--bg-card)] text-[var(--accent-cyan)] shadow-sm'
                              : 'border-[var(--border-dim)] bg-[var(--bg-card)] hover:border-[var(--border-dim)] text-[var(--text-primary)]'
                          }`}
                        >
                          <span className="text-xs font-black truncate block">{tok.ticker}</span>
                          <span className="text-[8px] text-[var(--text-secondary)] font-semibold truncate block mt-0.5">{tok.name}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}

              {selectedAssetType === 'CUSTOM' && (
                <div className="bg-[rgba(6,10,38,0.9)] border border-[var(--border-dim)] rounded-2xl p-4.5 space-y-3.5 animate-in fade-in slide-in-from-top-1 duration-150">
                  <span className="text-[10px] text-[var(--text-secondary)] font-extrabold uppercase tracking-wider block">Custom ERC-20 Address</span>
                  
                  <div className="space-y-3.5">
                    <input
                      type="text"
                      placeholder="Paste contract address (0x...) here..."
                      value={customTokenAddress}
                      onChange={(e) => setCustomTokenAddress(e.target.value)}
                      className="w-full px-4 py-3 card rounded-xl text-xs font-mono outline-none focus:border-blue-500 transition-all"
                    />

                    {customTokenLoading && (
                      <div className="flex items-center gap-2 text-[10px] font-bold text-[var(--text-secondary)]">
                        <Loader2 className="animate-spin text-[var(--accent-cyan)] size-3" />
                        Querying contract symbol/decimals on Arc chain...
                      </div>
                    )}

                    {customTokenSymbol && (
                      <div className="flex items-center gap-3.5 bg-[rgba(0,242,254,0.05)] border border-[var(--border-dim)] p-3 rounded-xl">
                        <Info size={14} className="text-[var(--accent-cyan)]" />
                        <div className="text-[11px] font-bold text-[var(--text-secondary)] flex-1">
                          Detected Token: <strong className="text-[var(--accent-cyan)] font-black">{customTokenSymbol}</strong>
                          <span className="mx-2 text-slate-300 font-normal">|</span>
                          Decimals: <strong className="text-[var(--text-primary)] font-black">{customTokenDecimals}</strong>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Step 3: Input Amount */}
            <div className="bg-[rgba(6,10,38,0.9)] border border-[var(--border-dim)] rounded-2xl p-4.5">
              <div className="flex justify-between text-[11px] text-[var(--text-secondary)] font-bold mb-2">
                <span>Amount to Send</span>
                <span className="text-[var(--accent-cyan)] font-extrabold">
                  {selectedAssetType === 'USDC' && 'USDC'}
                  {selectedAssetType === 'LAUNCHED' && (selectedMemeToken?.ticker || 'TOKEN')}
                  {selectedAssetType === 'CUSTOM' && (customTokenSymbol || 'ERC20')}
                  {selectedAssetType === 'NATIVE' && 'Native Chain Coin'}
                </span>
              </div>
              <input
                type="number"
                value={sendAmount}
                onChange={(e) => setSendAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-transparent text-3xl font-extrabold font-mono text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
                required
                min="0.000000000000000001"
                step="any"
              />
            </div>

            {/* Action Send Button */}
            <button
              type="submit"
              disabled={txStatus === 'sending'}
              className="w-full py-4.5 bg-gradient-to-r from-[#7c3aff] to-[#2979ff] hover:opacity-90 text-white rounded-2xl font-black text-sm tracking-wide uppercase transition-all shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {txStatus === 'sending' ? (
                <>
                  <Loader2 className="animate-spin" />
                  Broadcasting Transaction...
                </>
              ) : (
                <>
                  <Send size={15} />
                  Send Payment Instantly
                </>
              )}
            </button>

          </form>
          )}

        </div>
      </div>

      {/* RIGHT COLUMN: Personal Pay QR & Card */}
      <div className="lg:col-span-4 space-y-6">
        
        {/* Connected User Identity Display */}
        <div className="card rounded-[32px] p-6 shadow-sm flex flex-col items-center text-center space-y-5 relative">
          
          <span className="absolute top-4 left-4 bg-emerald-500/10 text-emerald-600 border border-emerald-100 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
            Online
          </span>

          {myProfile ? (
            <>
              <div className="w-18 h-18 rounded-2xl overflow-hidden border border-[var(--border-dim)] shadow-inner bg-[var(--bg-card)] mt-2">
                <img src={myProfile.avatar} alt="My Avatar" className="w-full h-full object-contain p-0.5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-[var(--text-primary)] flex items-center justify-center gap-1">
                  {myProfile.name}
                </h3>
                <p className="text-[10px] text-[var(--text-secondary)] font-bold font-mono">
                  {userAddress ? `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}` : '0x000...0000'}
                </p>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 py-4">
              <Loader2 className="animate-spin text-[var(--accent-cyan)] size-6" />
              <span className="text-xs text-[var(--text-secondary)] font-semibold">Loading identity...</span>
            </div>
          )}

          <hr className="w-full border-[var(--border-dim)]" />

          {/* Calming Blue QR Code */}
          {userAddress ? (
            <div className="space-y-3.5 flex flex-col items-center w-full">
              <span className="text-[10px] text-[var(--text-secondary)] font-black uppercase tracking-widest">My "Pay Me" QR Code</span>
              <div className="p-3 card rounded-3xl shadow-inner flex items-center justify-center hover:scale-[1.01] transition-transform duration-200">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&color=0052ff&data=${userAddress}`}
                  alt="Payment QR"
                  className="w-44 h-44 object-contain"
                />
              </div>
              <p className="text-[9px] text-[var(--text-secondary)] font-semibold max-w-[200px] leading-relaxed">
                Friends can scan this QR code with their mobile cameras to automatically prefill your address.
              </p>
            </div>
          ) : (
            <div className="py-8 text-center text-[var(--text-secondary)] space-y-2">
              <QrCode size={32} className="mx-auto text-slate-350" />
              <p className="text-[10px] font-semibold">Connect wallet to view payment QR</p>
            </div>
          )}

          <hr className="w-full border-[var(--border-dim)]" />

          {/* Quick Actions (Copy buttons) */}
          <div className="grid grid-cols-2 gap-3 w-full">
            <button
              onClick={handleCopyWallet}
              disabled={!userAddress}
              className="py-2.5 px-3 bg-[rgba(6,10,38,0.9)] border border-[var(--border-dim)] hover:border-[var(--accent-cyan)] text-[var(--text-secondary)] rounded-xl text-[10px] font-bold tracking-wide uppercase transition-all shadow-sm cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {copiedWallet ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
              Copy Address
            </button>
            <button
              onClick={handleCopyLink}
              disabled={!userAddress}
              className="py-2.5 px-3 bg-[rgba(0,242,254,0.05)] border border-[var(--border-dim)] hover:bg-blue-600 hover:text-white hover:border-blue-600 text-[var(--accent-cyan)] rounded-xl text-[10px] font-bold tracking-wide uppercase transition-all shadow-sm cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {copiedLink ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
              Payment Link
            </button>
          </div>

        </div>

      </div>

      {/* Custom Global Alert Dialog */}
      {alertInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-slate-900/20 transition-all duration-200 animate-in fade-in">
          <div className="bg-[var(--bg-card)]/95 border border-[var(--border-dim)] shadow-2xl rounded-[28px] p-6 max-w-sm w-full space-y-4.5 transform transition-all scale-100 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg ${
                alertInfo.type === 'success'
                  ? 'bg-emerald-500/10 text-emerald-600 shadow-emerald-500/10'
                  : alertInfo.type === 'error'
                  ? 'bg-rose-500/10 text-rose-600 shadow-rose-500/10'
                  : 'bg-blue-600/10 text-[var(--accent-cyan)] shadow-blue-500/10'
              }`}>
                {alertInfo.type === 'success' ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                ) : alertInfo.type === 'error' ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                ) : (
                  <Info className="w-5 h-5" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-xs font-black tracking-wider text-[var(--text-primary)] uppercase">{alertInfo.title}</h3>
                <p className="text-[9px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">Social Pay Alert</p>
              </div>
            </div>

            <p className="text-xs text-[var(--text-secondary)] font-semibold leading-relaxed bg-[rgba(6,10,38,0.9)] border border-[var(--border-dim)] rounded-2xl p-4">
              {alertInfo.message}
            </p>

            {successTxHash && (
              <div className="space-y-1 bg-slate-900 border border-[var(--border-dim)] p-3.5 rounded-2xl font-mono text-[9px] text-[var(--text-secondary)]">
                <span className="text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest block">Transaction Hash</span>
                <a
                  href={`https://testnet.arcscan.app/tx/${successTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 font-bold hover:underline break-all block"
                >
                  {successTxHash}
                </a>
              </div>
            )}

            <button
              onClick={() => {
                if (alertInfo.type === 'success') {
                  setSuccessTxHash('');
                }
                setAlertInfo(null);
              }}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-xs tracking-wider uppercase transition-all shadow-lg shadow-blue-500/25 cursor-pointer active:scale-[0.98]"
            >
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
