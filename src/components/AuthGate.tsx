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
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#fbfbfa] text-gray-800">
        <Loader2 size={40} className="animate-spin text-[#D4A72C] mb-4" />
        <p className="text-xs font-bold tracking-widest uppercase font-mono text-slate-500">Verifying Security Credentials...</p>
      </div>
    );
  }

  // 2. Unlocked: Render App Children
  if (isConnected && hasProfile === true) {
    return <>{children}</>;
  }

  // 3. Locked state: Wallet not connected or Profile missing
  return (
    <div className="relative w-full min-h-screen overflow-x-hidden flex items-center justify-center bg-[#FAF9F6]/85 backdrop-blur-[6px]">
      {/* Decorative Blur Spheres */}
      <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="w-full max-w-md bg-white border border-[#f1ede4] rounded-[32px] p-8 shadow-[0_20px_50px_rgba(217,119,6,0.06)] relative overflow-hidden z-10"
      >
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
            Connect your wallet to access premium features
          </p>
        </div>

        {/* Action Panel */}
        <div>
          {!isConnected ? (
            <div className="space-y-4">
              {/* Custom styled ConnectButton */}
              <ConnectButton.Custom>
                {({ account, chain, openConnectModal, mounted }) => {
                  const ready = mounted;
                  const connected = ready && account && chain;
                  return (
                    <div
                      {...(!ready && {
                        'aria-hidden': true,
                        style: {
                          opacity: 0,
                          pointerEvents: 'none',
                          userSelect: 'none',
                        },
                      })}
                      className="w-full flex justify-center"
                    >
                      {!connected && (
                        <div className="w-full space-y-4">
                          <motion.button
                            whileHover={{ scale: 1.02, boxShadow: '0 8px 25px rgba(217,119,6,0.25)' }}
                            whileTap={{ scale: 0.98 }}
                            onClick={openConnectModal}
                            type="button"
                            className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold rounded-2xl transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 text-sm shadow-md"
                          >
                            <Wallet className="mr-1 h-4 w-4" />
                            <span>Connect Wallet</span>
                          </motion.button>

                          <div className="block lg:hidden border-t border-gray-100 pt-4 mt-2">
                            <p className="text-[10px] text-center text-gray-500 font-bold uppercase tracking-wider mb-3">
                              Or open directly in wallet app:
                            </p>
                            <div className="grid grid-cols-3 gap-2">
                              <a
                                href="https://metamask.app.link/dapp/arcomni.vercel.app"
                                className="flex flex-col items-center justify-center p-2.5 rounded-xl border border-gray-200 bg-white transition-all text-center gap-1 active:scale-95"
                              >
                                <img src="https://api.dicebear.com/7.x/identicon/svg?seed=metamask" className="w-6 h-6 rounded-lg" alt="MetaMask" />
                                <span className="text-[9px] font-bold text-gray-700">MetaMask</span>
                              </a>
                              <a
                                href="https://link.trustwallet.com/open_url?coin_id=60&url=https://arcomni.vercel.app"
                                className="flex flex-col items-center justify-center p-2.5 rounded-xl border border-gray-200 bg-white transition-all text-center gap-1 active:scale-95"
                              >
                                <img src="https://api.dicebear.com/7.x/identicon/svg?seed=trust" className="w-6 h-6 rounded-lg" alt="Trust" />
                                <span className="text-[9px] font-bold text-gray-700">Trust</span>
                              </a>
                              <a
                                href="https://go.cb-w.com/dapp?cb_url=https://arcomni.vercel.app"
                                className="flex flex-col items-center justify-center p-2.5 rounded-xl border border-gray-200 bg-white transition-all text-center gap-1 active:scale-95"
                              >
                                <img src="https://api.dicebear.com/7.x/identicon/svg?seed=coinbase" className="w-6 h-6 rounded-lg" alt="Coinbase" />
                                <span className="text-[9px] font-bold text-gray-700">Coinbase</span>
                              </a>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }}
              </ConnectButton.Custom>

              <div className="mt-8 flex items-center justify-center space-x-2 text-[10px] text-gray-400">
                <Sparkles className="h-3 w-3 text-amber-500 animate-pulse" />
                <span>Secured by blockchain technology</span>
              </div>
            </div>
          ) : (
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
          )}
        </div>
      </motion.div>
    </div>
  );
}
