'use client';
import { useEffect, useRef } from 'react';

interface Drop {
  x: number; y: number; len: number;
  speed: number; width: number; alpha: number;
}

const N = 140;

export function RainBackground() {
  const ref = useRef<HTMLCanvasElement>(null);
  const raf = useRef<number>(0);
  const drops = useRef<Drop[]>([]);

  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true }); if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = window.innerWidth, h = window.innerHeight;
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.scale(dpr, dpr);
      drops.current = Array.from({ length: N }, () => ({
        x: Math.random() * w,
        y: Math.random() * h * 2 - h,
        len:   Math.random() * 55 + 20,
        speed: Math.random() * 2.5 + 1,
        width: Math.random() * 1 + 0.3,
        alpha: Math.random() * 0.28 + 0.06,
      }));
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      const w = canvas.width / (window.devicePixelRatio || 1);
      const h = canvas.height / (window.devicePixelRatio || 1);
      ctx.clearRect(0, 0, w, h);

      for (const d of drops.current) {
        const g = ctx.createLinearGradient(d.x, d.y, d.x, d.y + d.len);
        g.addColorStop(0, `rgba(26,111,255,0)`);
        g.addColorStop(1, `rgba(0,207,255,${d.alpha})`);
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - 0.3, d.y + d.len);
        ctx.strokeStyle = g;
        ctx.lineWidth = d.width;
        ctx.lineCap = 'round';
        ctx.stroke();
        d.y += d.speed;
        if (d.y > h + d.len + 10) {
          d.y = -d.len - Math.random() * 60;
          d.x = Math.random() * w;
          d.speed = Math.random() * 2.5 + 1;
        }
      }
      raf.current = requestAnimationFrame(draw);
    };
    raf.current = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf.current); window.removeEventListener('resize', resize); };
  }, []);

  return <canvas ref={ref} aria-hidden="true" style={{ position:'fixed',top:0,left:0,width:'100vw',height:'100vh',zIndex:0,pointerEvents:'none' }} />;
}
