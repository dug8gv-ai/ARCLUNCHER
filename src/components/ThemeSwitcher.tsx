'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggle = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  if (!mounted) return null;

  return (
    <button
      onClick={toggle}
      aria-label="Toggle theme"
      style={{
        background: theme === 'dark'
          ? 'var(--bg-card)'
          : 'var(--bg-elevated)',
        border: '1px solid var(--accent-gold)',
        borderRadius: '10px',
        padding: '7px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: '7px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        color: 'var(--accent-gold)',
        fontSize: '11px',
        fontFamily: "'Orbitron', sans-serif",
        fontWeight: 700,
        letterSpacing: '1px',
        boxShadow: '0 0 12px rgba(234, 179, 8, 0.15)'
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = 'var(--accent-gold)';
        (e.currentTarget as HTMLButtonElement).style.color = 'var(--bg-main)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = theme === 'dark' ? 'var(--bg-card)' : 'var(--bg-elevated)';
        (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent-gold)';
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

