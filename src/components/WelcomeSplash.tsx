'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export function WelcomeSplash() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only show once per session
    const seen = sessionStorage.getItem('arcomni_splash_shown_v2');
    if (!seen) {
      setVisible(true);
      sessionStorage.setItem('arcomni_splash_shown_v2', '1');
      // Auto-dismiss after 4.5s for the full 3D ad experience
      const t = setTimeout(() => setVisible(false), 4500);
      return () => clearTimeout(t);
    }
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="splash-v2"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
          transition={{ duration: 0.8, ease: 'easeInOut' }}
          className="fixed inset-0 z-[10000] flex flex-col items-center justify-center select-none cursor-default overflow-hidden"
          style={{
            background: 'radial-gradient(circle at center, #0a0a1a 0%, #000000 100%)',
            perspective: "1000px"
          }}
          onClick={() => setVisible(false)}
        >
          {/* Animated 3D Grid Background */}
          <div className="absolute inset-0 z-0" style={{
            backgroundImage: `linear-gradient(rgba(41, 121, 255, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(41, 121, 255, 0.1) 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
            transform: 'rotateX(60deg) translateY(-100px) translateZ(-200px)',
            transformOrigin: 'top center',
            animation: 'gridMove 10s linear infinite',
          }} />

          {/* Glowing Orbs */}
          <motion.div
            className="absolute rounded-full blur-[100px]"
            style={{ width: 400, height: 400, background: 'rgba(59,130,246,0.3)', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }}
            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute rounded-full blur-[100px]"
            style={{ width: 300, height: 300, background: 'rgba(139,92,246,0.2)', top: '30%', right: '20%' }}
            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
          />

          {/* 3D Content Container */}
          <motion.div
            initial={{ rotateX: 45, rotateY: -20, opacity: 0, z: -500 }}
            animate={{ rotateX: 0, rotateY: 0, opacity: 1, z: 0 }}
            transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 flex flex-col items-center gap-8"
            style={{ transformStyle: 'preserve-3d' }}
          >
            {/* Ad-Type Floating Logo */}
            <motion.div
              animate={{ 
                rotateY: [0, 360],
                y: [0, -15, 0]
              }}
              transition={{ 
                rotateY: { duration: 4, ease: "linear", repeat: Infinity },
                y: { duration: 3, ease: "easeInOut", repeat: Infinity }
              }}
              className="w-32 h-32 rounded-3xl overflow-hidden flex items-center justify-center p-1"
              style={{
                background: 'linear-gradient(135deg, #00f0ff 0%, #0057ff 100%)',
                boxShadow: '0 0 40px rgba(0, 240, 255, 0.6), inset 0 0 20px rgba(255, 255, 255, 0.5)',
              }}
            >
              <div className="w-full h-full bg-[#0a0a1a] rounded-[20px] flex items-center justify-center overflow-hidden">
                <img src="/main-logo.jpg" alt="ArcOmni Logo" className="w-full h-full object-contain p-2 mix-blend-screen" />
              </div>
            </motion.div>

            {/* ArcOmni Cinematic Text */}
            <div className="flex flex-col items-center">
              <motion.div 
                className="flex items-center gap-1"
                initial={{ scale: 0.8, filter: 'blur(10px)' }}
                animate={{ scale: 1, filter: 'blur(0px)' }}
                transition={{ duration: 1, delay: 0.5 }}
              >
                {'ArcOmni'.split('').map((char, i) => (
                  <motion.span
                    key={i}
                    initial={{ opacity: 0, y: 50, rotateX: -90 }}
                    animate={{ opacity: 1, y: 0, rotateX: 0 }}
                    transition={{ duration: 0.6, delay: 0.8 + i * 0.1, ease: "easeOut" }}
                    className="text-6xl md:text-8xl font-black uppercase tracking-tighter"
                    style={{
                      fontFamily: 'Orbitron, sans-serif',
                      background: 'linear-gradient(to bottom, #ffffff 0%, #00f0ff 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      textShadow: '0 10px 30px rgba(0, 240, 255, 0.5)',
                    }}
                  >
                    {char}
                  </motion.span>
                ))}
              </motion.div>

              {/* Tagline */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 1.8 }}
                className="mt-4 px-6 py-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 backdrop-blur-md"
              >
                <p className="text-cyan-300 text-sm md:text-base font-bold tracking-[0.3em] uppercase" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                  The Ultimate Web3 Ecosystem
                </p>
              </motion.div>
            </div>

            {/* Futuristic Progress Bar */}
            <motion.div
              className="w-64 h-1 rounded-full overflow-hidden mt-8 relative"
              style={{ background: 'rgba(255,255,255,0.1)' }}
            >
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ background: 'linear-gradient(90deg, #0057ff, #00f0ff, #ffffff)', boxShadow: '0 0 10px #00f0ff' }}
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: 3.5, ease: 'easeInOut', delay: 0.5 }}
              />
            </motion.div>

            {/* Skip Hint */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.6, 0] }}
              transition={{ duration: 2, repeat: Infinity, delay: 2.5 }}
              className="text-xs text-slate-400 uppercase tracking-widest mt-4"
            >
              Click anywhere to launch
            </motion.p>
          </motion.div>
          
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes gridMove {
              0% { background-position: 0 0; }
              100% { background-position: 0 40px; }
            }
          `}} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
