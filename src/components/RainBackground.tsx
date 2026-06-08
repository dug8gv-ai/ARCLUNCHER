'use client';

import { useEffect, useRef } from 'react';

interface Drop {
  x: number;
  y: number;
  length: number;
  speed: number;
  opacity: number;
  width: number;
}

// 150 drops — dense enough to be clearly visible everywhere on screen
const DROP_COUNT = 150;

function createDrop(w: number, h: number): Drop {
  return {
    x:       Math.random() * w,
    // Spread initial y across full height so screen fills instantly on load
    y:       Math.random() * h * 2 - h,
    length:  Math.random() * 22 + 12,          // 12–34px drop length
    speed:   Math.random() * 1.2 + 0.6,        // 0.6–1.8 px/frame — gentle fall
    opacity: Math.random() * 0.35 + 0.12,      // 0.12–0.47 — clearly visible
    width:   Math.random() * 1.2 + 0.6,        // 0.6–1.8px stroke width
  };
}

export function RainBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);
  const dropsRef  = useRef<Drop[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    // ── Resize: fill full viewport ────────────────────────────────
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w   = window.innerWidth;
      const h   = window.innerHeight;

      // Use CSS size for positioning, physical pixels for rendering
      canvas.style.width  = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.width  = w * dpr;
      canvas.height = h * dpr;
      ctx.scale(dpr, dpr);

      // Rebuild drops sized to logical pixels
      dropsRef.current = Array.from({ length: DROP_COUNT }, () =>
        createDrop(w, h)
      );
    };

    resize();
    window.addEventListener('resize', resize);

    // ── Animation loop ─────────────────────────────────────────────
    const draw = () => {
      const w = canvas.width  / (window.devicePixelRatio || 1);
      const h = canvas.height / (window.devicePixelRatio || 1);

      ctx.clearRect(0, 0, w, h);

      dropsRef.current.forEach(drop => {
        // Draw raindrop streak
        const gradient = ctx.createLinearGradient(
          drop.x, drop.y,
          drop.x - 1, drop.y + drop.length
        );
        gradient.addColorStop(0, `rgba(59, 130, 246, 0)`);
        gradient.addColorStop(0.4, `rgba(59, 130, 246, ${drop.opacity * 0.7})`);
        gradient.addColorStop(1, `rgba(59, 130, 246, ${drop.opacity})`);

        ctx.beginPath();
        ctx.moveTo(drop.x, drop.y);
        ctx.lineTo(drop.x - drop.width * 0.5, drop.y + drop.length);
        ctx.strokeStyle = gradient;
        ctx.lineWidth   = drop.width;
        ctx.lineCap     = 'round';
        ctx.stroke();

        // Draw tiny splash dot at bottom of streak
        ctx.beginPath();
        ctx.arc(drop.x - drop.width * 0.5, drop.y + drop.length, drop.width * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(59, 130, 246, ${drop.opacity * 0.5})`;
        ctx.fill();

        // Move drop downward
        drop.y += drop.speed;

        // Recycle when off screen bottom
        if (drop.y > h + drop.length + 10) {
          drop.y      = -drop.length - Math.random() * 80;
          drop.x      = Math.random() * w;
          drop.speed  = Math.random() * 1.2 + 0.6;
          drop.opacity = Math.random() * 0.35 + 0.12;
          drop.length = Math.random() * 22 + 12;
          drop.width  = Math.random() * 1.2 + 0.6;
        }
      });

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position:      'fixed',
        top:           0,
        left:          0,
        width:         '100vw',
        height:        '100vh',
        zIndex:        0,
        pointerEvents: 'none',
        willChange:    'transform',
        display:       'block',
      }}
    />
  );
}
