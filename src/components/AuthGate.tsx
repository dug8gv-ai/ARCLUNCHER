'use client';

import { useState, useEffect, useRef } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, Loader2, Sparkles, Check } from 'lucide-react';
import toast from 'react-hot-toast';

// ── Simplex Noise Helper ──
function createNoise() {
  const permutation = [
    151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140,
    36, 103, 30, 69, 142, 8, 99, 37, 240, 21, 10, 23, 190, 6, 148, 247, 120,
    234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32, 57, 177, 33,
    88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175, 74, 165, 71,
    134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122, 60, 211, 133,
    230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54, 65, 25, 63, 161,
    1, 216, 80, 73, 209, 76, 132, 187, 208, 89, 18, 169, 200, 196, 135, 130,
    116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64, 52, 217, 226, 250,
    124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212, 207, 206, 59, 227,
    47, 16, 58, 17, 182, 189, 28, 42, 223, 183, 170, 213, 119, 248, 152, 2, 44,
    154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9, 129, 22, 39, 253, 19, 98,
    108, 110, 79, 113, 224, 232, 178, 185, 112, 104, 218, 246, 97, 228, 251, 34,
    242, 193, 238, 210, 144, 12, 191, 179, 162, 241, 81, 51, 145, 235, 249, 14,
    239, 107, 49, 192, 214, 31, 181, 199, 106, 157, 184, 84, 204, 176, 115, 121,
    50, 45, 127, 4, 150, 254, 138, 236, 205, 93, 222, 114, 67, 29, 24, 72, 243,
    141, 128, 195, 78, 66, 215, 61, 156, 180,
  ];

  const p = new Array(512);
  for (let i = 0; i < 256; i++) p[256 + i] = p[i] = permutation[i];

  function fade(t: number) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  function lerp(t: number, a: number, b: number) {
    return a + t * (b - a);
  }

  function grad(hash: number, x: number, y: number, z: number) {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  return {
    simplex3: (x: number, y: number, z: number) => {
      const X = Math.floor(x) & 255;
      const Y = Math.floor(y) & 255;
      const Z = Math.floor(z) & 255;

      x -= Math.floor(x);
      y -= Math.floor(y);
      z -= Math.floor(z);

      const u = fade(x);
      const v = fade(y);
      const w = fade(z);

      const A = p[X] + Y;
      const AA = p[A] + Z;
      const AB = p[A + 1] + Z;
      const B = p[X + 1] + Y;
      const BA = p[B] + Z;
      const BB = p[B + 1] + Z;

      return lerp(
        w,
        lerp(
          v,
          lerp(u, grad(p[AA], x, y, z), grad(p[BA], x - 1, y, z)),
          lerp(u, grad(p[AB], x, y - 1, z), grad(p[BB], x - 1, y - 1, z)),
        ),
        lerp(
          v,
          lerp(
            u,
            grad(p[AA + 1], x, y, z - 1),
            grad(p[BA + 1], x - 1, y, z - 1),
          ),
          lerp(
            u,
            grad(p[AB + 1], x, y - 1, z - 1),
            grad(p[BB + 1], x - 1, y - 1, z - 1),
          ),
        ),
      );
    },
  };
}

interface Particle {
  x: number;
  y: number;
  size: number;
  velocity: { x: number; y: number };
  life: number;
  maxLife: number;
}

// ── Simplex Fluid Particles Background ──
function FluidParticlesBackground({
  children,
  particleCount = 150,
  noiseIntensity = 0.002,
  particleSize = { min: 0.8, max: 2.5 },
}: {
  children?: React.ReactNode;
  particleCount?: number;
  noiseIntensity?: number;
  particleSize?: { min: number; max: number };
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const noise = createNoise();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();

    const particles: Particle[] = Array.from({ length: particleCount }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * (particleSize.max - particleSize.min) + particleSize.min,
      velocity: { x: 0, y: 0 },
      life: Math.random() * 100,
      maxLife: 120 + Math.random() * 60,
    }));

    let animationFrameId: number;

    const animate = () => {
      ctx.fillStyle = 'rgba(4, 6, 13, 0.15)'; // Soft trailing background
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (const particle of particles) {
        particle.life += 1;
        if (particle.life > particle.maxLife) {
          particle.life = 0;
          particle.x = Math.random() * canvas.width;
          particle.y = Math.random() * canvas.height;
        }

        const opacity = Math.sin((particle.life / particle.maxLife) * Math.PI) * 0.35;

        const n = noise.simplex3(
          particle.x * noiseIntensity,
          particle.y * noiseIntensity,
          Date.now() * 0.00005,
        );

        const angle = n * Math.PI * 4;
        particle.velocity.x = Math.cos(angle) * 1.2;
        particle.velocity.y = Math.sin(angle) * 1.2;

        particle.x += particle.velocity.x;
        particle.y += particle.velocity.y;

        if (particle.x < 0) particle.x = canvas.width;
        if (particle.x > canvas.width) particle.x = 0;
        if (particle.y < 0) particle.y = canvas.height;
        if (particle.y > canvas.height) particle.y = 0;

        // Alternate colors: Gold and Cyan/Blue
        const isGold = particle.maxLife % 2 === 0;
        ctx.fillStyle = isGold
          ? `rgba(212, 167, 44, ${opacity})`
          : `rgba(59, 130, 246, ${opacity})`;

        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      resizeCanvas();
    };

    window.addEventListener('resize', handleResize);
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [particleCount, noiseIntensity, particleSize]);

  return (
    <div className="relative w-full min-h-screen overflow-x-hidden flex items-center justify-center bg-[#04060d]">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-0" />
      <div className="relative z-10 w-full flex items-center justify-center p-4">
        {children}
      </div>
    </div>
  );
}

// ── Luxury Rotating Logo Component ──
function OrbitingLogo() {
  return (
    <div className="relative w-28 h-28 mx-auto mb-5 flex items-center justify-center">
      {/* Outer rotating dashed ring */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
        className="absolute inset-0 rounded-full border-2 border-dashed border-[rgba(212,167,44,0.3)]"
      />
      {/* Middle breathing glow ring */}
      <motion.div
        animate={{ scale: [0.95, 1.05, 0.95] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute inset-2 rounded-full border border-blue-500/20 bg-blue-500/5 blur-xs"
      />
      {/* Center Image Container */}
      <motion.div
        whileHover={{ scale: 1.05 }}
        className="relative w-16 h-16 rounded-2xl bg-[#070b19] border border-[rgba(212,167,44,0.4)] shadow-[0_0_20px_rgba(212,167,44,0.25)] flex items-center justify-center overflow-hidden"
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
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#04060d] text-white">
        <Loader2 size={40} className="animate-spin text-[#D4A72C] mb-4" />
        <p className="text-xs font-bold tracking-widest uppercase font-mono text-slate-400">Verifying Security Credentials...</p>
      </div>
    );
  }

  // 2. Unlocked: Render App Children
  if (isConnected && hasProfile === true) {
    return <>{children}</>;
  }

  // 3. Locked state: Wallet not connected or Profile missing
  return (
    <FluidParticlesBackground>
      {/* Decorative Blur Spheres */}
      <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-blue-900/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-[#D4A72C]/5 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md bg-[#0a0f1d]/40 backdrop-blur-xl border border-slate-800/80 rounded-[32px] p-8 shadow-2xl relative overflow-hidden z-10"
      >
        {/* Luxury top gradient line */}
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-blue-500 via-[#D4A72C] to-emerald-500" />

        {/* Brand / Header */}
        <div className="text-center space-y-2 mb-6">
          <OrbitingLogo />
          <h2 className="text-2xl font-black tracking-tight font-sans uppercase bg-gradient-to-b from-white via-white to-slate-400 bg-clip-text text-transparent">
            ArcOmni Gatekeeper
          </h2>
          <p className="text-xs text-slate-400 font-semibold max-w-xs mx-auto leading-relaxed">
            Authorized Personnel Only. Please verify your Web3 identity to access the terminal.
          </p>
        </div>

        {/* Action Panel */}
        <div>
          {!isConnected ? (
            <div className="flex flex-col items-center justify-center p-6 border border-dashed border-slate-800/80 rounded-2xl bg-slate-900/20 gap-5">
              <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500">
                <ShieldAlert size={20} />
              </div>
              <div className="text-center">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">Security Access Restricted</h4>
                <p className="text-[10px] text-slate-500 font-semibold mt-1">Wallet connection is required to authenticate.</p>
              </div>

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
                      className="w-full flex justify-center mt-2"
                    >
                      {!connected && (
                        <motion.button
                          whileHover={{ scale: 1.02, boxShadow: '0 0 20px rgba(212,167,44,0.35)' }}
                          whileTap={{ scale: 0.98 }}
                          onClick={openConnectModal}
                          type="button"
                          className="w-full relative overflow-hidden py-3 bg-gradient-to-r from-[#D4A72C] via-[#E8B931] to-[#D4A72C] text-black font-black font-sans uppercase tracking-wider rounded-xl transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 text-xs"
                        >
                          <Sparkles size={14} className="text-black animate-pulse" />
                          <span>Connect Wallet to Enter</span>
                        </motion.button>
                      )}
                    </div>
                  );
                }}
              </ConnectButton.Custom>
            </div>
          ) : (
            <form onSubmit={handleCreateProfile} className="space-y-4">
              <div className="bg-slate-900/30 border border-slate-800/60 rounded-xl p-3 text-[11px] font-mono text-[#D4A72C] flex items-center gap-2">
                <Sparkles size={13} className="flex-shrink-0 animate-spin" style={{ animationDuration: '3s' }} />
                <span>Wallet connected. Set up your Web3 username to continue.</span>
              </div>

              {/* Username Input */}
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Username</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Satoshi_99"
                  maxLength={20}
                  className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold text-white outline-none focus:border-[#D4A72C] focus:ring-1 focus:ring-[#D4A72C]/30 transition-all duration-300"
                />
              </div>

              {/* Preset Avatar Selection */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Select Avatar</label>
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
                        className={`aspect-square rounded-xl overflow-hidden border bg-slate-950/80 transition-all cursor-pointer p-0.5 relative ${
                          isSelected
                            ? 'border-[#D4A72C] shadow-md shadow-[rgba(212,167,44,0.25)]'
                            : 'border-slate-800 hover:border-slate-600'
                        }`}
                      >
                        <img src={av.url} alt={av.name} className="w-full h-full object-contain" />
                        {isSelected && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-[#D4A72C]">
                            <Check size={12} strokeWidth={3} />
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
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Twitter (X)</label>
                  <input
                    type="text"
                    value={twitter}
                    onChange={(e) => setTwitter(e.target.value)}
                    placeholder="@username"
                    className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 text-[11px] font-bold text-white outline-none focus:border-[#D4A72C] transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Discord</label>
                  <input
                    type="text"
                    value={discord}
                    onChange={(e) => setDiscord(e.target.value)}
                    placeholder="username"
                    className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 text-[11px] font-bold text-white outline-none focus:border-[#D4A72C] transition-colors"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <motion.button
                type="submit"
                disabled={creating}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="w-full btn-primary py-3 flex items-center justify-center gap-2 cursor-pointer font-black text-xs uppercase shadow-md shadow-[rgba(212,167,44,0.2)]"
              >
                {creating ? (
                  <>
                    <Loader2 size={13} className="animate-spin" /> Creating Profile...
                  </>
                ) : (
                  'Create Profile & Enter'
                )}
              </motion.button>
            </form>
          )}
        </div>
      </motion.div>
    </FluidParticlesBackground>
  );
}
