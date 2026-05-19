'use client';

import { useEffect, useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useDisconnect } from 'wagmi';
import { Layers, User, MessageSquare, Check, Loader2, ChevronDown, Award, Settings, LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';

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
      const { data: statsData, error: statsError } = await supabase
        .from('user_stats')
        .select('points')
        .eq('wallet', walletLower)
        .single();

      if (statsData && !statsError) {
        setPoints(Number(statsData.points) || 0);
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

      // Realtime listener for stats updates
      const channel = supabase.channel(`header_updates_${userAddress}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `wallet=eq.${userAddress.toLowerCase()}`
        }, () => {
          fetchProfileAndStats();
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'user_stats',
          filter: `wallet=eq.${userAddress.toLowerCase()}`
        }, () => {
          fetchProfileAndStats();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      setProfile(null);
      setPoints(0);
    }
  }, [isConnected, userAddress]);

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
              ArcLauncher <span className="text-xs bg-blue-500/10 text-blue-600 px-2 py-0.5 rounded-full font-bold">PRO</span>
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
              <p className="text-xs text-slate-500">Customize your ArcLauncher identity. Saved securely on Supabase.</p>
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
                
                {/* Custom Avatar URL Field */}
                <div className="space-y-1.5 mt-2">
                  <span className="text-[10px] text-slate-400 font-bold block">Or paste custom Avatar URL</span>
                  <input
                    type="url"
                    placeholder="https://example.com/avatar.jpg"
                    value={formAvatar.startsWith('https://api.dicebear.com') ? '' : formAvatar}
                    onChange={(e) => e.target.value && setFormAvatar(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-xs font-mono"
                  />
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
