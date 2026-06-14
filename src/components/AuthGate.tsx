'use client';

import { useState, useEffect } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, ShieldAlert, Loader2, Sparkles, Check } from 'lucide-react';
import toast from 'react-hot-toast';

const PRESET_AVATARS = [
  { name: 'Frianowzki', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Frianowzki' },
  { name: 'Cyber Hunter', url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Felix' },
  { name: 'Pixel Arc', url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=Arc' },
  { name: 'Moon Boy', url: 'https://api.dicebear.com/7.x/lorelei/svg?seed=Crypto' },
  { name: 'Rocket Queen', url: 'https://api.dicebear.com/7.x/miniavs/svg?seed=Luna' },
  { name: 'Diamond Hands', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Nico' },
];

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { isConnected, address } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const [checking, setChecking] = useState(true);
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);

  // Profile Form States
  const [name, setName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(PRESET_AVATARS[0].url);
  const [twitter, setTwitter] = useState('');
  const [discord, setDiscord] = useState('');
  const [creating, setCreating] = useState(false);

  const checkProfile = async () => {
    if (!address) {
      setHasProfile(false);
      setChecking(false);
      return;
    }
    setChecking(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('wallet')
        .eq('wallet', address.toLowerCase())
        .maybeSingle();

      if (data && !error) {
        setHasProfile(true);
      } else {
        setHasProfile(false);
      }
    } catch (err) {
      console.error('Error checking profile:', err);
      setHasProfile(false);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (isConnected && address) {
      checkProfile();
    } else {
      setHasProfile(null);
      setChecking(false);
    }
  }, [isConnected, address]);

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;
    if (!name.trim()) {
      toast.error('Please enter a username');
      return;
    }

    setCreating(true);
    try {
      const walletLower = address.toLowerCase();
      const profileData = {
        wallet: walletLower,
        name: name.trim(),
        avatar: selectedAvatar,
        twitter: twitter.trim() || undefined,
        discord: discord.trim() || undefined
      };

      const message = `Authorize ArcOmni Profile Update:\nWallet: ${walletLower}\nName: ${profileData.name}\nTime: ${Date.now()}`;
      toast.loading("Please sign the message in your wallet...", { id: 'auth-toast' });

      const signature = await signMessageAsync({ message });

      toast.loading("Creating secure profile...", { id: 'auth-toast' });
      const res = await fetch('/api/profiles/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: walletLower,
          name: profileData.name,
          avatar: profileData.avatar,
          twitter: profileData.twitter,
          discord: profileData.discord,
          message,
          signature
        })
      });

      if (!res.ok) {
        throw new Error('Verification failed.');
      }

      toast.success('Account created successfully!', { id: 'auth-toast' });
      setHasProfile(true);
    } catch (err: any) {
      console.error(err);
      toast.error(err.shortMessage || err.message || 'Error creating profile', { id: 'auth-toast' });
    } finally {
      setCreating(false);
    }
  };

  // 1. Loading State
  if (checking) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#070913] text-white">
        <Loader2 size={40} className="animate-spin text-[var(--accent-cyan)] mb-4" />
        <p className="text-sm font-bold tracking-widest uppercase font-mono text-slate-400">Verifying Security Credentials...</p>
      </div>
    );
  }

  // 2. Unlocked: Render App Children
  if (isConnected && hasProfile === true) {
    return <>{children}</>;
  }

  // 3. Locked state: Wallet not connected or Profile missing
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#04060d] text-white flex items-center justify-center p-4 selection:bg-[rgba(212,167,44,0.15)] selection:text-white">
      {/* Background Decorative Glow */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-br from-blue-900/10 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gradient-to-tl from-[var(--accent-gold)]/5 to-transparent rounded-full blur-3xl pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 15 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ duration: 0.4 }}
        className="w-full max-w-lg bg-[#0a0f1d] border border-[var(--border-dim)] rounded-[32px] p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-blue-500 via-[var(--accent-gold)] to-emerald-500" />
        
        {/* Brand/Header */}
        <div className="text-center space-y-2.5 relative z-10">
          <div className="w-14 h-14 rounded-3xl bg-[rgba(212,167,44,0.08)] border border-[rgba(212,167,44,0.25)] flex items-center justify-center text-[var(--accent-gold)] shadow-lg mx-auto">
            <Shield size={28} className="animate-pulse" />
          </div>
          <h2 className="text-2xl font-black tracking-tight font-sans uppercase">ArcOmni Gatekeeper</h2>
          <p className="text-xs text-slate-400 font-semibold max-w-sm mx-auto leading-relaxed">
            Secure high-frequency DeFi launchpad. Connect your Web3 wallet and create a profile to enter.
          </p>
        </div>

        {/* Action Form */}
        <div className="space-y-6 relative z-10">
          {!isConnected ? (
            <div className="flex flex-col items-center justify-center p-8 border border-dashed border-slate-800 rounded-3xl bg-slate-900/30 gap-6">
              <ShieldAlert className="text-rose-500" size={36} />
              <div className="text-center">
                <h4 className="text-sm font-black uppercase tracking-wider">Security Access Restricted</h4>
                <p className="text-[11px] text-slate-500 font-semibold mt-1">Wallet connection is required to authenticate.</p>
              </div>
              <div className="[data-rk] button">
                <ConnectButton label="Connect Wallet to Enter" />
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreateProfile} className="space-y-5 animate-in fade-in duration-200">
              <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-4 text-xs font-mono text-[var(--accent-gold)] flex items-center gap-2">
                <Sparkles size={14} className="flex-shrink-0" />
                <span>Wallet Connected! Create your profile to unlock access.</span>
              </div>

              {/* Username Input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Username</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  placeholder="e.g. Satoshi_99" 
                  maxLength={20}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-[var(--accent-gold)] focus:ring-2 focus:ring-[rgba(212,167,44,0.08)] transition-all"
                />
              </div>

              {/* Preset Avatar Selection */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Select Avatar</label>
                <div className="grid grid-cols-6 gap-2">
                  {PRESET_AVATARS.map((av) => {
                    const isSelected = selectedAvatar === av.url;
                    return (
                      <button
                        key={av.name}
                        type="button"
                        onClick={() => setSelectedAvatar(av.url)}
                        className={`aspect-square rounded-xl overflow-hidden border bg-slate-950 transition-all cursor-pointer p-0.5 relative ${
                          isSelected ? 'border-[var(--accent-gold)] scale-105 shadow-md shadow-[rgba(212,167,44,0.25)]' : 'border-slate-800 hover:border-slate-600'
                        }`}
                      >
                        <img src={av.url} alt={av.name} className="w-full h-full object-contain" />
                        {isSelected && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-[var(--accent-gold)]">
                            <Check size={14} strokeWidth={3} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Socials (Optional) */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Twitter (X)</label>
                  <input 
                    type="text" 
                    value={twitter} 
                    onChange={(e) => setTwitter(e.target.value)} 
                    placeholder="@username" 
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs font-bold text-white outline-none focus:border-[var(--accent-gold)] transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Discord</label>
                  <input 
                    type="text" 
                    value={discord} 
                    onChange={(e) => setDiscord(e.target.value)} 
                    placeholder="username#0000" 
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs font-bold text-white outline-none focus:border-[var(--accent-gold)] transition-colors"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={creating}
                className="w-full btn-primary py-3.5 flex items-center justify-center gap-2 cursor-pointer font-black text-xs uppercase"
              >
                {creating ? <><Loader2 size={16} className="animate-spin" /> Creating Profile...</> : 'Create Profile & Enter'}
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}
