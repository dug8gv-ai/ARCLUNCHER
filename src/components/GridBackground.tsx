'use client';
import { useEffect, useRef } from 'react';

export function GridBackground() {
  const ref = useRef<HTMLCanvasElement>(null);
  const raf = useRef<number>(0);
  const off = useRef<number>(0);

  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true }); if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      const W = canvas.width / (window.devicePixelRatio || 1);
      const H = canvas.height / (window.devicePixelRatio || 1);
      ctx.clearRect(0, 0, W, H);

      const horizon = H * 0.6;
      const vp = { x: W / 2, y: horizon };
      const rows = 16, cols = 22;
      off.current = (off.current + 0.3) % ((H - horizon) / rows);
      const rowOff = off.current;

      // Horizontal lines
      for (let i = 0; i <= rows; i++) {
        const t = i / rows;
        const yt = horizon + (H - horizon) * Math.pow(t, 1.7) + rowOff * Math.pow(t, 1.4);
        if (yt > H) continue;
        const alpha = 0.03 + t * 0.18;
        const spread = W * 0.65 * t;
        ctx.beginPath();
        ctx.moveTo(vp.x - spread, yt);
        ctx.lineTo(vp.x + spread, yt);
        ctx.strokeStyle = `rgba(26,111,255,${alpha})`;
        ctx.lineWidth = 0.5 + t * 0.7;
        ctx.stroke();
      }

      // Vertical lines
      for (let j = 0; j <= cols; j++) {
        const t = j / cols;
        const xB = W * t;
        const alpha = 0.02 + Math.abs(t - 0.5) * 0.12;
        ctx.beginPath();
        ctx.moveTo(vp.x, horizon);
        ctx.lineTo(xB, H + 10);
        ctx.strokeStyle = `rgba(26,111,255,${alpha})`;
        ctx.lineWidth = 0.4;
        ctx.stroke();
      }

      // Horizon glow
      const hg = ctx.createLinearGradient(0, horizon, W, horizon);
      hg.addColorStop(0,   'rgba(0,207,255,0)');
      hg.addColorStop(0.35,'rgba(0,207,255,0.28)');
      hg.addColorStop(0.5, 'rgba(26,111,255,0.45)');
      hg.addColorStop(0.65,'rgba(0,207,255,0.28)');
      hg.addColorStop(1,   'rgba(0,207,255,0)');
      ctx.beginPath(); ctx.moveTo(0, horizon); ctx.lineTo(W, horizon);
      ctx.strokeStyle = hg; ctx.lineWidth = 1.2; ctx.stroke();

      // Right side scrolling hex data (exact ArcOmni style)
      ctx.font = '9px "Share Tech Mono", monospace';
      ctx.fillStyle = 'rgba(26,111,255,0.14)';
      const lines = [
        '0x1119e...0xc3 → +00000990563233308',
        '0x8211e...0xb3 → +00000334100293884',
        '0x3119e...0xc3 → -0000001032',
        '0x7219e...0xb3 → +032993300',
        '0x1119e...0xc3 → -103',
        '0x5519e...0xb3 → +329933',
        '0x2219e...0xc3 → +000009905632',
        '0x9911e...0xb3 → -0023341',
      ];
      const scrollY = (Date.now() / 80) % (lines.length * 15);
      lines.forEach((line, i) => {
        const y = ((i * 15 - scrollY + lines.length * 15 * 10) % (lines.length * 15)) + 20;
        if (y > 0 && y < H) ctx.fillText(line, W - 240, y);
      });

      raf.current = requestAnimationFrame(draw);
    };
    raf.current = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf.current); window.removeEventListener('resize', resize); };
  }, []);

  return <canvas ref={ref} aria-hidden="true" style={{ position:'fixed',top:0,left:0,width:'100vw',height:'100vh',zIndex:0,pointerEvents:'none' }} />;
}
