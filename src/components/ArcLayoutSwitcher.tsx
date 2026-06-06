'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useArcUX, LayoutType, DesignVariant, ThemeType } from '@/context/ArcGlobalUXContext';
import { ChevronDown, Sun, Moon, Monitor, Layers, Layout, Check } from 'lucide-react';

// ─── Design preview thumbnails (inline SVG) ──────────────────────────────────
function Design1Thumb() {
  return (
    <svg viewBox="0 0 80 52" className="w-full h-full" fill="none">
      <rect width="80" height="52" rx="4" fill="#0f172a"/>
      <rect x="2" y="2" width="16" height="48" rx="2" fill="#1e293b"/>
      <rect x="20" y="2" width="38" height="30" rx="2" fill="#1e3a5f"/>
      <rect x="20" y="34" width="38" height="16" rx="2" fill="#1e293b"/>
      <rect x="60" y="2" width="18" height="48" rx="2" fill="#1e293b"/>
      <rect x="22" y="6" width="20" height="3" rx="1" fill="#3b82f6"/>
      <rect x="22" y="11" width="14" height="2" rx="1" fill="#64748b"/>
    </svg>
  );
}
function Design2Thumb() {
  return (
    <svg viewBox="0 0 80 52" className="w-full h-full" fill="none">
      <rect width="80" height="52" rx="4" fill="#0f172a"/>
      <rect x="2" y="2" width="20" height="48" rx="2" fill="#1e1a2e"/>
      <rect x="24" y="2" width="54" height="24" rx="2" fill="#1e1a3f"/>
      <rect x="24" y="28" width="26" height="22" rx="2" fill="#1e293b"/>
      <rect x="52" y="28" width="26" height="22" rx="2" fill="#1e293b"/>
      <rect x="26" y="5" width="16" height="3" rx="1" fill="#818cf8"/>
      <rect x="26" y="10" width="10" height="2" rx="1" fill="#64748b"/>
    </svg>
  );
}

export function ArcLayoutSwitcher() {
  const { currentLayout, designVariant, currentTheme, setLayout, setDesignVariant, setTheme } = useArcUX();

  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);
  const [themeOpen,      setThemeOpen]      = useState(false);
  const layoutRef = useRef<HTMLDivElement>(null);
  const themeRef  = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (layoutRef.current && !layoutRef.current.contains(e.target as Node)) setLayoutMenuOpen(false);
      if (themeRef.current  && !themeRef.current.contains(e.target as Node))  setThemeOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const themes: { value: ThemeType; label: string; icon: React.ReactNode }[] = [
    { value: 'light',  label: 'Light',  icon: <Sun  size={13} /> },
    { value: 'dark',   label: 'Dark',   icon: <Moon size={13} /> },
    { value: 'system', label: 'System', icon: <Monitor size={13} /> },
  ];

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[999] flex items-center justify-center gap-3 px-4 py-2"
      style={{
        background: 'rgba(8,8,15,0.92)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(245,197,66,0.12)',
      }}
    >
      {/* ── Layout toggle segment ── */}
      <div
        className="flex items-center rounded-xl overflow-hidden"
        style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(245,197,66,0.15)', padding: '3px' }}
      >
        {/* Button A: Original */}
        <button
          onClick={() => { setLayout('original'); setLayoutMenuOpen(false); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
          style={currentLayout === 'original'
            ? { background: 'linear-gradient(135deg,#f5c542,#d4940c)', color: '#08080f' }
            : { color: 'rgba(245,197,66,0.55)' }
          }
        >
          <Layout size={12} />
          Original
        </button>

        {/* Button B: New Layout */}
        <div ref={layoutRef} className="relative">
          <button
            onClick={() => {
              if (currentLayout !== 'new_layout') {
                setLayout('new_layout');
              }
              setLayoutMenuOpen(v => !v);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
            style={currentLayout === 'new_layout'
              ? { background: 'linear-gradient(135deg,#f5c542,#d4940c)', color: '#08080f' }
              : { color: 'rgba(245,197,66,0.55)' }
            }
          >
            <Layers size={12} />
            New Layout
            <ChevronDown
              size={11}
              style={{
                transform: layoutMenuOpen ? 'rotate(180deg)' : 'rotate(0)',
                transition: 'transform 0.2s',
              }}
            />
          </button>

          {/* Design variant dropdown */}
          {layoutMenuOpen && (
            <div
              className="absolute top-full left-0 mt-2 rounded-2xl p-3 shadow-2xl z-50 w-52"
              style={{
                background: '#0e0c07',
                border: '1px solid rgba(245,197,66,0.25)',
                minWidth: '220px',
              }}
            >
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2.5" style={{ color: 'rgba(245,197,66,0.5)' }}>
                Select Design
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(['design_1', 'design_2'] as DesignVariant[]).map((d, i) => (
                  <button
                    key={d}
                    onClick={() => { setDesignVariant(d); setLayoutMenuOpen(false); }}
                    className="rounded-xl overflow-hidden transition-all"
                    style={{
                      border: designVariant === d
                        ? '2px solid #f5c542'
                        : '2px solid rgba(245,197,66,0.15)',
                      boxShadow: designVariant === d ? '0 0 12px rgba(245,197,66,0.3)' : 'none',
                    }}
                  >
                    <div className="relative aspect-video w-full">
                      {i === 0 ? <Design1Thumb /> : <Design2Thumb />}
                      {designVariant === d && (
                        <div
                          className="absolute inset-0 flex items-center justify-center"
                          style={{ background: 'rgba(245,197,66,0.12)' }}
                        >
                          <div className="rounded-full p-0.5" style={{ background: '#f5c542' }}>
                            <Check size={10} color="#08080f" strokeWidth={3} />
                          </div>
                        </div>
                      )}
                    </div>
                    <div
                      className="py-1 text-center text-[10px] font-bold"
                      style={{ color: designVariant === d ? '#f5c542' : 'rgba(245,197,66,0.5)' }}
                    >
                      Design {i + 1}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Theme selector (top-right) ── */}
      <div ref={themeRef} className="relative ml-auto absolute right-4">
        <button
          onClick={() => setThemeOpen(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
          style={{
            background: 'rgba(0,0,0,0.4)',
            border: '1px solid rgba(245,197,66,0.2)',
            color: 'rgba(245,197,66,0.8)',
          }}
        >
          {themes.find(t => t.value === currentTheme)?.icon}
          {themes.find(t => t.value === currentTheme)?.label}
          <ChevronDown
            size={11}
            style={{
              transform: themeOpen ? 'rotate(180deg)' : 'rotate(0)',
              transition: 'transform 0.2s',
            }}
          />
        </button>

        {themeOpen && (
          <div
            className="absolute right-0 top-full mt-2 rounded-xl overflow-hidden shadow-2xl z-50"
            style={{
              background: '#0e0c07',
              border: '1px solid rgba(245,197,66,0.2)',
              minWidth: '130px',
            }}
          >
            {themes.map(t => (
              <button
                key={t.value}
                onClick={() => { setTheme(t.value); setThemeOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold transition-all"
                style={{
                  color: currentTheme === t.value ? '#f5c542' : 'rgba(245,197,66,0.55)',
                  background: 'transparent',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(245,197,66,0.06)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {t.icon}
                {t.label}
                {currentTheme === t.value && (
                  <Check size={11} style={{ marginLeft: 'auto', color: '#f5c542' }} />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
