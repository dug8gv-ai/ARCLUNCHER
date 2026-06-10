'use client';

import { useEffect, useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useDisconnect, usePublicClient } from 'wagmi';
import { User, MessageSquare, Check, Loader2, ChevronDown, Award, Settings, LogOut } from 'lucide-react';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { erc20Abi, formatUnits } from 'viem';
import { USDC_ADDRESS, EURC_ADDRESS } from '@/lib/arcDefiAbi';
import toast from 'react-hot-toast';

// Premium Web3 preset avatars for single-click selection
const PRESET_AVATARS = [
  { name: 'Frianowzki', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Frianowzki' },
  { name: 'Cyber Hunter', url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Felix' },
  { name: 'Pixel Arc', url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=Arc' },
  { name: 'Moon Boy', url: 'https://api.dicebear.com/7.x/lorelei/svg?seed=Crypto' },
  { name: 'Rocket Queen', url: 'https://api.dicebear.com/7.x/miniavs/svg?seed=Luna' },
  { name: 'Diamond Hands', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Nico' },
];

export function Header() {
  const { isConnected, address: userAddress } = useAccount();
  const { disconnect } = useDisconnect();
  const publicClient = usePublicClient();

  // Wallet Balances (Real on-chain)
  const [usdcBalance, setUsdcBalance] = useState<number>(0);
  const [eurcBalance, setEurcBalance] = useState<number>(0);

  // Profile States
  const [profile, setProfile] = useState<{
    name: string;
    avatar: string;
    discord: string;
    twitter: string;
  } | null>(null);

  // Airdrop Stats States
  const [points, setPoints] = useState<number>(0);

  // Modal & Dropdown States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formAvatar, setFormAvatar] = useState('');
  const [formDiscord, setFormDiscord] = useState('');
  const [formTwitter, setFormTwitter] = useState('');

  // Fetch real on-chain USDC & EURC wallet balances
  const fetchWalletBalances = async () => {
    if (!userAddress || !publicClient) return;
    
    let usdcVal = 0;
    let eurcVal = 0;

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

    setUsdcBalance(usdcVal);
    setEurcBalance(eurcVal);
  };

  // Fetch Profile & Airdrop Stats
  const fetchProfileAndStats = async () => {
    if (!userAddress) return;
    const walletLower = userAddress.toLowerCase();

    try {
      // 1. Fetch Profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('wallet', walletLower)
        .single();

      if (profileData && !profileError) {
        setProfile({
          name: profileData.name || 'Anonymous',
          avatar: profileData.avatar || PRESET_AVATARS[0].url,
          discord: profileData.discord || '',
          twitter: profileData.twitter || '',
        });
        setFormName(profileData.name || '');
        setFormAvatar(profileData.avatar || PRESET_AVATARS[0].url);
        setFormDiscord(profileData.discord || '');
        setFormTwitter(profileData.twitter || '');
      } else {
        // Fallback for new connected users
        const defaultProfile = {
          name: 'Anonymous',
          avatar: PRESET_AVATARS[0].url,
          discord: '',
          twitter: '',
        };
        setProfile(defaultProfile);
        setFormName('');
        setFormAvatar(PRESET_AVATARS[0].url);
        setFormDiscord('');
        setFormTwitter('');
      }

      // 2. Fetch Airdrop points
      const { data: statsData } = await supabase
        .from('user_stats')
        .select('points')
        .eq('wallet', walletLower);

      if (statsData && statsData.length > 0) {
        setPoints(Number(statsData[0].points) || 0);
      } else {
        setPoints(0);
      }
    } catch (e) {
      console.error('Error loading profile:', e);
    }
  };

  useEffect(() => {
    if (isConnected && userAddress) {
      fetchProfileAndStats();
      fetchWalletBalances();

      // Listen for window storage changes (e.g. from Page or CircleBridge updates)
      const handleStorageSync = () => {
        fetchWalletBalances();
      };
      window.addEventListener('storage', handleStorageSync);

      // Setup 10-second automatic polling for real on-chain balance updates
      const interval = setInterval(fetchWalletBalances, 10000);

      // Realtime listener for stats & profile updates - Bulletproof JS filtered
      const channel = supabase.channel(`header_updates_${userAddress}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'profiles'
        }, (payload: any) => {
          if (payload.new && payload.new.wallet?.toLowerCase() === userAddress.toLowerCase()) {
            fetchProfileAndStats();
          }
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'user_stats'
        }, (payload: any) => {
          if (payload.new && payload.new.wallet?.toLowerCase() === userAddress.toLowerCase()) {
            fetchProfileAndStats();
          }
        })
        .subscribe();

      return () => {
        window.removeEventListener('storage', handleStorageSync);
        clearInterval(interval);
        supabase.removeChannel(channel);
      };
    } else {
      setProfile(null);
      setPoints(0);
      setUsdcBalance(0);
      setEurcBalance(0);
    }
  }, [isConnected, userAddress, publicClient]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userAddress) return;
    setSaving(true);

    try {
      const walletLower = userAddress.toLowerCase();
      // Check if profile exists
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('wallet', walletLower)
        .single();

      const profilePayload = {
        wallet: walletLower,
        name: formName || 'Anonymous',
        avatar: formAvatar || PRESET_AVATARS[0].url,
        discord: formDiscord,
        twitter: formTwitter,
      };

      let error;
      if (existing) {
        const { error: err } = await supabase
          .from('profiles')
          .update(profilePayload)
          .eq('wallet', walletLower);
        error = err;
      } else {
        const { error: err } = await supabase
          .from('profiles')
          .insert(profilePayload);
        error = err;
      }

      if (error) {
        toast.error('Error saving profile: ' + error.message);
      } else {
        setIsModalOpen(false);
        fetchProfileAndStats();
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Error updating profile: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="stat-box premium-highlight px-6 py-4 mb-8 flex flex-col md:flex-row items-center justify-between gap-4 sticky top-4 z-40 backdrop-blur-md"
      >
        {/* Brand Logo & Info */}
        <div className="flex items-center gap-3">
          <motion.div
            whileHover={{ scale: 1.08, rotate: 4 }}
            transition={{ type: 'spring', stiffness: 300 }}
            className="w-10 h-10 rounded-xl overflow-hidden shadow-lg"
            style={{ boxShadow: '0 0 18px rgba(245,197,66,0.3)' }}
          >
            <img src="/main-logo.jpg" alt="ArcOmni" className="w-full h-full object-contain p-0.5" />
          </motion.div>
          <div>
            <h1 className="text-xl font-black tracking-tight flex items-center gap-2" style={{ color: 'var(--accent-gold)' }}>
              ArcOmni{' '}
              <span className="text-[10px] px-2 py-0.5 rounded-full font-black" style={{ background: 'rgba(245,197,66,0.12)', color: 'var(--accent-gold)', border: '1px solid rgba(245,197,66,0.3)' }}>
                PRO
              </span>
            </h1>
            <p className="text-xs hidden md:block font-medium" style={{ color: 'var(--text-secondary)' }}>
              High-Frequency Premium Token Launchpad
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3 justify-end w-full md:w-auto">
          {/* Network status */}
          <div className="hidden lg:flex items-center gap-2 text-xs px-3 py-1.5 rounded-full font-medium" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-dim)', color: 'var(--text-secondary)' }}>
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Arc Testnet Active
          </div>

          {/* Airdrop points */}
          {isConnected && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold" style={{ background: 'rgba(245,197,66,0.08)', border: '1px solid rgba(245,197,66,0.2)', color: 'var(--accent-gold)' }}>
              <Award size={14} style={{ color: 'var(--accent-gold)' }} />
              <span>Airdrop: <strong className="font-extrabold">{points.toFixed(2)}</strong> ARCL</span>
            </div>
          )}

          {/* Balances */}
          {isConnected && (
            <div className="hidden sm:flex items-center gap-3 px-4 py-2 rounded-full text-xs font-semibold" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-dim)', color: 'var(--text-primary)' }}>
              <div className="flex items-center gap-1">
                <span style={{ color: 'var(--accent-gold)' }}>◈</span>
                <span className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-secondary)' }}>USDC:</span>
                <span className="font-extrabold">{usdcBalance.toFixed(2)}</span>
              </div>
              <div className="w-px h-3" style={{ background: 'var(--border-dim)' }} />
              <div className="flex items-center gap-1">
                <span style={{ color: 'var(--accent-gold)' }}>◈</span>
                <span className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-secondary)' }}>EURC:</span>
                <span className="font-extrabold">{eurcBalance.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Profile dropdown */}
          {isConnected && profile && (
            <div className="relative">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border-dim)', color: 'var(--text-primary)' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(245,197,66,0.45)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-dim)')}
              >
                <div className="w-6 h-6 rounded-full overflow-hidden" style={{ border: '1px solid rgba(245,197,66,0.3)' }}>
                  <img src={profile.avatar} alt="Avatar" className="w-full h-full object-contain p-0.5" />
                </div>
                <span className="max-w-[100px] truncate">{profile.name}</span>
                <ChevronDown size={14} style={{ color: 'var(--text-secondary)' }} />
              </button>

              <AnimatePresence>
              {isDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2.5 w-48 rounded-2xl shadow-2xl py-2 z-50 text-xs font-medium"
                  style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-dim)', color: 'var(--text-primary)' }}
                >
                  <button
                    onClick={() => { setIsDropdownOpen(false); setIsModalOpen(true); }}
                    className="w-full px-4 py-2.5 flex items-center gap-2 text-left cursor-pointer transition-colors"
                    style={{ color: 'var(--text-primary)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(245,197,66,0.06)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <Settings size={14} style={{ color: 'var(--text-secondary)' }} />
                    Profile Settings
                  </button>
                  <button
                    onClick={() => { setIsDropdownOpen(false); disconnect(); }}
                    className="w-full px-4 py-2.5 flex items-center gap-2 text-left cursor-pointer transition-colors text-red-400"
                    style={{ borderTop: '1px solid rgba(245,197,66,0.1)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(248,113,113,0.06)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <LogOut size={14} />
                    Disconnect Wallet
                  </button>
                </motion.div>
              )}
              </AnimatePresence>
            </div>
          )}

          {/* Rainbowkit Wallet Connection Button */}
          <ThemeSwitcher />
          <ConnectButton />
        </div>
      </motion.header>

      {/* Profile Settings Modal */}
      <AnimatePresence>
      {isModalOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(241,245,249,0.9)', backdropFilter: 'blur(6px)' }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="w-full max-w-lg stat-box p-8 space-y-6 relative"
            style={{ border: '1px solid rgba(203,213,225,0.7)' }}
          >
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-full transition-colors cursor-pointer"
              style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent-gold)'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(245,197,66,0.08)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
            >✕</button>

            <div className="text-center space-y-1">
              <h2 className="text-2xl font-extrabold flex items-center justify-center gap-2" style={{ color: 'var(--accent-gold)' }}>
                <User style={{ color: 'var(--accent-gold)' }} />
                Profile Settings
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Customize your ArcOmni identity. Saved securely on Supabase.
              </p>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-5">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Username</label>
                <input type="text" placeholder="e.g. Frianowzki" required value={formName} onChange={e => setFormName(e.target.value)} className="cyber-input w-full" />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Select Premium Avatar</label>
                <div className="grid grid-cols-6 gap-2">
                  {PRESET_AVATARS.map((av, idx) => (
                    <button
                      key={idx} type="button" onClick={() => setFormAvatar(av.url)}
                      className="relative aspect-square rounded-2xl overflow-hidden p-1 transition-all hover:scale-105 cursor-pointer"
                      style={{
                        background: 'rgba(248,250,252,0.95)',
                        border: formAvatar === av.url ? '2px solid var(--accent-gold)' : '2px solid var(--border-dim)',
                        boxShadow: formAvatar === av.url ? '0 2px 6px rgba(59,130,246,0.15)' : 'none',
                      }}
                    >
                      <img src={av.url} alt={av.name} className="w-full h-full object-contain p-0.5" />
                      {formAvatar === av.url && (
                        <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.1)' }}>
                          <div className="rounded-full p-0.5" style={{ background: 'var(--accent-gold)', color: '#08080f' }}>
                            <Check size={8} strokeWidth={4} />
                          </div>
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                <div className="space-y-1.5 mt-3">
                  <span className="text-[10px] font-black block uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Or upload custom profile picture</span>
                  <label
                    className="w-full flex flex-col items-center justify-center py-4 cursor-pointer transition-all rounded-2xl"
                    style={{ background: 'rgba(248,250,252,0.95)', border: '1px dashed var(--border-dim)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLLabelElement).style.borderColor = 'rgba(203,213,225,0.7)'; (e.currentTarget as HTMLLabelElement).style.background = 'rgba(59,130,246,0.04)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLLabelElement).style.borderColor = 'var(--border-dim)'; (e.currentTarget as HTMLLabelElement).style.background = 'rgba(248,250,252,0.95)'; }}
                  >
                    <svg className="w-6 h-6 mb-1" style={{ color: 'var(--text-secondary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-[10px] font-bold" style={{ color: 'var(--text-secondary)' }}>
                      {formAvatar.startsWith('data:image') ? '✓ Photo Selected' : 'Upload Image (Max 200KB)'}
                    </span>
                    <input type="file" accept="image/*" onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (file.size > 200 * 1024) { toast.error('Image too large! Max 200KB.'); return; }
                        const reader = new FileReader();
                        reader.onloadend = () => setFormAvatar(reader.result as string);
                        reader.readAsDataURL(file);
                      }
                    }} className="hidden" />
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" style={{ color: '#1DA1F2' }}>
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                    X / Twitter
                  </label>
                  <input type="text" placeholder="@Frianowzki" value={formTwitter} onChange={e => setFormTwitter(e.target.value)} className="cyber-input w-full text-xs" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                    <MessageSquare size={12} style={{ color: '#5865F2' }} />
                    Discord
                  </label>
                  <input type="text" placeholder="frianowzki#1234" value={formDiscord} onChange={e => setFormDiscord(e.target.value)} className="cyber-input w-full text-xs" />
                </div>
              </div>

              <button type="submit" disabled={saving} className="deploy-btn w-full py-4 text-sm disabled:opacity-50 cursor-pointer mt-6">
                {saving ? <><Loader2 size={16} className="animate-spin" /> Saving Identity...</> : 'Save Profile'}
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
    </>
  );
}
