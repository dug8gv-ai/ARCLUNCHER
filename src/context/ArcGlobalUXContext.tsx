'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
export type LayoutType    = 'original' | 'new_layout';
export type DesignVariant = 'design_1' | 'design_2';
export type ThemeType     = 'light' | 'dark' | 'system';

interface ArcGlobalUXState {
  currentLayout:    LayoutType;
  designVariant:    DesignVariant;
  currentTheme:     ThemeType;
  resolvedTheme:    'light' | 'dark';   // actual applied theme after system resolution
  setLayout:        (l: LayoutType)    => void;
  setDesignVariant: (d: DesignVariant) => void;
  setTheme:         (t: ThemeType)     => void;
}

const ArcGlobalUXContext = createContext<ArcGlobalUXState | null>(null);

// ─── localStorage keys ────────────────────────────────────────────────────────
const LS_LAYOUT  = 'arcomni_ux_layout';
const LS_DESIGN  = 'arcomni_ux_design';
const LS_THEME   = 'arcomni_ux_theme';

function safeRead<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch { return fallback; }
}

// ─── Resolve system theme ─────────────────────────────────────────────────────
function resolveSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// ─── Apply theme to <html> ────────────────────────────────────────────────────
function applyTheme(theme: ThemeType): 'light' | 'dark' {
  const resolved = theme === 'system' ? resolveSystemTheme() : theme;
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(resolved);
  root.setAttribute('data-theme', resolved);
  return resolved;
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function ArcGlobalUXProvider({ children }: { children: React.ReactNode }) {
  const [currentLayout,  setLayoutState]   = useState<LayoutType>('original');
  const [designVariant,  setDesignState]   = useState<DesignVariant>('design_1');
  const [currentTheme,   setThemeState]    = useState<ThemeType>('dark');
  const [resolvedTheme,  setResolvedTheme] = useState<'light' | 'dark'>('dark');
  const [hydrated,       setHydrated]      = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    const layout  = safeRead<LayoutType>(LS_LAYOUT, 'original');
    const design  = safeRead<DesignVariant>(LS_DESIGN, 'design_1');
    const theme   = safeRead<ThemeType>(LS_THEME, 'dark');

    setLayoutState(layout);
    setDesignState(design);
    setThemeState(theme);
    setResolvedTheme(applyTheme(theme));
    setHydrated(true);
  }, []);

  // Listen for system theme changes when theme === 'system'
  useEffect(() => {
    if (currentTheme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => setResolvedTheme(applyTheme('system'));
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [currentTheme]);

  const setLayout = useCallback((l: LayoutType) => {
    setLayoutState(l);
    try { localStorage.setItem(LS_LAYOUT, JSON.stringify(l)); } catch { /**/ }
  }, []);

  const setDesignVariant = useCallback((d: DesignVariant) => {
    setDesignState(d);
    try { localStorage.setItem(LS_DESIGN, JSON.stringify(d)); } catch { /**/ }
  }, []);

  const setTheme = useCallback((t: ThemeType) => {
    setThemeState(t);
    const resolved = applyTheme(t);
    setResolvedTheme(resolved);
    try { localStorage.setItem(LS_THEME, JSON.stringify(t)); } catch { /**/ }
  }, []);

  // Prevent flash before hydration
  if (!hydrated) return null;

  return (
    <ArcGlobalUXContext.Provider value={{
      currentLayout, designVariant, currentTheme, resolvedTheme,
      setLayout, setDesignVariant, setTheme,
    }}>
      {children}
    </ArcGlobalUXContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useArcUX(): ArcGlobalUXState {
  const ctx = useContext(ArcGlobalUXContext);
  if (!ctx) throw new Error('useArcUX must be used inside ArcGlobalUXProvider');
  return ctx;
}
