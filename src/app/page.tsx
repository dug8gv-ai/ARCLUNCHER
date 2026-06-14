'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { NetworkGuard } from '@/components/NetworkGuard';
import { DashboardStats } from '@/components/DashboardStats';
import { LaunchForm } from '@/components/LaunchForm';
import { TradingPanel } from '@/components/TradingPanel';
import { Leaderboard } from '@/components/Leaderboard';
import { AffiliatesView } from '@/components/AffiliatesView';
import { supabase } from '@/lib/supabase';
import { useAccount, useSendTransaction, usePublicClient, useWriteContract } from 'wagmi';
import { parseUnits, formatUnits, erc20Abi } from 'viem';
import { Home as HomeIcon, Award, Coins, HelpCircle, Layers, ArrowRight, ShieldCheck, Trophy, Users, Droplet, Info, Send, Rocket, TrendingUp, Briefcase, PieChart, Dices, ShoppingCart, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ARC_DEFI_ROUTER_ADDRESS, arcDefiRouterAbi, USDC_ADDRESS, EURC_ADDRESS, CIRBTC_ADDRESS } from '@/lib/arcDefiAbi';
import dynamic from 'next/dynamic';

const PriceChart = dynamic(() => import('@/components/PriceChart').then(mod => mod.PriceChart), {
  ssr: false,
});
import { TransactionHistory } from '@/components/TransactionHistory';
import { SocialPay } from '@/components/SocialPay';
import ArcWallet from '@/components/financial-layer/ArcWallet';
import ArcYield from '@/components/financial-layer/ArcYield';
import UserGuide from '@/components/UserGuide';
import { FreelanceHub } from '@/components/FreelanceHub';
import { PredictionDashboard } from '@/components/PredictionDashboard';
import { SlotMachine } from '@/components/arcslots/SlotMachine';
import { ArcSlotsDashboard } from '@/components/arcslots/ArcSlotsDashboard';
import { BuilderDashboard } from '@/components/builder/BuilderDashboard';
import { UserProfileDrawer } from '@/components/arcpay/UserProfileDrawer';
import { DiscreteTasks } from '@/components/airdrop/DiscreteTasks';
import { MarketHubView } from '@/components/markethub/MarketHubView';
import { ArcEcosystemHub } from '@/components/ArcEcosystemHub';

export default function Home() {
  const { isConnected, address: userAddress } = useAccount();
  const publicClient = usePublicClient();
  const { sendTransactionAsync } = useSendTransaction();
  const { writeContractAsync } = useWriteContract();
  
  // Premium Alert State
  const [premiumAlert, setPremiumAlert] = useState<{
    title: string;
    details: Array<{ label: string; value: string }>;
    type: 'config' | 'info' | 'success' | 'error';
    onClose: () => void;
  } | null>(null);

  const triggerAlert = (title: string, message: string, type: 'success' | 'error' | 'info' = 'info'): Promise<void> => {
    return new Promise((resolve) => {
      setPremiumAlert({
        title,
        details: [{ label: "Notification", value: message }],
        type,
        onClose: () => resolve()
      });
    });
  };
  
  // Navigation & Token States
  const [selectedToken, setSelectedToken] = useState<any>(null);
  const [profileName, setProfileName] = useState<string>('Guest');
  const [isRulesOpen, setIsRulesOpen] = useState(false);

  // Read initial view from URL hash so page refresh stays on the same section
  const getInitialView = () => {
    if (typeof window === 'undefined') return 'launcher';
    const hash = window.location.hash.replace('#', '');
    const validViews = ['launcher','trade','social-pay','leaderboard','affiliates','earn','wallet','guide','staking','gigs','prediction-market','slots','builder', 'markethub', 'arc-ecosystem'];
    return validViews.includes(hash) ? hash as any : 'launcher';
  };
  const [currentView, setCurrentView] = useState<'launcher' | 'trade' | 'social-pay' | 'leaderboard' | 'affiliates' | 'earn' | 'wallet' | 'guide' | 'staking' | 'gigs' | 'prediction-market' | 'slots' | 'builder' | 'markethub' | 'arc-ecosystem'>(getInitialView);

  // Sync URL hash whenever view changes so refresh preserves position
  useEffect(() => {
    window.location.hash = currentView;
  }, [currentView]);

  const [bridgeInitialToken, setBridgeInitialToken] = useState<'USDC' | 'EURC'>('USDC');

  // Daily Locks State (V2 Upgraded)
  const [lockerTab, setLockerTab] = useState<'lock' | 'my_locks'>('lock');
  const [isLockerOpen, setIsLockerOpen] = useState(false);
  const [lockAssetType, setLockAssetType] = useState<'USDC' | 'EURC' | 'PLATFORM_TOKEN' | 'CUSTOM_ERC20'>('USDC');
  const [lockAddress, setLockAddress] = useState('');
  const [lockTicker, setLockTicker] = useState('');
  const [lockCustomPrice, setLockCustomPrice] = useState('1.00'); // Custom token worth custom price
  const [lockAmount, setLockAmount] = useState('');
  const [myLocks, setMyLocks] = useState<any[]>([]);
  const [totalLockedUSD, setTotalLockedUSD] = useState(0); // Real locked value only (no base!)
  const [lockedUSDC, setLockedUSDC] = useState<number>(0);
  const [lockedEURC, setLockedEURC] = useState<number>(0);
  const [usdcWalletBalance, setUsdcWalletBalance] = useState<number>(0);
  const [eurcWalletBalance, setEurcWalletBalance] = useState<number>(0);
  const [cirbtcWalletBalance, setCirbtcWalletBalance] = useState<number>(0);
  const [isFetchingWalletBalances, setIsFetchingWalletBalances] = useState<boolean>(false);
  const [tokensList, setTokensList] = useState<any[]>([]);
  const [tokenBalance, setTokenBalance] = useState<number>(1000.00);
  const [isFetchingWorth, setIsFetchingWorth] = useState(false);
  const [estimatedWorthUSD, setEstimatedWorthUSD] = useState<number>(0);

  // Dynamic balance fetcher for the selected asset
  const fetchTokenBalance = async () => {
    if (!userAddress) {
      setTokenBalance(0);
      return;
    }
    const wallet = userAddress.toLowerCase();
    try {
      if (lockAssetType === 'USDC') {
        // We will just use the state variable that gets populated by fetchWalletBalances
        // To be safe, we will just sync it from there later, but we can set it to usdcWalletBalance here
        setTokenBalance(usdcWalletBalance);
      } else if (lockAssetType === 'EURC') {
        setTokenBalance(eurcWalletBalance);
      } else if (lockAssetType === 'PLATFORM_TOKEN' && lockAddress) {
        if (publicClient) {
          const raw = await publicClient.readContract({
            address: lockAddress as `0x${string}`,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [userAddress],
          });
          setTokenBalance(Number(formatUnits(raw as bigint, 18)));
        } else {
          setTokenBalance(0);
        }
      } else if (lockAssetType === 'CUSTOM_ERC20' && lockAddress) {
        if (publicClient) {
          const raw = await publicClient.readContract({
            address: lockAddress as `0x${string}`,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [userAddress],
          });
          setTokenBalance(Number(formatUnits(raw as bigint, 18)));
        } else {
          setTokenBalance(0);
        }
      } else {
        setTokenBalance(0);
      }
    } catch (err) {
      console.error("Error fetching token balance:", err);
      setTokenBalance(0);
    }
  };

  // Dynamic wallet balance fetcher for stablecoins (USDC & EURC) on-chain
  const fetchWalletBalances = async () => {
    if (!userAddress || !publicClient) {
      setUsdcWalletBalance(0);
      setEurcWalletBalance(0);
      setCirbtcWalletBalance(0);
      return;
    }
    setIsFetchingWalletBalances(true);
    let usdcVal = 0;
    let eurcVal = 0;
    let cirbtcVal = 0;

    // Fetch ERC20 USDC
    try {
      const usdcRaw = await publicClient.readContract({
        address: USDC_ADDRESS as `0x${string}`,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [userAddress],
      });
      usdcVal += Number(formatUnits(usdcRaw as bigint, 6));
    } catch (err) {
      console.error('USDC ERC20 fetch error:', err);
    }

    // Fetch ERC20 EURC
    try {
      const eurcRaw = await publicClient.readContract({
        address: EURC_ADDRESS as `0x${string}`,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [userAddress],
      });
      eurcVal += Number(formatUnits(eurcRaw as bigint, 6));
    } catch (err) {
      console.error('EURC ERC20 fetch error:', err);
    }

    // Fetch ERC20 cirBTC with 8-decimal handling
    try {
      const cirbtcRaw = await publicClient.readContract({
        address: CIRBTC_ADDRESS as `0x${string}`,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [userAddress],
      });
      cirbtcVal += Number(formatUnits(cirbtcRaw as bigint, 8));
    } catch (err) {
      console.error('cirBTC ERC20 fetch error:', err);
    }

    setUsdcWalletBalance(usdcVal);
    setEurcWalletBalance(eurcVal);
    setCirbtcWalletBalance(cirbtcVal);

    // Also sync the active tokenBalance if it's USDC or EURC
    if (lockAssetType === 'USDC') setTokenBalance(usdcVal);
    if (lockAssetType === 'EURC') setTokenBalance(eurcVal);

    setIsFetchingWalletBalances(false);
  };

  // Re-fetch balance when user, type or address changes
  useEffect(() => {
    fetchTokenBalance();
  }, [userAddress, lockAssetType, lockAddress, lockTicker, isLockerOpen]);

  // Sync token balance on app-wide updates reactively
  useEffect(() => {
    const handleUpdate = () => {
      fetchWalletBalances();
      fetchTokenBalance();
      fetchLocks();
    };
    window.addEventListener('arc-balance-update', handleUpdate);
    return () => {
      window.removeEventListener('arc-balance-update', handleUpdate);
    };
  }, [userAddress, lockAssetType, lockAddress, lockTicker, publicClient]);

  // Dynamic worth calculator in USD
  useEffect(() => {
    const calcWorth = async () => {
      const amt = Number(lockAmount);
      if (!amt || amt <= 0) {
        setEstimatedWorthUSD(0);
        return;
      }

      setIsFetchingWorth(true);
      try {
        if (lockAssetType === 'USDC') {
          setEstimatedWorthUSD(amt);
        } else if (lockAssetType === 'EURC') {
          setEstimatedWorthUSD(amt * 1.09); // Pegged roughly at 1 EURC = 1.09 USD
        } else if (lockAssetType === 'PLATFORM_TOKEN' && lockAddress) {
          // Calculate using real AMM bonding curve — Virtual $20K FDV seed
          // Fetch token supply from token_launches to get the correct initial price
          const INITIAL_LIQUIDITY_USDC = 20_000; // Virtual seed → $20K opening FDV

          const { data: tokenData } = await supabase
            .from('token_launches')
            .select('initial_supply, supply')
            .eq('token_address', lockAddress.toLowerCase())
            .single();

          const totalSupply = Number(
            tokenData?.initial_supply || tokenData?.supply || 1_000_000_000
          );

          let currentUSDC   = INITIAL_LIQUIDITY_USDC;
          let currentTokens = totalSupply;

          const { data: swaps } = await supabase
            .from('token_swaps')
            .select('usdc_amount, token_amount, is_buy')
            .eq('token_address', lockAddress.toLowerCase());

          swaps?.forEach(s => {
            if (s.is_buy) {
              currentUSDC   += Number(s.usdc_amount);
              currentTokens -= Number(s.token_amount);
            } else {
              currentUSDC   -= Number(s.usdc_amount);
              currentTokens += Number(s.token_amount);
            }
          });

          if (currentUSDC   < INITIAL_LIQUIDITY_USDC) currentUSDC   = INITIAL_LIQUIDITY_USDC;
          if (currentTokens > totalSupply)             currentTokens = totalSupply;
          if (currentTokens <= 0) currentTokens = 1;

          const price = currentUSDC / currentTokens;
          setEstimatedWorthUSD(amt * price);
        } else if (lockAssetType === 'CUSTOM_ERC20') {
          const customPrice = Number(lockCustomPrice) || 1.00;
          setEstimatedWorthUSD(amt * customPrice);
        } else {
          setEstimatedWorthUSD(amt);
        }
      } catch (err) {
        console.error("Error calculating worth:", err);
        setEstimatedWorthUSD(amt);
      } finally {
        setIsFetchingWorth(false);
      }
    };

    calcWorth();
  }, [lockAmount, lockAssetType, lockAddress, lockCustomPrice, lockTicker]);

  // Fetch locks
  const fetchLocks = async () => {
    try {
      let locksData: any[] = [];
      try {
        const { data, error } = await supabase
          .from('liquidity_locks')
          .select('*')
          .order('locked_at', { ascending: false });
        if (error) throw error;
        locksData = data || [];
      } catch (dbErr) {
        // Fallback to local storage locks if database schema doesn't exist yet!
        const local = localStorage.getItem('arcomni_locks');
        locksData = local ? JSON.parse(local) : [];
      }

      setMyLocks(locksData.filter((l: any) => l.wallet.toLowerCase() === userAddress?.toLowerCase()));
      
      // Calculate total locked USD (Real locked values only, no base!)
      const activeLocks = locksData.filter((l: any) => !l.is_withdrawn);
      let totalUSDC = 0;
      let totalEURC = 0;
      const totalAmount = activeLocks.reduce((acc: number, l: any) => {
        let worth = Number(l.amount);
        if (l.asset_type === 'USDC') {
          totalUSDC += Number(l.amount);
        } else if (l.asset_type === 'EURC') {
          totalEURC += Number(l.amount);
        }

        if (l.usdc_worth != null) {
           worth = Number(l.usdc_worth);
        } else if (l.asset_type === 'USDC') {
           worth = Number(l.amount);
        } else if (l.asset_type === 'EURC') {
           worth = Number(l.amount) * 1.09;
        } else if (l.asset_type === 'PLATFORM_TOKEN' || l.asset_type === 'TOKEN') {
           worth = Number(l.amount) * 0.01; // default fallback
        }
        return acc + worth;
      }, 0);
      setTotalLockedUSD(totalAmount);
      setLockedUSDC(totalUSDC);
      setLockedEURC(totalEURC);
    } catch (e) {
      console.error("Error fetching locks:", e);
    }
  };

  const fetchTokensList = async () => {
    try {
      const { data, error } = await supabase
        .from('token_launches')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) {
        setTokensList(data);
      }
    } catch (e) {
      console.error("Error fetching tokens list for locker:", e);
    }
  };

  useEffect(() => {
    // Clear previous lock data to start fresh on Version 2 upgrade!
    const hasUpgraded = localStorage.getItem('arcomni_locks_v2_upgraded');
    if (!hasUpgraded) {
      localStorage.removeItem('arcomni_locks');
      localStorage.setItem('arcomni_locks_v2_upgraded', 'true');
    }

    fetchLocks();
    fetchTokensList();
    fetchWalletBalances();

    const handleOpenLocker = () => {
      setIsLockerOpen(true);
    };

    window.addEventListener('open-locker', handleOpenLocker);
    return () => {
      window.removeEventListener('open-locker', handleOpenLocker);
    };
  }, [isConnected, userAddress, publicClient]);

  // Load and poll wallet balances reactively
  useEffect(() => {
    if (isConnected && userAddress) {
      fetchWalletBalances();

      // Poll balances every 10 seconds
      const balanceInterval = setInterval(fetchWalletBalances, 10000);

      return () => {
        clearInterval(balanceInterval);
      };
    } else {
      setUsdcWalletBalance(0);
      setEurcWalletBalance(0);
      setCirbtcWalletBalance(0);
    }
  }, [isConnected, userAddress, publicClient, lockAssetType]);
  const handleCreateLock = async () => {
    if (!isConnected || !userAddress) {
      await triggerAlert("CONNECT WALLET", "Please connect your wallet first!", "info");
      return;
    }
    const amt = Number(lockAmount);
    if (!lockAmount || amt <= 0) {
      await triggerAlert("INVALID AMOUNT", "Please enter a valid amount to lock.", "error");
      return;
    }

    // Check balance first
    if (amt > tokenBalance) {
      await triggerAlert("INSUFFICIENT BALANCE", `You do not have enough balance to lock. Available: ${tokenBalance} ${lockAssetType === 'USDC' ? 'USDC' : lockAssetType === 'EURC' ? 'EURC' : lockTicker || 'TOKEN'}`, "error");
      return;
    }

    try {
      // 1. Determine Decimals & Contract Address & Ticker
      let decimals = 18;
      let tokenContractAddress = '';
      let activeTicker = 'TOKEN';

      if (lockAssetType === 'USDC') {
        decimals = 6;
        tokenContractAddress = '0x3600000000000000000000000000000000000000';
        activeTicker = 'USDC';
      } else if (lockAssetType === 'EURC') {
        decimals = 6;
        tokenContractAddress = '0xeC00000000000000000000000000000000000000';
        activeTicker = 'EURC';
      } else if (lockAssetType === 'PLATFORM_TOKEN') {
        decimals = 18;
        tokenContractAddress = lockAddress;
        activeTicker = (lockTicker || 'MEME').toUpperCase();
      } else if (lockAssetType === 'CUSTOM_ERC20') {
        decimals = 18;
        tokenContractAddress = lockAddress;
        activeTicker = (lockTicker || 'CUSTOM').toUpperCase();
      }

      if ((lockAssetType === 'PLATFORM_TOKEN' || lockAssetType === 'CUSTOM_ERC20') && !tokenContractAddress) {
        await triggerAlert("MISSING ADDRESS", "Please select or provide a token contract address.", "error");
        return;
      }

      // 2. Estimate Worth
      let finalWorth = estimatedWorthUSD;
      if (finalWorth <= 0) {
        if (lockAssetType === 'USDC') finalWorth = amt;
        else if (lockAssetType === 'EURC') finalWorth = amt * 1.09;
        else if (lockAssetType === 'CUSTOM_ERC20') finalWorth = amt * (Number(lockCustomPrice) || 1.00);
        else finalWorth = amt * 0.01;
      }

      // 3. Perform on-chain transaction (via ArcDefiRouter)
      const amountWei = parseUnits(lockAmount, decimals);

      await triggerAlert("INITIATING LOCK", `Please confirm the wallet transaction to approve ${lockAmount} ${activeTicker} (worth ~$${finalWorth.toFixed(2)} USD).`, "info");

      const approveTx = await writeContractAsync({
        address: tokenContractAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: 'approve',
        args: [ARC_DEFI_ROUTER_ADDRESS as `0x${string}`, amountWei],
      });
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: approveTx });
      }

      await triggerAlert("APPROVED", `Approval successful. Now confirming lock transaction.`, "info");

      const lockTx = await writeContractAsync({
        address: ARC_DEFI_ROUTER_ADDRESS as `0x${string}`,
        abi: arcDefiRouterAbi,
        functionName: 'lock',
        args: [tokenContractAddress as `0x${string}`, amountWei, BigInt(30 * 24 * 60 * 60)],
      });

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: lockTx });
      }

      // 4. Dispatch event to update the other UI panels reactively
      window.dispatchEvent(new Event('arc-balance-update'));

      // 5. Save Lock record
      const now = new Date();
      const unlockDate = new Date();
      unlockDate.setMonth(unlockDate.getMonth() + 1); // 1 Month locking!

      const newLock = {
        id: 'lock-' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
        wallet: userAddress?.toLowerCase(),
        asset_type: lockAssetType,
        token_address: tokenContractAddress || null,
        token_ticker: activeTicker,
        amount: amt,
        usdc_worth: finalWorth,
        locked_at: now.toISOString(),
        unlock_at: unlockDate.toISOString(),
        is_withdrawn: false
      };

      try {
        const { error } = await supabase
          .from('liquidity_locks')
          .insert(newLock);
        if (error) throw error;
      } catch (dbErr) {
        // Fallback save to local storage
        const local = localStorage.getItem('arcomni_locks');
        const list = local ? JSON.parse(local) : [];
        list.push(newLock);
        localStorage.setItem('arcomni_locks', JSON.stringify(list));
      }

      await triggerAlert("ASSET LOCKED", `Successfully locked ${lockAmount} ${activeTicker} (Worth ~$${finalWorth.toFixed(2)} USD) for 30 Days!`, "success");
      
      // Reset form
      setLockAmount('');
      setLockAddress('');
      setLockTicker('');
      setLockCustomPrice('1.00');
      fetchLocks();
      fetchTokenBalance();
      setLockerTab('my_locks');
    } catch (err: any) {
      console.error(err);
      await triggerAlert("LOCK ERROR", err.shortMessage || err.message, "error");
    }
  };

  const handleUnlockAsset = async (lockId: string) => {
    try {
      // Find the lock first to know details
      let targetLock: any = null;
      try {
        const { data } = await supabase
          .from('liquidity_locks')
          .select('*')
          .eq('id', lockId);
        if (data && data.length > 0) {
          targetLock = data[0];
        }
      } catch (dbErr) {}

      if (!targetLock) {
        const local = localStorage.getItem('arcomni_locks');
        if (local) {
          const list = JSON.parse(local);
          targetLock = list.find((l: any) => l.id === lockId);
        }
      }

      if (!targetLock) {
        await triggerAlert("LOCK NOT FOUND", "Could not locate this locked asset record.", "error");
        return;
      }

      // On-chain unlock via ArcDefiRouter
      await triggerAlert("INITIATING UNLOCK", `Please confirm the wallet transaction to unlock your asset.`, "info");
      const unlockTx = await writeContractAsync({
        address: ARC_DEFI_ROUTER_ADDRESS as `0x${string}`,
        abi: arcDefiRouterAbi,
        functionName: 'unlock',
        args: [targetLock.token_address as `0x${string}`],
      });
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: unlockTx });
      }

      // Update Database/Local Storage state to withdrawn
      try {
        const { error } = await supabase
          .from('liquidity_locks')
          .update({ is_withdrawn: true })
          .eq('id', lockId);
        if (error) throw error;
      } catch (dbErr) {
        // Fallback update in local storage
        const local = localStorage.getItem('arcomni_locks');
        if (local) {
          const list = JSON.parse(local);
          const idx = list.findIndex((l: any) => l.id === lockId);
          if (idx !== -1) {
            list[idx].is_withdrawn = true;
            localStorage.setItem('arcomni_locks', JSON.stringify(list));
          }
        }
      }

      // Dispatch balance update
      window.dispatchEvent(new Event('arc-balance-update'));

      await triggerAlert("ASSET UNLOCKED", `Your locked ${targetLock.amount} ${targetLock.token_ticker} has been unlocked and credited back to your account!`, "success");
      fetchLocks();
      fetchTokenBalance();
    } catch (err: any) {
      await triggerAlert("UNLOCK ERROR", err.message, "error");
    }
  };

  // Daily Checkin states
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [checkinStats, setCheckinStats] = useState<{
    checkin_count: number;
    streak_count: number;
    missed_count: number;
    last_checkin: string | null;
  } | null>(null);

  const [unreadChatCount, setUnreadChatCount] = useState(0);

  useEffect(() => {
    if (!isConnected || !userAddress) return;

    const myWallet = userAddress.toLowerCase();

    const fetchUnreadCount = async () => {
      const { count } = await supabase
        .from('arcpay_chats')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_wallet', myWallet)
        .eq('is_read', false);
      
      setUnreadChatCount(count || 0);
    };

    fetchUnreadCount();

    const channel = supabase
      .channel('unread_chats_tracker')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'arcpay_chats' }, (payload) => {
        const msg = payload.new as any;
        if (msg.receiver_wallet?.toLowerCase() === myWallet) {
          fetchUnreadCount();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isConnected, userAddress]);

  const fetchCheckinStats = async () => {
    if (!isConnected || !userAddress) return;
    try {
      const { data } = await supabase
        .from('profiles')
        .select('checkin_count, streak_count, missed_count, last_checkin')
        .eq('wallet', userAddress.toLowerCase());
      if (data && data.length > 0) {
        setCheckinStats({
          checkin_count: data[0].checkin_count || 0,
          streak_count: data[0].streak_count || 0,
          missed_count: data[0].missed_count || 0,
          last_checkin: data[0].last_checkin || null
        });
      }
    } catch (e) {
      console.error("Error fetching checkin stats:", e);
    }
  };

  useEffect(() => {
    fetchCheckinStats();
  }, [isConnected, userAddress]);

  const handleDailyCheckin = async () => {
    if (!isConnected || !userAddress) {
      await triggerAlert("CONNECT WALLET", "Please connect your wallet first!", "info");
      return;
    }
    
    if (checkinStats?.last_checkin) {
      const lastCheckinDate = new Date(checkinStats.last_checkin).toDateString();
      const todayDate = new Date().toDateString();
      if (lastCheckinDate === todayDate) {
        await triggerAlert("ALREADY CHECKED-IN", "You have already checked-in today! Come back tomorrow.", "info");
        return;
      }
    }

    try {
      setCheckinLoading(true);

      const tx = await sendTransactionAsync({
        to: '0x218b09A7d9FF6D69082Ac605bb27029bC321B5C3', // Admin / Launcher Address
        value: BigInt(0),
      });

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: tx });
      }

      const now = new Date();
      let newStreak = 1;
      let newMissed = checkinStats?.missed_count || 0;

      if (checkinStats?.last_checkin) {
        const lastDate = new Date(checkinStats.last_checkin);
        lastDate.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const diffTime = Math.abs(today.getTime() - lastDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
          newStreak = (checkinStats.streak_count || 0) + 1;
        } else if (diffDays > 1) {
          newStreak = 1;
          newMissed += (diffDays - 1);
        }
      }

      const newCount = (checkinStats?.checkin_count || 0) + 1;

      // Update in Supabase
      const walletLower = userAddress.toLowerCase();
      
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('wallet', walletLower);

      if (existingProfile && existingProfile.length > 0) {
        await supabase
          .from('profiles')
          .update({
            checkin_count: newCount,
            streak_count: newStreak,
            missed_count: newMissed,
            last_checkin: now.toISOString()
          })
          .eq('wallet', walletLower);
      } else {
        await supabase
          .from('profiles')
          .insert({
            wallet: walletLower,
            checkin_count: newCount,
            streak_count: newStreak,
            missed_count: newMissed,
            last_checkin: now.toISOString(),
            name: 'Anonymous',
            avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${walletLower}`
          });
      }

      await triggerAlert("CHECK-IN SUCCESSFUL", `Check-in Successful! Streak: ${newStreak} days!`, "success");
      fetchCheckinStats();
    } catch (err: any) {
      console.error("Checkin Transaction failed:", err);
      await triggerAlert("CHECK-IN FAILED", err.shortMessage || err.message, "error");
    } finally {
      setCheckinLoading(false);
    }
  };

  // 1. Fetch Profile Name for Custom Header Greeting
  useEffect(() => {
    if (isConnected && userAddress) {
      const getProfile = async () => {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('name')
            .eq('wallet', userAddress.toLowerCase())
            .single();
          if (data && !error) {
            setProfileName(data.name || 'Trader');
          } else {
            setProfileName('Trader');
          }
        } catch (e) {
          setProfileName('Trader');
        }
      };
      getProfile();

      // Realtime listener for username updates
      const channel = supabase.channel(`page_profile_${userAddress}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `wallet=eq.${userAddress.toLowerCase()}`
        }, (payload: any) => {
          setProfileName(payload.new.name || 'Trader');
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      setProfileName('Guest');
    }
  }, [isConnected, userAddress]);

  // 2. URL State / Chart Persistence Fix & payTo Prefill
  useEffect(() => {
    const loadTokenFromUrl = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const tokenAddress = searchParams.get('token');
      const payTo = searchParams.get('payTo');
      
      if (payTo) {
        setCurrentView('social-pay');
      } else if (tokenAddress) {
        try {
          const { data, error } = await supabase
            .from('token_launches')
            .select('*')
            .eq('token_address', tokenAddress.toLowerCase())
            .single();
          
          if (data && !error) {
            setSelectedToken(data);
            setCurrentView('trade');
          }
        } catch (e) {
          console.error("Error fetching token by URL:", e);
        }
      }
    };
    loadTokenFromUrl();
  }, []);

  // Update token selections and URL state
  const handleSelectToken = (token: any) => {
    setSelectedToken(token);
    if (token) {
      const newUrl = `${window.location.origin}/dashboard?token=${token.token_address.toLowerCase()}`;
      window.history.pushState({ path: newUrl }, '', newUrl);
      setCurrentView('trade'); // Automatically switch view to Trade when token is selected!
    } else {
      const newUrl = `${window.location.origin}/dashboard`;
      window.history.pushState({ path: newUrl }, '', newUrl);
    }
  };

  return (
    <div className="min-h-screen flex antialiased selection:bg-blue-900 selection:text-white">
      
      {/* 1. Desktop Sidebar Navigation (Luxury White & Calm Blue layout) */}
      <aside className="hidden lg:flex w-72 flex-col bg-[var(--bg-sidebar)] border-r border-[var(--border-dim)] p-6 space-y-8 sticky top-0 h-screen justify-between z-30">
        <div className="space-y-8">
          {/* Brand header */}
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 rounded-xl overflow-hidden shadow-sm shadow-blue-500/10">
              <img src="/main-logo.jpg" alt="ArcOmni" className="w-full h-full object-contain p-0.5" />
            </div>
            <div>
              <span className="text-sm font-black tracking-wide text-[var(--text-primary)] block">ARCOMNI</span>
              <span className="text-[9px] block font-extrabold text-[var(--accent-gold)] tracking-widest mt-[-2px] uppercase">PRO</span>
            </div>
          </div>

          {/* Nav links */}
          <nav className="space-y-1.5">
            {/* Launcher Tab */}
            <button 
              onClick={() => {
                setCurrentView('launcher');
              }}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-xs font-bold transition-all hover:scale-[1.01] ${
                currentView === 'launcher'
                  ? 'text-white bg-[rgba(212,167,44,0.2)] border-l-[3px] border-l-[var(--accent-gold)] shadow-sm shadow-orange-500/10'
                  : 'text-[var(--text-secondary)] hover:bg-[rgba(212,167,44,0.1)] border border-transparent hover:text-[var(--text-bright)]'
              }`}
            >
              <Rocket size={16} className={currentView === 'launcher' ? 'text-[var(--accent-gold)]' : 'text-[var(--text-secondary)]'} />
              Launcher
            </button>

            {/* Builder Tab */}
            <button 
              onClick={() => {
                setCurrentView('builder');
              }}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-xs font-bold transition-all hover:scale-[1.01] ${
                currentView === 'builder'
                  ? 'text-white bg-[rgba(212,167,44,0.2)] border-l-[3px] border-l-[var(--accent-gold)] shadow-sm shadow-orange-500/10'
                  : 'text-[var(--text-secondary)] hover:bg-[rgba(212,167,44,0.1)] border border-transparent hover:text-[var(--text-bright)]'
              }`}
            >
              <Layers size={16} className={currentView === 'builder' ? 'text-[var(--accent-gold)]' : 'text-[var(--text-secondary)]'} />
              Builder
            </button>

            {/* Trade Tab */}
            <button 
              onClick={() => {
                setCurrentView('trade');
              }}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-xs font-bold transition-all hover:scale-[1.01] ${
                currentView === 'trade'
                  ? 'text-white bg-[rgba(212,167,44,0.2)] border-l-[3px] border-l-[var(--accent-gold)] shadow-sm shadow-orange-500/10'
                  : 'text-[var(--text-secondary)] hover:bg-[rgba(212,167,44,0.1)] border border-transparent hover:text-[var(--text-bright)]'
              }`}
            >
              <TrendingUp size={16} className={currentView === 'trade' ? 'text-[var(--accent-gold)]' : 'text-[var(--text-secondary)]'} />
              Trade
            </button>

            {/* Guide (New) Tab */}
            <button 
              onClick={() => {
                setCurrentView('guide');
              }}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-xs font-bold transition-all hover:scale-[1.01] ${
                currentView === 'guide'
                  ? 'text-white bg-[rgba(212,167,44,0.2)] border-l-[3px] border-l-[var(--accent-gold)] shadow-sm shadow-orange-500/10'
                  : 'text-[var(--text-secondary)] hover:bg-[rgba(212,167,44,0.1)] border border-transparent hover:text-[var(--text-bright)]'
              }`}
            >
              <Info size={16} className={currentView === 'guide' ? 'text-[var(--accent-gold)]' : 'text-[var(--text-secondary)]'} />
              User Guide
            </button>

            {/* Staking & Yield Tab */}
            <button 
              onClick={() => {
                setCurrentView('staking');
              }}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-xs font-bold transition-all hover:scale-[1.01] ${
                currentView === 'staking'
                  ? 'text-white bg-[rgba(212,167,44,0.2)] border-l-[3px] border-l-[var(--accent-gold)] shadow-sm shadow-orange-500/10'
                  : 'text-[var(--text-secondary)] hover:bg-[rgba(212,167,44,0.1)] border border-transparent hover:text-[var(--text-bright)]'
              }`}
            >
              <TrendingUp size={16} className={currentView === 'staking' ? 'text-[var(--accent-gold)]' : 'text-[var(--text-secondary)]'} />
              Staking & Yield
            </button>

            <button 
              onClick={() => {
                setCurrentView('social-pay');
              }}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-xs font-bold transition-all hover:scale-[1.01] ${
                currentView === 'social-pay'
                  ? 'text-white bg-[rgba(212,167,44,0.2)] border-l-[3px] border-l-[var(--accent-gold)] shadow-sm shadow-orange-500/10'
                  : 'text-[var(--text-secondary)] hover:bg-[rgba(212,167,44,0.1)] border border-transparent hover:text-[var(--text-bright)]'
              }`}
            >
              <div className="relative flex items-center justify-center">
                <Send size={16} className={currentView === 'social-pay' ? 'text-[var(--accent-gold)]' : 'text-[var(--text-secondary)]'} />
                {unreadChatCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-red-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-sm">
                    {unreadChatCount > 9 ? '9+' : unreadChatCount}
                  </span>
                )}
              </div>
              Social Pay
            </button>

            {/* Market Hub Tab */}
            <button 
              onClick={() => setCurrentView('markethub')}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-xs font-bold transition-all hover:scale-[1.01] ${
                currentView === 'markethub'
                  ? 'text-white bg-[rgba(212,167,44,0.2)] border-l-[3px] border-l-[var(--accent-gold)] shadow-sm shadow-orange-500/10'
                  : 'text-[var(--text-secondary)] hover:bg-[rgba(212,167,44,0.1)] border border-transparent hover:text-[var(--text-bright)]'
              }`}
            >
              <ShoppingCart size={16} className={currentView === 'markethub' ? 'text-[var(--accent-gold)]' : 'text-[var(--text-secondary)]'} />
              Market Hub
            </button>

            {/* Arc Gigs (New) Tab */}
            <button 
              onClick={() => {
                setCurrentView('gigs');
              }}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-xs font-bold transition-all hover:scale-[1.01] ${
                currentView === 'gigs'
                  ? 'text-white bg-[rgba(212,167,44,0.2)] border-l-[3px] border-l-[var(--accent-gold)] shadow-sm shadow-orange-500/10'
                  : 'text-[var(--text-secondary)] hover:bg-[rgba(212,167,44,0.1)] border border-transparent hover:text-[var(--text-bright)]'
              }`}
            >
              <Briefcase size={16} className={currentView === 'gigs' ? 'text-[var(--accent-gold)]' : 'text-[var(--text-secondary)]'} />
              Arc Gigs
            </button>

            {/* Prediction Market Tab */}
            <button 
              onClick={() => setCurrentView('prediction-market')}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-xs font-bold transition-all hover:scale-[1.01] ${
                currentView === 'prediction-market'
                  ? 'text-white bg-[rgba(212,167,44,0.2)] border-l-[3px] border-l-[var(--accent-gold)] shadow-sm shadow-orange-500/10'
                  : 'text-[var(--text-secondary)] hover:bg-[rgba(212,167,44,0.1)] border border-transparent hover:text-[var(--text-bright)]'
              }`}
            >
              <PieChart size={16} className={currentView === 'prediction-market' ? 'text-[var(--accent-gold)]' : 'text-[var(--text-secondary)]'} />
              Predictions
            </button>

            {/* Arc Ecosystem Tab */}
            <button 
              onClick={() => setCurrentView('arc-ecosystem')}
              className={`w-full flex items-center gap-3.5 px-4.5 py-3 rounded-2xl text-xs font-bold transition-all hover:scale-[1.01] ${
                currentView === 'arc-ecosystem'
                  ? 'text-[var(--accent-gold)] bg-[rgba(0,242,254,0.05)] border border-[var(--border-dim)] shadow-sm shadow-blue-500/5'
                  : 'text-[var(--text-secondary)] hover:bg-slate-50 border border-transparent hover:text-[var(--text-primary)]'
              }`}
            >
              <Activity size={16} className={currentView === 'arc-ecosystem' ? 'text-[var(--accent-gold)]' : 'text-[var(--text-secondary)]'} />
              Arc Ecosystem
            </button>

            {/* ArcSlots Tab */}
            <button 
              onClick={() => setCurrentView('slots')}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-xs font-bold transition-all hover:scale-[1.01] ${
                currentView === 'slots'
                  ? 'text-white bg-[rgba(212,167,44,0.2)] border-l-[3px] border-l-[var(--accent-gold)] shadow-sm shadow-orange-500/10'
                  : 'text-[var(--text-secondary)] hover:bg-[rgba(212,167,44,0.1)] border border-transparent hover:text-[var(--text-bright)]'
              }`}
            >
              <Dices size={16} className={currentView === 'slots' ? 'text-[var(--accent-gold)]' : 'text-[var(--text-secondary)]'} />
              ArcSlots
            </button>

            {/* Dedicated Leaderboard Tab */}
            <button 
              onClick={() => setCurrentView('leaderboard')}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-xs font-bold transition-all hover:scale-[1.01] ${
                currentView === 'leaderboard'
                  ? 'text-white bg-[rgba(212,167,44,0.2)] border-l-[3px] border-l-[var(--accent-gold)] shadow-sm shadow-orange-500/10'
                  : 'text-[var(--text-secondary)] hover:bg-[rgba(212,167,44,0.1)] border border-transparent hover:text-[var(--text-bright)]'
              }`}
            >
              <Trophy size={16} className={currentView === 'leaderboard' ? 'text-[var(--accent-gold)]' : 'text-[var(--text-secondary)]'} />
              Leaderboard
            </button>

            {/* Dedicated Affiliates Tab */}
            <button 
              onClick={() => setCurrentView('affiliates')}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-xs font-bold transition-all hover:scale-[1.01] ${
                currentView === 'affiliates'
                  ? 'text-white bg-[rgba(212,167,44,0.2)] border-l-[3px] border-l-[var(--accent-gold)] shadow-sm shadow-orange-500/10'
                  : 'text-[var(--text-secondary)] hover:bg-[rgba(212,167,44,0.1)] border border-transparent hover:text-[var(--text-bright)]'
              }`}
            >
              <Users size={16} className={currentView === 'affiliates' ? 'text-[var(--accent-gold)]' : 'text-[var(--text-secondary)]'} />
              Affiliates
            </button>

            {/* USDC Faucet Link */}
            <a 
              href="https://faucet.circle.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-xs font-bold transition-all text-[var(--text-secondary)] hover:bg-slate-50 hover:text-[var(--text-primary)] hover:scale-[1.01] border border-transparent"
            >
              <Droplet size={16} className="text-[var(--text-secondary)]" />
              USDC Faucet
            </a>

            {/* Earn coming soon glow badge */}
            <button 
              onClick={() => {
                setCurrentView('earn');
              }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold transition-all hover:scale-[1.01] ${
                currentView === 'earn'
                  ? 'text-white bg-[rgba(212,167,44,0.2)] border-l-[3px] border-l-[var(--accent-gold)] shadow-sm shadow-orange-500/10'
                  : 'text-[var(--text-secondary)] hover:bg-[rgba(212,167,44,0.1)] border border-transparent hover:text-[var(--text-bright)]'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <Coins size={16} className={currentView === 'earn' ? 'text-[var(--accent-gold)]' : 'text-[var(--text-secondary)]'} />
                <span>Earn Points</span>
              </div>
              {/* Glowing Pill badge */}
              <span className="text-[9px] bg-[rgba(0,242,254,0.1)] text-[var(--accent-gold)] px-2 py-0.5 rounded-full font-black uppercase tracking-widest border border-[var(--border-dim)] animate-pulse">
                Soon
              </span>
            </button>

            {/* Global Wallet Tab */}
            <button 
              onClick={() => {
                setCurrentView('wallet');
              }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold transition-all hover:scale-[1.01] ${
                currentView === 'wallet'
                  ? 'text-white bg-[rgba(212,167,44,0.2)] border-l-[3px] border-l-[var(--accent-gold)] shadow-sm shadow-orange-500/10'
                  : 'text-[var(--text-secondary)] hover:bg-[rgba(212,167,44,0.1)] border border-transparent hover:text-[var(--text-bright)]'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <Coins size={16} className={currentView === 'wallet' ? 'text-[var(--accent-gold)]' : 'text-[var(--text-secondary)]'} />
                <span>Global Wallet</span>
              </div>
              <span className="text-[9px] bg-[rgba(0,242,254,0.05)]0 text-white px-2 py-0.5 rounded-full font-black uppercase tracking-widest border border-blue-600 animate-pulse">
                Live
              </span>
            </button>

            {/* Airdrop Rules modal opener */}
            <button 
              type="button"
              onClick={(e) => { e.stopPropagation(); setIsRulesOpen(true); setIsLockerOpen(false); }}
              className="w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-xs font-bold text-[var(--text-secondary)] hover:bg-slate-50 transition-all hover:text-[var(--text-primary)] border border-transparent"
            >
              <HelpCircle size={16} className="text-[var(--text-secondary)]" />
              Airdrop Rules
            </button>
          </nav>
        </div>

        {/* Your Wallet Balances Card */}
        {isConnected && (
          <div className="card p-5 space-y-3 select-none">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[var(--text-secondary)] font-extrabold uppercase tracking-wider">Your Wallet</span>
              <span className="text-[9px] bg-[rgba(0,242,254,0.1)] text-[var(--accent-gold)] font-black px-2 py-0.5 rounded-full uppercase tracking-wider border border-[var(--border-dim)]">
                Arc Chain Assets
              </span>
            </div>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs">🔵</span>
                  <span className="text-[11px] font-bold text-[var(--text-primary)]">USDC Balance</span>
                </div>
                <span className="text-xs font-extrabold text-[var(--text-primary)]">
                  {usdcWalletBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="w-full h-[1px] bg-[var(--border-dim)]" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs">🟣</span>
                  <span className="text-[11px] font-bold text-[var(--text-primary)]">EURC (Euro) Balance</span>
                </div>
                <span className="text-xs font-extrabold text-[var(--text-primary)]">
                  {eurcWalletBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="w-full h-[1px] bg-[var(--border-dim)]" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs">🟡</span>
                  <span className="text-[11px] font-bold text-[var(--text-primary)]">cirBTC Balance</span>
                </div>
                <span className="text-xs font-extrabold text-[var(--text-primary)]">
                  {cirbtcWalletBalance.toLocaleString(undefined, { minimumFractionDigits: 8, maximumFractionDigits: 8 })}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Sidebar Staking & Yield card */}
        <button
          type="button"
          onClick={() => {
            setCurrentView('staking');
            setIsRulesOpen(false);
          }}
          className="card p-5 space-y-3.5 cursor-pointer group text-left"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[var(--text-secondary)] font-extrabold uppercase tracking-wider group-hover:text-[var(--accent-gold)] transition-colors">Staking & Yield</span>
            <span className="bg-[rgba(0,242,254,0.1)] text-[var(--accent-gold)] border border-[var(--border-dim)] text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
              Live
            </span>
          </div>
          <div>
            <h4 className="text-lg font-black text-[var(--text-primary)] tracking-tight">
              Open the live vaults
            </h4>
            <p className="text-[10px] text-[var(--text-secondary)] font-semibold mt-2 leading-relaxed">
              Review APY, wallets, and wallet-signed staking actions for USDC, EURC, and cirBTC in one place.
            </p>
          </div>
        </button>
      </aside>

      {/* 2. Main content viewport area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 w-full space-y-6">
          <Header />
          <NetworkGuard />
          
          <motion.main initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.1 }} className="space-y-8">
            {/* LAUNCHER TAB VIEW */}
            {currentView === 'launcher' && (
              <>
                {/* Elegant Welcome Banner */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 stat-box rounded-[32px] p-6">
                  <div>
                    <h2 className="text-2xl font-black text-[var(--text-primary)] flex items-center gap-2">
                      Hello, {profileName} 👋
                    </h2>
                    <p className="text-xs text-[var(--text-secondary)] font-semibold mt-0.5">Explore active markets, launch customized tokens, and claim points allocations.</p>
                  </div>

                  {/* Daily Check-in Interaction Block */}
                  {isConnected && (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleDailyCheckin}
                        disabled={checkinLoading || !!(checkinStats?.last_checkin && new Date(checkinStats.last_checkin).toDateString() === new Date().toDateString())}
                        className={`px-5 py-3 rounded-2xl text-xs font-black tracking-wide uppercase transition-all duration-150 flex items-center gap-2 shadow-md cursor-pointer ${
                          !!(checkinStats?.last_checkin && new Date(checkinStats.last_checkin).toDateString() === new Date().toDateString())
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 cursor-not-allowed shadow-none'
                            : 'deploy-btn active:scale-[0.98]'
                        }`}
                      >
                        {checkinLoading ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>Checking In...</span>
                          </>
                        ) : checkinStats?.last_checkin && new Date(checkinStats.last_checkin).toDateString() === new Date().toDateString() ? (
                          <>
                            <span>✓ Checked In Today</span>
                          </>
                        ) : (
                          <>
                            <span>📅 Daily Check-in</span>
                          </>
                        )}
                      </button>

                      {/* Tiny Streak info display */}
                      {checkinStats && (
                        <div className="text-left font-semibold">
                          <span className="text-[10px] text-[var(--text-secondary)] block uppercase tracking-widest">Check-in Streak</span>
                          <span className="text-xs text-[var(--text-primary)] font-extrabold flex items-center gap-1">
                            🔥 {checkinStats.streak_count} Days 
                            <span className="text-slate-300 font-normal">|</span> 
                            ⚠️ {checkinStats.missed_count} Missed
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>

                {/* Global Dashboard Stats */}
                <DashboardStats /> 

                {/* Main Interactive Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Left Column - Token Launch Form */}
                  <div className="lg:col-span-1 space-y-8">
                    <LaunchForm />
                  </div>

                  {/* Right Column - Recent Token Releases List */}
                  <div className="lg:col-span-2 space-y-8">
                    <div className="h-[600px] flex flex-col">
                      <div className="p-4 bg-[rgba(0,242,254,0.05)] border border-[var(--border-dim)] rounded-3xl mb-4 text-xs font-bold text-[var(--accent-gold)] flex items-center gap-2">
                        <Info size={14} className="text-[var(--accent-gold)]" />
                        Click any token on the markets list below to open its dedicated Trade desk & Price Charts!
                      </div>
                      <div className="flex-1 min-h-0">
                        <Leaderboard onSelectToken={handleSelectToken} onlyArcOmni={true} />
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* TRADE TAB VIEW */}
            {currentView === 'trade' && (
              <>
                {selectedToken ? (
                  <div className="space-y-8 animate-in fade-in duration-200">
                    {/* Dynamic title bar for trade */}
                    <div className="flex items-center justify-between card rounded-[28px] p-5 shadow-sm">
                      <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-xl overflow-hidden bg-[rgba(6,8,20,0.5)] border border-[var(--border-dim)] flex items-center justify-center">
                          {selectedToken.image_url ? (
                            <img src={selectedToken.image_url} alt="" className="w-full h-full object-contain p-0.5" />
                          ) : (
                            <TrendingUp className="text-[var(--text-secondary)]" size={18} />
                          )}
                        </div>
                        <div>
                          <h3 className="font-extrabold text-[var(--text-primary)] text-base flex items-center gap-1.5">
                            {selectedToken.name}
                            <span className="text-xs bg-[rgba(0,242,254,0.1)] text-[var(--accent-gold)] border border-[var(--border-dim)] px-2 py-0.5 rounded font-black uppercase">{selectedToken.ticker}</span>
                          </h3>
                          <p className="text-[10px] text-[var(--text-secondary)] font-mono mt-0.5">{selectedToken.token_address}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleSelectToken(null)}
                        className="text-xs bg-[rgba(6,8,20,0.5)] hover:bg-[rgba(13,17,39,0.8)] border border-[var(--border-dim)] hover:border-[var(--border-glow)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-extrabold px-4 py-2 rounded-2xl transition-all cursor-pointer shadow-sm"
                      >
                        ← View Other Markets
                      </button>
                    </div>

                    {/* Trading Dashboard Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                      <div className="lg:col-span-1">
                        <TradingPanel token={selectedToken} />
                      </div>
                      <div className="lg:col-span-2 space-y-8">
                        <PriceChart selectedToken={selectedToken} />
                        <TransactionHistory tokenAddress={selectedToken.token_address} />
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Market Selector if no token is currently selected */
                  <div className="stat-box rounded-[32px] p-8 space-y-6 animate-in fade-in duration-200">
                    <div className="text-center max-w-md mx-auto space-y-2 py-4">
                      <TrendingUp className="mx-auto text-[var(--accent-gold)]" size={32} />
                      <h2 className="text-xl font-black text-[var(--text-primary)]">Meme Markets Trading Desk</h2>
                      <p className="text-xs text-[var(--text-secondary)] font-semibold leading-relaxed">
                        Select an active token from the live markets index below to open live charts, view transactions history, and place trades instantly.
                      </p>
                    </div>
                    <div className="h-[550px]">
                      <Leaderboard onSelectToken={handleSelectToken} onlyArcOmni={true} />
                    </div>
                  </div>
                )}
              </>
            )}

            {/* SOCIAL PAY TAB VIEW */}
            {currentView === 'social-pay' && (
              <div className="animate-in fade-in duration-200 space-y-8">
                <UserProfileDrawer />
              </div>
            )}

            {/* MARKET HUB VIEW */}
            {currentView === 'markethub' && (
              <div className="animate-in fade-in duration-200">
                <MarketHubView />
              </div>
            )}

            {/* FREELANCE HUB (GIGS) VIEW */}
            {currentView === 'gigs' && (
              <div className="animate-in fade-in duration-200">
                <FreelanceHub />
              </div>
            )}

            {/* PREDICTION MARKET TAB VIEW */}
            {currentView === 'prediction-market' && (
              <PredictionDashboard />
            )}

            {/* ARC ECOSYSTEM TAB VIEW */}
            {currentView === 'arc-ecosystem' && (
              <ArcEcosystemHub />
            )}

            {/* ARCSLOTS TAB VIEW */}
            {currentView === 'slots' && (
              <div className="animate-in fade-in duration-200">
                <ArcSlotsDashboard />
              </div>
            )}

            {/* BUILDER TAB VIEW */}
            {currentView === 'builder' && (
              <div className="animate-in fade-in duration-200">
                <BuilderDashboard />
              </div>
            )}

            {/* LEADERBOARD TAB VIEW */}
            {currentView === 'leaderboard' && (
              <div className="card rounded-[32px] p-6 sm:p-8 shadow-sm animate-in fade-in duration-200">
                <Leaderboard onSelectToken={handleSelectToken} onlyArcOmni={true} />
              </div>
            )}

            {/* AFFILIATES TAB VIEW */}
            {currentView === 'affiliates' && (
              <div className="animate-in fade-in duration-200">
                <AffiliatesView />
              </div>
            )}

            {/* EARN TAB VIEW */}
            {currentView === 'earn' && (
              <div className="animate-in fade-in duration-200 space-y-8">
                <DiscreteTasks onPointsEarned={(points) => { console.log(`Earned ${points}`); }} />
                <div className="card rounded-[32px] p-8 shadow-sm text-center max-w-xl mx-auto space-y-6 py-12">
                  <div className="w-16 h-16 rounded-3xl bg-[rgba(0,242,254,0.05)] border border-[var(--border-dim)] text-[var(--accent-gold)] flex items-center justify-center shadow-lg shadow-blue-500/5 mx-auto animate-bounce">
                  <Coins size={32} />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-black text-[var(--text-primary)] flex items-center justify-center gap-2">
                    Earn Points Program
                    <span className="text-[10px] bg-[rgba(0,242,254,0.1)] text-[var(--accent-gold)] px-2 py-0.5 rounded-full font-black uppercase tracking-widest border border-[var(--border-dim)] animate-pulse">Soon</span>
                  </h2>
                  <p className="text-xs text-[var(--text-secondary)] font-semibold leading-relaxed">
                    Earn yields, multiply your ARCL points allocations, and unlock VIP privileges. The referral and points-staking protocol is launching soon on Arc Chain.
                  </p>
                </div>
                
                <div className="grid grid-cols-3 gap-4 text-left pt-4">
                  <div className="border border-[var(--border-dim)] p-4 bg-slate-50/50 rounded-2xl">
                    <span className="text-lg block mb-1">🤝</span>
                    <h4 className="text-[11px] font-black text-[var(--text-primary)] uppercase tracking-wider">Referral Bonanza</h4>
                    <p className="text-[10px] text-[var(--text-secondary)] mt-1 font-semibold leading-normal">Invite friends and earn 10% of all points they accumulate forever.</p>
                  </div>
                  <div className="border border-[var(--border-dim)] p-4 bg-slate-50/50 rounded-2xl">
                    <span className="text-lg block mb-1">🔥</span>
                    <h4 className="text-[11px] font-black text-[var(--text-primary)] uppercase tracking-wider">Streaks Boost</h4>
                    <p className="text-[10px] text-[var(--text-secondary)] mt-1 font-semibold leading-normal">Keep check-in streaks to earn up to 2.5x multiplier on trading points.</p>
                  </div>
                  <div className="border border-[var(--border-dim)] p-4 bg-slate-50/50 rounded-2xl">
                    <span className="text-lg block mb-1">💎</span>
                    <h4 className="text-[11px] font-black text-[var(--text-primary)] uppercase tracking-wider">Staking Rewards</h4>
                    <p className="text-[10px] text-[var(--text-secondary)] mt-1 font-semibold leading-normal">Stake ARCL points or locks to earn direct USDC gas rebates.</p>
                  </div>
                </div>
              </div>
              </div>
            )}

            {/* GLOBAL WALLET VIEW */}
            {currentView === 'wallet' && (
              <div className="animate-in fade-in duration-200">
                <ArcWallet />
              </div>
            )}

            {/* GUIDE VIEW */}
            {currentView === 'guide' && <UserGuide />}

            {/* STAKING & YIELD VIEW */}
            {currentView === 'staking' && <ArcYield />}
          </motion.main>
        </div>
      </div>

      {/* Airdrop Rules Modal Overlay (Premium design) */}
      {isRulesOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md glass-modal p-8 space-y-6 relative border border-white">
            <button
              onClick={() => setIsRulesOpen(false)}
              className="absolute top-4 right-4 text-[var(--text-secondary)] hover:text-[var(--text-secondary)] p-2 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
            >
              ✕
            </button>

            <div className="text-center space-y-1.5">
              <Award className="text-[var(--accent-gold)] mx-auto" size={32} />
              <h2 className="text-xl font-black text-[var(--text-primary)]">Airdrop points mechanics</h2>
              <p className="text-xs text-[var(--text-secondary)]">Every swap you execute generates points allocations instantly.</p>
            </div>

            <div className="space-y-4 text-xs font-semibold text-[var(--text-primary)] bg-[rgba(6,10,38,0.9)] border border-[var(--border-dim)] p-5 rounded-2xl">
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-[rgba(0,242,254,0.1)] text-[var(--accent-gold)] flex items-center justify-center text-[10px] font-bold flex-shrink-0">1</div>
                <div>
                  <p className="text-[var(--text-primary)] font-extrabold text-sm mb-0.5">High-Frequency Swaps</p>
                  <p className="text-[var(--text-secondary)] text-xs font-medium leading-relaxed">Each trade on active tokens counts toward volume. Whether you buy or sell, you accumulate trading weight.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 border-t border-[var(--border-dim)] pt-3">
                <div className="w-5 h-5 rounded-full bg-[rgba(0,242,254,0.1)] text-[var(--accent-gold)] flex items-center justify-center text-[10px] font-bold flex-shrink-0">2</div>
                <div>
                  <p className="text-[var(--text-primary)] font-extrabold text-sm mb-0.5">10 USDC = 1 ARCL Point</p>
                  <p className="text-[var(--text-secondary)] text-xs font-medium leading-relaxed">Points are computed in real-time on database insertion: total USD volume traded divided by 10. These accumulate forever.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 border-t border-[var(--border-dim)] pt-3">
                <div className="w-5 h-5 rounded-full bg-[rgba(0,242,254,0.1)] text-[var(--accent-gold)] flex items-center justify-center text-[10px] font-bold flex-shrink-0">3</div>
                <div>
                  <p className="text-[var(--text-primary)] font-extrabold text-sm mb-0.5">Claim Rewards Later</p>
                  <p className="text-[var(--text-secondary)] text-xs font-medium leading-relaxed">Points determine your share of the upcoming ARCL Airdrop pool. The higher you rank on the earners list, the larger your payout!</p>
                </div>
              </div>

              <div className="flex items-start gap-3 border-t border-[var(--border-dim)] pt-3">
                <div className="w-5 h-5 rounded-full bg-[rgba(0,242,254,0.1)] text-[var(--accent-gold)] flex items-center justify-center text-[10px] font-bold flex-shrink-0">4</div>
                <div>
                  <p className="text-[var(--text-primary)] font-extrabold text-sm mb-0.5">⭐ Partner Affiliate Badge</p>
                  <p className="text-[var(--text-secondary)] text-xs font-medium leading-relaxed">Get the exclusive Partner Affiliate badge by either: (1) Launching a token whose price successfully touches $1.00 USDC, OR (2) Completing 30 consecutive days of Daily Check-ins!</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsRulesOpen(false)}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all flex items-center justify-center gap-1.5"
            >
              Start Trading Now <ArrowRight size={13} />
            </button>
              {/* Premium Liquidity Locker Modal (Version 2 Upgraded) */}
      {isLockerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-slate-900/40 transition-all duration-200 animate-in fade-in">
          <div className="bg-slate-950/95 border border-[var(--border-dim)] shadow-2xl rounded-[32px] p-6 max-w-lg w-full space-y-6 transform transition-all scale-100 animate-in zoom-in-95 duration-200 text-slate-100">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-blue-600/10 text-blue-400 shadow-lg shadow-blue-500/10 border border-blue-500/20 animate-pulse">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black tracking-wider text-white uppercase">Liquidity Locker V2</h3>
                  <p className="text-[9px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">Lock and claim USDC, EURC, & Tokens</p>
                </div>
              </div>
              <button 
                onClick={() => setIsLockerOpen(false)}
                className="text-[var(--text-secondary)] hover:text-slate-200 text-xs font-black cursor-pointer bg-slate-900 hover:bg-slate-800 p-2 rounded-full transition-all"
              >
                ✕
              </button>
            </div>

            {/* Total Locked Display inside Modal */}
            <div className="btn-primary rounded-3xl p-5 text-white flex items-center justify-between shadow-lg shadow-blue-500/20">
              <div>
                <p className="text-[8px] font-black uppercase tracking-widest text-blue-100">Total System Locked</p>
                <h4 className="text-3xl font-black mt-1">
                  ${totalLockedUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h4>
              </div>
              <div className="text-right">
                <p className="text-[8px] font-black uppercase tracking-widest text-blue-100">Lock Duration</p>
                <p className="text-xs font-bold mt-1 bg-[var(--bg-card)]/10 px-3 py-1 rounded-full border border-white/20">30 Days (1 Month)</p>
              </div>
            </div>

            {/* Form & List Tabs */}
            <div className="flex gap-2 p-1 bg-slate-900 rounded-2xl">
              <button
                onClick={() => setLockerTab('lock')}
                className={`flex-1 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                  lockerTab === 'lock' 
                    ? 'bg-slate-850 text-white shadow-sm border border-[var(--border-dim)]' 
                    : 'text-[var(--text-secondary)] hover:text-slate-350'
                }`}
              >
                Create Lock
              </button>
              <button
                onClick={() => setLockerTab('my_locks')}
                className={`flex-1 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  lockerTab === 'my_locks' 
                    ? 'bg-slate-850 text-white shadow-sm border border-[var(--border-dim)]' 
                    : 'text-[var(--text-secondary)] hover:text-slate-350'
                }`}
              >
                My Active Locks
                {myLocks.length > 0 && (
                  <span className="bg-blue-600 text-white text-[8px] px-1.5 py-0.5 rounded-full font-black animate-pulse">
                    {myLocks.length}
                  </span>
                )}
              </button>
            </div>

            {lockerTab === 'lock' ? (
              /* CREATE LOCK FORM */
              <div className="space-y-4">
                {/* Asset Type Selector */}
                <div className="space-y-1.5">
                  <span className="text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Select Asset to Lock</span>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { type: 'USDC', label: 'USDC', desc: '$1.00 USD' },
                      { type: 'EURC', label: 'EURC', desc: '$1.09 USD' },
                      { type: 'PLATFORM_TOKEN', label: 'Meme Coin', desc: 'Bond Curve' },
                      { type: 'CUSTOM_ERC20', label: 'Custom', desc: 'ERC20' },
                    ].map((item) => (
                      <button
                        key={item.type}
                        type="button"
                        onClick={() => {
                          setLockAssetType(item.type as any);
                          if (item.type === 'USDC') {
                            setLockAddress('0x3600000000000000000000000000000000000000');
                            setLockTicker('USDC');
                          } else if (item.type === 'EURC') {
                            setLockAddress('0xeC00000000000000000000000000000000000000');
                            setLockTicker('EURC');
                          } else {
                            setLockAddress('');
                            setLockTicker('');
                          }
                        }}
                        className={`py-2 px-1 rounded-xl font-black text-[10px] transition-all border cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                          lockAssetType === item.type
                            ? 'border-blue-500 bg-blue-950/40 text-blue-400' 
                            : 'border-[var(--border-dim)] bg-slate-900/40 text-[var(--text-secondary)] hover:bg-slate-900/70'
                        }`}
                      >
                        <span>{item.label}</span>
                        <span className="text-[7.5px] font-mono text-[var(--text-secondary)] font-bold">{item.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dynamic Selection for Launched Platform Meme Tokens */}
                {lockAssetType === 'PLATFORM_TOKEN' && (
                  <div className="space-y-1.5">
                    <span className="text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Select Launched Meme Token</span>
                    <div className="grid grid-cols-3 gap-2 max-h-[90px] overflow-y-auto bg-slate-900 border border-[var(--border-dim)] rounded-2xl p-2 pr-1">
                      {tokensList.length === 0 ? (
                        <p className="text-[9px] text-[var(--text-secondary)] col-span-3 text-center py-2">No active tokens launched yet.</p>
                      ) : (
                        tokensList.map((tok: any) => (
                          <button
                            key={tok.id}
                            type="button"
                            onClick={() => {
                              setLockAddress(tok.token_address);
                              setLockTicker(tok.ticker);
                            }}
                            className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                              lockAddress.toLowerCase() === tok.token_address.toLowerCase()
                                ? 'border-blue-500 bg-blue-950/60'
                                : 'border-[var(--border-dim)] bg-slate-950 hover:border-[var(--border-dim)]'
                            }`}
                          >
                            <span className="text-[9px] font-black text-white truncate block">{tok.ticker}</span>
                            <span className="text-[7px] text-[var(--text-secondary)] font-mono truncate block">{tok.name}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Custom Token Details Inputs */}
                {lockAssetType === 'CUSTOM_ERC20' && (
                  <div className="space-y-3 p-3 bg-slate-900/50 border border-[var(--border-dim)] rounded-2xl animate-in slide-in-from-top-2 duration-150">
                    <div className="space-y-1">
                      <span className="text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Contract Address</span>
                      <input
                        type="text"
                        value={lockAddress}
                        onChange={(e) => setLockAddress(e.target.value)}
                        placeholder="0x..."
                        className="w-full bg-slate-955 border border-[var(--border-dim)] text-white placeholder-slate-700 rounded-xl p-2.5 text-xs font-mono outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <span className="text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Ticker Symbol</span>
                        <input
                          type="text"
                          value={lockTicker}
                          onChange={(e) => setLockTicker(e.target.value)}
                          placeholder="e.g. LINK"
                          className="w-full bg-slate-955 border border-[var(--border-dim)] text-white placeholder-slate-700 rounded-xl p-2.5 text-xs font-black outline-none focus:border-blue-500 uppercase"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest">USD Price Estimate ($)</span>
                        <input
                          type="number"
                          step="0.01"
                          value={lockCustomPrice}
                          onChange={(e) => setLockCustomPrice(e.target.value)}
                          placeholder="1.00"
                          className="w-full bg-slate-955 border border-[var(--border-dim)] text-white placeholder-slate-700 rounded-xl p-2.5 text-xs font-bold outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Amount Input */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
                    <span>Amount to Lock</span>
                    <span className="flex items-center gap-1">
                      Available: <span className="text-slate-350 font-bold">{tokenBalance.toFixed(2)} {lockTicker || 'TOKENS'}</span>
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      value={lockAmount}
                      onChange={(e) => setLockAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-slate-900 border border-[var(--border-dim)] text-white placeholder-slate-650 rounded-2xl p-4 pr-20 text-sm font-extrabold outline-none focus:border-blue-500 focus:bg-slate-950"
                    />
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setLockAmount(tokenBalance.toString())}
                        className="text-[8.5px] uppercase font-black px-2 py-1 rounded bg-slate-800 hover:bg-slate-750 text-slate-300 border border-[var(--border-dim)] cursor-pointer shadow-sm"
                      >
                        Max
                      </button>
                      <span className="text-[10px] font-black text-[var(--text-secondary)] tracking-wider">
                        {lockTicker || 'TOKEN'}
                      </span>
                    </div>
                  </div>

                  {/* Worth Display */}
                  <div className="bg-slate-900 border border-[var(--border-dim)] rounded-2xl p-3 flex justify-between items-center text-[10px] font-bold">
                    <span className="text-[var(--text-secondary)]">Estimated Worth (USD):</span>
                    <span className="text-emerald-400 font-mono font-black flex items-center gap-1.5">
                      {isFetchingWorth ? (
                        <span className="w-2.5 h-2.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></span>
                      ) : null}
                      ${estimatedWorthUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCreateLock}
                  disabled={!lockAmount || Number(lockAmount) <= 0 || !lockAddress || Number(lockAmount) > tokenBalance}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-[10.5px] tracking-widest uppercase transition-all shadow-lg shadow-blue-500/25 cursor-pointer disabled:opacity-40 active:scale-[0.98] duration-150 flex items-center justify-center gap-1.5"
                >
                  🔒 Lock {lockAmount || '0'} {lockTicker || 'Tokens'} for 30 Days
                </button>
              </div>
            ) : (
              /* MY LOCKS LIST */
              <div className="space-y-3 max-h-[250px] overflow-auto pr-1">
                {myLocks.length === 0 ? (
                  <div className="text-center py-10 text-[var(--text-secondary)] space-y-1">
                    <p className="text-xs font-bold text-[var(--text-secondary)]">No active locks found.</p>
                    <p className="text-[10px]">Create a lock first to secure your assets!</p>
                  </div>
                ) : (
                  myLocks.map((lock) => {
                    const lockedDate = new Date(lock.locked_at);
                    const unlockDate = new Date(lock.unlock_at);
                    const now = new Date();
                    const isUnlockable = now >= unlockDate && !lock.is_withdrawn;
                    
                    // Simple remaining time calculation
                    const remainingTime = unlockDate.getTime() - now.getTime();
                    const remainingDays = Math.max(0, Math.ceil(remainingTime / (1000 * 60 * 60 * 24)));

                    return (
                      <div key={lock.id} className="bg-slate-900 border border-[var(--border-dim)] rounded-2xl p-4 flex items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-black text-white">
                              {lock.amount} {lock.token_ticker}
                            </span>
                            <span className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase ${
                              lock.is_withdrawn
                                ? 'bg-slate-800 text-[var(--text-secondary)]'
                                : isUnlockable
                                ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-900/30 animate-pulse'
                                : 'bg-amber-950/80 text-amber-400 border border-amber-900/30'
                            }`}>
                              {lock.is_withdrawn ? 'Withdrawn' : isUnlockable ? 'Unlockable' : `${remainingDays}d Left`}
                            </span>
                          </div>
                          <div className="flex flex-col gap-0.5 text-[8px] text-[var(--text-secondary)] font-mono">
                            <p>USD Worth: <span className="text-emerald-500 font-bold">${Number(lock.usdc_worth || 0).toFixed(2)}</span></p>
                            <p>Locked: {lockedDate.toLocaleDateString()} | Unlocks: {unlockDate.toLocaleDateString()}</p>
                          </div>
                        </div>

                        {!lock.is_withdrawn && (
                          <button
                            type="button"
                            onClick={() => handleUnlockAsset(lock.id)}
                            disabled={!isUnlockable}
                            className={`px-3 py-2 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all cursor-pointer ${
                              isUnlockable
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20'
                                : 'bg-slate-800 text-slate-650 cursor-not-allowed border border-[var(--border-dim)]'
                            }`}
                          >
                            Withdraw 🔓
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      )}
          </div>
        </div>
      )}

      {/* Premium Styled Dialog Alert Overlay */}
      {premiumAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-slate-900/20 transition-all duration-200 animate-in fade-in">
          <div className="bg-[var(--bg-card)]/95 border border-[var(--border-dim)] shadow-2xl rounded-[28px] p-6 max-w-sm w-full space-y-5 transform transition-all scale-100 animate-in zoom-in-95 duration-200">
            {/* Header Icon & Title */}
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg ${
                premiumAlert.type === 'success' 
                  ? 'bg-emerald-500/10 text-emerald-600 shadow-emerald-500/10' 
                  : premiumAlert.type === 'error'
                  ? 'bg-rose-500/10 text-rose-600 shadow-rose-500/10'
                  : 'bg-blue-600/10 text-[var(--accent-gold)] shadow-blue-500/10'
              }`}>
                {premiumAlert.type === 'success' ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                ) : premiumAlert.type === 'error' ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                ) : (
                  <Info className="w-5 h-5" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-xs font-black tracking-wider text-[var(--text-primary)] uppercase">{premiumAlert.title}</h3>
                <p className="text-[9px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">ArcOmni Alert</p>
              </div>
            </div>

            {/* Details List */}
            <div className="space-y-3 bg-[rgba(6,10,38,0.9)] border border-[var(--border-dim)] rounded-2xl p-4 font-mono text-[10px] text-[var(--text-secondary)]">
              {premiumAlert.details.map((item, idx) => (
                <div key={idx} className="flex flex-col gap-0.5">
                  <span className="text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest">{item.label}</span>
                  <span className="text-[10px] font-bold text-[var(--text-primary)] break-all select-all">{item.value}</span>
                </div>
              ))}
            </div>

            {/* Action Button */}
            <button
              onClick={() => {
                premiumAlert.onClose();
                setPremiumAlert(null);
              }}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-xs tracking-wider uppercase transition-all shadow-lg shadow-blue-500/25 cursor-pointer active:scale-[0.98] duration-150 flex items-center justify-center animate-in zoom-in-90"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
