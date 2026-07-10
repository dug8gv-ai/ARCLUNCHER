'use client';

import { useState, useEffect } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, Loader2, Sparkles, Check, Wallet, User } from 'lucide-react';
import toast from 'react-hot-toast';

// ── Luxury Rotating Logo Component ──
function OrbitingLogo() {
  return (
    <div className="relative w-28 h-28 mx-auto mb-5 flex items-center justify-center">
      {/* Outer rotating dashed ring */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
        className="absolute inset-0 rounded-full border border-dashed border-[#D4A72C]/45"
      />
      {/* Center Image Container */}
      <motion.div
        whileHover={{ scale: 1.05 }}
        className="relative w-16 h-16 rounded-full bg-[#0a1128] border-2 border-[#D4A72C]/40 shadow-[0_4px_20px_rgba(212,167,44,0.3)] flex items-center justify-center overflow-hidden"
      >
        <img
          src="/main-logo.jpg"
          alt="ArcOmni Logo"
          className="w-full h-full object-contain p-1"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = 'https://api.dicebear.com/7.x/identicon/svg?seed=arcomni';
          }}
        />
      </motion.div>
    </div>
  );
}

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
  const [dismissed, setDismissed] = useState(false);

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
      setDismissed(false);
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
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#fbfbfa] text-gray-800">
        <Loader2 size={40} className="animate-spin text-[#D4A72C] mb-4" />
        <p className="text-xs font-bold tracking-widest uppercase font-mono text-slate-500">Verifying Security Credentials...</p>
      </div>
    );
  }

  // 2. Unlocked: Render App Children directly if guest, profile completed, or modal dismissed
  if (!isConnected || hasProfile === true || dismissed) {
    return <>{children}</>;
  }

  // 3. Connected but profile missing: Render profile creation modal over the app
  return (
    <>
      {children}
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
        {/* Decorative Blur Spheres */}
        <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="w-full max-w-md bg-white border border-[#f1ede4] rounded-[32px] p-8 shadow-2xl relative overflow-hidden z-10"
        >
          {/* Close button to let them browse without profile setup */}
          <button
            onClick={() => setDismissed(true)}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 bg-gray-50 hover:bg-gray-100 p-2 rounded-full transition-all cursor-pointer font-bold text-[11px] w-6 h-6 flex items-center justify-center"
            title="Close and browse"
          >
            ✕
          </button>

          {/* Luxury top gradient line */}
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-[#D4A72C] to-transparent" />

          {/* Brand / Header */}
          <div className="text-center space-y-2 mb-8">
            <OrbitingLogo />
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-amber-600 mb-1"
            >
              Welcome
            </motion.h1>
            <p className="text-xs text-gray-500 font-semibold max-w-xs mx-auto leading-relaxed">
              Connected! Setup your profile to access premium ecosystem features.
            </p>
          </div>

          {/* Action Panel */}
          <div>
            <form onSubmit={handleCreateProfile} className="space-y-4">
              <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-3 text-[11px] font-medium text-amber-800 flex items-center gap-2">
                <Sparkles size={13} className="flex-shrink-0 text-amber-600 animate-spin" style={{ animationDuration: '3s' }} />
                <span>Connected! Set up your username and choose an avatar to continue.</span>
              </div>

              {/* Username Input */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Username</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your username"
                  maxLength={20}
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-800 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/10 transition-all duration-300"
                />
              </div>

              {/* Preset Avatar Selection */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Select Avatar</label>
                <div className="grid grid-cols-6 gap-2">
                  {PRESET_AVATARS.map((av) => {
                    const isSelected = selectedAvatar === av.url;
                    return (
                      <motion.button
                        key={av.name}
                        type="button"
                        whileHover={{ scale: 1.08 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setSelectedAvatar(av.url)}
                        className={`aspect-square rounded-xl overflow-hidden border bg-white transition-all cursor-pointer p-0.5 relative ${
                          isSelected
                            ? 'border-amber-500 shadow-md shadow-[rgba(217,119,6,0.15)]'
                            : 'border-gray-200 hover:border-gray-400'
                        }`}
                      >
                        <img src={av.url} alt={av.name} className="w-full h-full object-contain" />
                        {isSelected && (
                          <div className="absolute inset-0 bg-amber-500/10 flex items-center justify-center text-amber-600">
                            <Check size={14} strokeWidth={3} />
                          </div>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Socials (Optional) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Twitter (X)</label>
                  <input
                    type="text"
                    value={twitter}
                    onChange={(e) => setTwitter(e.target.value)}
                    placeholder="@username"
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-800 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/10 transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Discord</label>
                  <input
                    type="text"
                    value={discord}
                    onChange={(e) => setDiscord(e.target.value)}
                    placeholder="username"
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-800 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/10 transition-colors"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <motion.button
                type="submit"
                disabled={creating}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold text-sm rounded-2xl shadow-md shadow-amber-500/15 flex items-center justify-center gap-2 cursor-pointer"
              >
                {creating ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Creating Profile...
                  </>
                ) : (
                  'Create Profile & Enter'
                )}
              </motion.button>
            </form>
          </div>
        </motion.div>
      </div>
    </>
  );
}
