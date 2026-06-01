'use client';

import { useEffect, useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useDisconnect, usePublicClient } from 'wagmi';
import { Layers, User, MessageSquare, Check, Loader2, ChevronDown, Award, Settings, LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { erc20Abi, formatUnits } from 'viem';
import { USDC_ADDRESS, EURC_ADDRESS } from '@/lib/arcDefiAbi';

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
        alert('Error saving profile: ' + error.message);
      } else {
        setIsModalOpen(false);
        fetchProfileAndStats();
      }
    } catch (err: any) {
      console.error(err);
      alert('Error updating profile: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <header className="glass-panel px-6 py-4 mb-8 flex flex-col md:flex-row items-center justify-between gap-4 sticky top-4 z-40 bg-white/90 backdrop-blur-md">
        {/* Brand Logo & Info */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 shadow-sm">
            <Layers className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              ArcOmni <span className="text-xs bg-blue-500/10 text-blue-600 px-2 py-0.5 rounded-full font-bold">PRO</span>
            </h1>
            <p className="text-xs text-slate-500 hidden md:block font-medium">High-Frequency Premium Token Launchpad</p>
          </div>
        </div>

        {/* Action Controls & Connected Profile Details */}
        <div className="flex flex-wrap items-center gap-3 justify-end w-full md:w-auto">
          {/* Active Network Status */}
          <div className="hidden lg:flex items-center gap-2 text-xs text-slate-500 bg-slate-100/80 px-3 py-1.5 rounded-full font-medium">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            Arc Testnet Active
          </div>

          {/* Glowing Premium Airdrop Box */}
          {isConnected && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/60 rounded-full px-4 py-2 flex items-center gap-2 shadow-sm font-semibold text-xs text-blue-700 animate-pulse">
              <Award size={14} className="text-blue-600" />
              <span>Airdrop: <strong className="font-extrabold text-blue-600">{points.toFixed(2)}</strong> ARCL</span>
            </div>
          )}

          {/* Real USDC & EURC Wallet Balances Display */}
          {isConnected && (
            <div className="hidden sm:flex items-center gap-3 bg-slate-50 border border-slate-200/60 rounded-full px-4 py-2 font-semibold text-xs text-slate-700 shadow-sm">
              <div className="flex items-center gap-1">
                <span>🔵</span>
                <span className="text-[10px] text-slate-500 font-bold uppercase">USDC:</span>
                <span className="font-extrabold text-slate-800">{usdcBalance.toFixed(2)}</span>
              </div>
              <div className="w-[1px] h-3 bg-slate-200" />
              <div className="flex items-center gap-1">
                <span>🟣</span>
                <span className="text-[10px] text-slate-500 font-bold uppercase">EURC:</span>
                <span className="font-extrabold text-slate-800">{eurcBalance.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Social Profile Dropdown */}
          {isConnected && profile && (
            <div className="relative">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-800 px-3.5 py-1.5 rounded-full shadow-sm text-xs font-semibold transition-all cursor-pointer"
              >
                <div className="w-6 h-6 rounded-full overflow-hidden border border-slate-300 bg-white">
                  <img src={profile.avatar} alt="Avatar" className="w-full h-full object-cover" />
                </div>
                <span className="max-w-[100px] truncate text-slate-700">{profile.name}</span>
                <ChevronDown size={14} className="text-slate-500" />
              </button>

              {isDropdownOpen && (
                <div className="absolute right-0 mt-2.5 w-48 bg-white border border-slate-200/80 rounded-2xl shadow-xl py-2 z-50 text-xs font-medium text-slate-700 animate-in fade-in slide-in-from-top-2 duration-150">
                  <button
                    onClick={() => {
                      setIsDropdownOpen(false);
                      setIsModalOpen(true);
                    }}
                    className="w-full px-4 py-2.5 hover:bg-slate-50 flex items-center gap-2 text-left cursor-pointer transition-colors"
                  >
                    <Settings size={14} className="text-slate-500" />
                    Profile Settings
                  </button>
                  <button
                    onClick={() => {
                      setIsDropdownOpen(false);
                      disconnect();
                    }}
                    className="w-full px-4 py-2.5 hover:bg-red-50 text-red-600 flex items-center gap-2 text-left cursor-pointer transition-colors border-t border-slate-100"
                  >
                    <LogOut size={14} />
                    Disconnect Wallet
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Rainbowkit Wallet Connection Button */}
          <ConnectButton />
        </div>
      </header>

      {/* Persistent Social Profile Settings Modal (Radius Glassmorphism) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg glass-modal p-8 space-y-6 relative border border-white">
            {/* Close Button */}
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
            >
              ✕
            </button>

            <div className="text-center space-y-1">
              <h2 className="text-2xl font-extrabold text-slate-900 flex items-center justify-center gap-2">
                <User className="text-blue-600" />
                Profile Settings
              </h2>
              <p className="text-xs text-slate-500">Customize your ArcOmni identity. Saved securely on Supabase.</p>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-5">
              {/* Profile Name */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">Username</label>
                <input
                  type="text"
                  placeholder="e.g. Frianowzki"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-semibold"
                />
              </div>

              {/* Avatar Chooser */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">Select Premium Avatar</label>
                <div className="grid grid-cols-6 gap-2">
                  {PRESET_AVATARS.map((av, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setFormAvatar(av.url)}
                      className={`relative aspect-square rounded-2xl overflow-hidden border-2 bg-slate-50 p-1 transition-all hover:scale-105 cursor-pointer ${
                        formAvatar === av.url ? 'border-blue-600 shadow-md shadow-blue-500/10' : 'border-slate-200'
                      }`}
                    >
                      <img src={av.url} alt={av.name} className="w-full h-full object-cover" />
                      {formAvatar === av.url && (
                        <div className="absolute inset-0 bg-blue-600/10 flex items-center justify-center">
                          <div className="bg-blue-600 text-white rounded-full p-0.5">
                            <Check size={8} strokeWidth={4} />
                          </div>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                
                {/* Upload custom picture */}
                <div className="space-y-1.5 mt-3">
                  <span className="text-[10px] text-slate-400 font-black block uppercase tracking-wider">Or upload custom profile picture</span>
                  <label className="w-full flex flex-col items-center justify-center py-4 bg-slate-50 border border-dashed border-slate-300 rounded-2xl cursor-pointer hover:bg-slate-100/50 hover:border-blue-400 transition-all">
                    <svg className="w-6 h-6 text-slate-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    <span className="text-[10px] font-bold text-slate-500">
                      {formAvatar.startsWith('data:image') ? '✓ Photo Selected' : 'Upload Image (Max 200KB)'}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > 200 * 1024) {
                            alert("Image is too large! Please upload a photo under 200KB.");
                            return;
                          }
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setFormAvatar(reader.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Social Channels */}
              <div className="grid grid-cols-2 gap-4">
                {/* Twitter */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" className="text-[#1DA1F2]"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                    X / Twitter
                  </label>
                  <input
                    type="text"
                    placeholder="@Frianowzki"
                    value={formTwitter}
                    onChange={(e) => setFormTwitter(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium text-xs"
                  />
                </div>

                {/* Discord */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                    <MessageSquare size={12} className="text-[#5865F2]" />
                    Discord
                  </label>
                  <input
                    type="text"
                    placeholder="frianowzki#1234"
                    value={formDiscord}
                    onChange={(e) => setFormDiscord(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium text-xs"
                  />
                </div>
              </div>

              {/* Save Button */}
              <button
                type="submit"
                disabled={saving}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-500/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer mt-6"
              >
                {saving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Saving Identity...
                  </>
                ) : (
                  'Save Profile'
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
