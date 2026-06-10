'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export function ThemeSwitcher() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('arc-theme') as 'dark' | 'light' | null;
    if (saved) {
      setTheme(saved);
      document.documentElement.setAttribute('data-theme', saved);
    }
  }, []);

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('arc-theme', next);
    document.documentElement.setAttribute('data-theme', next);
  };

  if (!mounted) return null;

  return (
    <button
      onClick={toggle}
      aria-label="Toggle theme"
      style={{
        background: theme === 'dark'
          ? 'rgba(6,10,38,0.9)'
          : 'rgba(10,20,80,0.85)',
        border: '1px solid rgba(0,229,255,0.3)',
        borderRadius: '10px',
        padding: '7px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: '7px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        color: theme === 'dark' ? '#ffd740' : '#00e5ff',
        fontSize: '11px',
        fontFamily: "'Orbitron', sans-serif",
        fontWeight: 700,
        letterSpacing: '1px',
        boxShadow: theme === 'dark'
          ? '0 0 12px rgba(255,215,64,0.15)'
          : '0 0 12px rgba(0,229,255,0.2)',
      }}
    >
      {theme === 'dark' ? (
        <>
          <Sun size={13} />
          LIGHT
        </>
      ) : (
        <>
          <Moon size={13} />
          DARK
        </>
      )}
    </button>
  );
}
