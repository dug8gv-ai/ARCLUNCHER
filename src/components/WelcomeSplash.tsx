'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export function WelcomeSplash() {
  const [visible, setVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 1024 || 
        ('ontouchstart' in window && window.innerWidth < 1280);
      setIsMobile(mobile);
      return mobile;
    };
    const mobileVal = checkMobile();

    if (mobileVal) {
      // Skip splash on mobile for instant loading
      return;
    }

    const seen = sessionStorage.getItem('arcomni_splash_shown_v2');
    if (!seen) {
      setVisible(true);
      sessionStorage.setItem('arcomni_splash_shown_v2', '1');
      const t = setTimeout(() => setVisible(false), 4500);
      return () => clearTimeout(t);
    }
  }, []);

  if (isMobile) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="splash-v3"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.05, filter: 'blur(12px)' }}
          transition={{ duration: 0.8, ease: 'easeInOut' }}
          className="fixed inset-0 z-[10000] flex flex-col items-center justify-center select-none cursor-default overflow-hidden bg-[#FAF9F6]/85 backdrop-blur-[6px]"
          onClick={() => setVisible(false)}
        >
          {/* Decorative Blur Spheres */}
          <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

          <motion.div
            className="absolute rounded-full blur-[100px] pointer-events-none"
            style={{ width: 400, height: 400, background: 'rgba(217,119,6,0.05)', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }}
            animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />

          {/* 3D Content Container */}
          <motion.div
            initial={{ rotateX: 15, rotateY: -10, opacity: 0, z: -200 }}
            animate={{ rotateX: 0, rotateY: 0, opacity: 1, z: 0 }}
            transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 flex flex-col items-center gap-6"
            style={{ transformStyle: 'preserve-3d' }}
          >
            {/* Rotating gold logo frame */}
            <div className="relative w-28 h-28 mx-auto flex items-center justify-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-0 rounded-full border border-dashed border-[#D4A72C]/45"
              />
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="relative w-16 h-16 rounded-full bg-[#0a1128] border-2 border-[#D4A72C]/40 shadow-[0_4px_20px_rgba(212,167,44,0.3)] flex items-center justify-center overflow-hidden"
              >
                <img
                  src="/main-logo.jpg"
                  alt="ArcOmni Logo"
                  className="w-full h-full object-contain p-1"
                />
              </motion.div>
            </div>

            {/* ArcOmni Cinematic Text */}
            <div className="flex flex-col items-center">
              <motion.div
                className="flex items-center gap-0.5"
                initial={{ scale: 0.9, filter: 'blur(8px)' }}
                animate={{ scale: 1, filter: 'blur(0px)' }}
                transition={{ duration: 1, delay: 0.5 }}
              >
                {'ARCOMNI'.split('').map((char, i) => (
                  <motion.span
                    key={i}
                    initial={{ opacity: 0, y: 30, rotateX: -90 }}
                    animate={{ opacity: 1, y: 0, rotateX: 0 }}
                    transition={{ duration: 0.6, delay: 0.6 + i * 0.08, ease: 'easeOut' }}
                    className="text-6xl md:text-7xl font-black uppercase tracking-tighter"
                    style={{
                      fontFamily: 'Orbitron, sans-serif',
                      background: 'linear-gradient(to bottom, #d97706 0%, #f59e0b 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      textShadow: '0 8px 20px rgba(217, 119, 6, 0.2)',
                    }}
                  >
                    {char}
                  </motion.span>
                ))}
              </motion.div>

              {/* Tagline */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 1.5 }}
                className="mt-3 px-5 py-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 backdrop-blur-md"
              >
                <p className="text-amber-800 text-xs md:text-sm font-bold tracking-[0.25em] uppercase" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                  THE ULTIMATE WEB3 ECOSYSTEM
                </p>
              </motion.div>
            </div>

            {/* Futuristic Progress Bar */}
            <motion.div
              className="w-56 h-[3px] rounded-full overflow-hidden mt-6 relative"
              style={{ background: 'rgba(217,119,6,0.1)' }}
            >
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ background: 'linear-gradient(90deg, #d97706, #f59e0b, #ffffff)', boxShadow: '0 0 8px #f59e0b' }}
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: 3.5, ease: 'easeInOut', delay: 0.4 }}
              />
            </motion.div>

            {/* Skip Hint */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.6, 0] }}
              transition={{ duration: 2, repeat: Infinity, delay: 2.2 }}
              className="text-[10px] text-amber-700/60 uppercase tracking-widest mt-2 font-bold"
            >
              Click anywhere to launch
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
