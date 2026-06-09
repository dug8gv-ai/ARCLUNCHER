'use client';

import { useEffect, useRef } from 'react';

interface Drop {
  x: number;
  y: number;
  length: number;
  speed: number;
  width: number;
  color: string;
}

const DROP_COUNT = 320;
const COLORS = [
  'rgba(41,121,255,',
  'rgba(0,229,255,',
  'rgba(100,160,255,',
  'rgba(130,177,255,',
];

function createDrop(w: number, h: number): Drop {
  const c = COLORS[Math.floor(Math.random() * COLORS.length)];
  return {
    x:      Math.random() * w,
    y:      Math.random() * h * 2 - h,
    length: Math.random() * 35 + 15,
    speed:  Math.random() * 4 + 2,
    width:  Math.random() * 1.5 + 0.5,
    color:  c,
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

      dropsRef.current.forEach(drop => {
        const grad = ctx.createLinearGradient(drop.x, drop.y, drop.x - 1, drop.y + drop.length);
        grad.addColorStop(0,   drop.color + '0)');
        grad.addColorStop(0.4, drop.color + '0.18)');
        grad.addColorStop(1,   drop.color + '0.55)');

        ctx.beginPath();
        ctx.moveTo(drop.x, drop.y);
        ctx.lineTo(drop.x - drop.width * 0.3, drop.y + drop.length);
        ctx.strokeStyle = grad;
        ctx.lineWidth   = drop.width;
        ctx.lineCap     = 'round';
        ctx.stroke();

        // splash dot at bottom
        ctx.beginPath();
        ctx.arc(drop.x, drop.y + drop.length, drop.width * 0.8, 0, Math.PI * 2);
        ctx.fillStyle = drop.color + '0.25)';
        ctx.fill();

        drop.y += drop.speed;
        if (drop.y > h + drop.length + 10) {
          drop.y     = -drop.length - Math.random() * 60;
          drop.x     = Math.random() * w;
          drop.speed = Math.random() * 4 + 2;
          drop.length= Math.random() * 35 + 15;
          drop.width = Math.random() * 1.5 + 0.5;
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
