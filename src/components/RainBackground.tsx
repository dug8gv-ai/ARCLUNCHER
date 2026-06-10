'use client';

import { useEffect, useRef } from 'react';

interface Drop {
  x: number;
  y: number;
  length: number;
  speed: number;
  width: number;
  opacity: number;
  color: string;
}

const DROP_COUNT = 180;

const COLORS = [
  'rgba(41,121,255,',
  'rgba(0,229,255,',
  'rgba(100,160,255,',
];

function createDrop(w: number, h: number): Drop {
  const c = COLORS[Math.floor(Math.random() * COLORS.length)];
  return {
    x:       Math.random() * w,
    y:       Math.random() * h * 2 - h,
    length:  Math.random() * 60 + 30,
    speed:   Math.random() * 3 + 1.5,
    width:   Math.random() * 1.2 + 0.4,
    opacity: Math.random() * 0.4 + 0.1,
    color:   c,
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

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w   = window.innerWidth;
      const h   = window.innerHeight;
      canvas.style.width  = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.width  = w * dpr;
      canvas.height = h * dpr;
      ctx.scale(dpr, dpr);
      dropsRef.current = Array.from({ length: DROP_COUNT }, () => createDrop(w, h));
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      const w = canvas.width  / (window.devicePixelRatio || 1);
      const h = canvas.height / (window.devicePixelRatio || 1);
      ctx.clearRect(0, 0, w, h);

      for (const drop of dropsRef.current) {
        const grad = ctx.createLinearGradient(drop.x, drop.y, drop.x - 0.5, drop.y + drop.length);
        grad.addColorStop(0,   drop.color + '0)');
        grad.addColorStop(0.3, drop.color + (drop.opacity * 0.5).toFixed(2) + ')');
        grad.addColorStop(1,   drop.color + drop.opacity.toFixed(2) + ')');

        ctx.beginPath();
        ctx.moveTo(drop.x, drop.y);
        ctx.lineTo(drop.x - 0.5, drop.y + drop.length);
        ctx.strokeStyle = grad;
        ctx.lineWidth   = drop.width;
        ctx.lineCap     = 'round';
        ctx.stroke();

        drop.y += drop.speed;
        if (drop.y > h + drop.length + 20) {
          Object.assign(drop, createDrop(w, -drop.length));
          drop.y = -drop.length - Math.random() * 80;
        }
      }

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
        top: 0, left: 0,
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
