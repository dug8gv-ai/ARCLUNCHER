'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export function WelcomeSplash() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only show once per session
    const seen = sessionStorage.getItem('arcomni_splash_shown');
    if (!seen) {
      setVisible(true);
      sessionStorage.setItem('arcomni_splash_shown', '1');
      // Auto-dismiss after 3.2s
      const t = setTimeout(() => setVisible(false), 3200);
      return () => clearTimeout(t);
    }
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center select-none cursor-default"
          style={{
            background: 'linear-gradient(135deg, #eff6ff 0%, #f0f9ff 40%, #f5f3ff 100%)',
          }}
          onClick={() => setVisible(false)}
        >
          {/* Ambient blobs */}
          <motion.div
            className="absolute rounded-full"
            style={{ width: 500, height: 500, background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }}
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute rounded-full"
            style={{ width: 300, height: 300, background: 'radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)', top: '30%', right: '20%' }}
            animate={{ scale: [1, 1.2, 1], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
          />

          {/* Logo + wordmark */}
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col items-center gap-6 relative z-10"
          >
            {/* Icon */}
            <motion.div
              animate={{ boxShadow: ['0 0 0px rgba(59,130,246,0.3)', '0 0 40px rgba(59,130,246,0.5)', '0 0 0px rgba(59,130,246,0.3)'] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className="w-24 h-24 rounded-3xl overflow-hidden flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                boxShadow: '0 8px 32px rgba(59,130,246,0.35)',
              }}
            >
              <img src="/main-logo.jpg" alt="ArcOmni" className="w-full h-full object-contain p-2" />
            </motion.div>

            {/* ArcOmni text — letter by letter */}
            <div className="flex items-end gap-0.5">
              {'ArcOmni'.split('').map((char, i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.4 + i * 0.07, ease: [0.22, 1, 0.36, 1] }}
                  style={{
                    fontSize: 'clamp(2.5rem, 8vw, 5rem)',
                    fontWeight: 900,
                    letterSpacing: '-0.02em',
                    fontFamily: 'Inter, sans-serif',
                    background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #6366f1 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  {char}
                </motion.span>
              ))}
            </div>

            {/* Tagline */}
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 1.2 }}
              className="text-base font-semibold tracking-widest uppercase"
              style={{ color: '#64748b', letterSpacing: '0.25em' }}
            >
              Pro · High-Frequency Token Launchpad
            </motion.p>

            {/* Progress bar */}
            <motion.div
              className="w-48 h-0.5 rounded-full overflow-hidden mt-2"
              style={{ background: 'rgba(59,130,246,0.12)' }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg, #3b82f6, #6366f1)' }}
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: 2.6, ease: 'easeInOut', delay: 0.3 }}
              />
            </motion.div>

            {/* Hint */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              transition={{ duration: 0.4, delay: 1.8 }}
              className="text-xs"
              style={{ color: '#94a3b8' }}
            >
              Click anywhere to continue
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
