'use client';

import { useEffect, useRef } from 'react';

export function GridBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);
  const offsetRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.style.width  = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      canvas.width  = window.innerWidth  * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      const W = canvas.width  / (window.devicePixelRatio || 1);
      const H = canvas.height / (window.devicePixelRatio || 1);
      ctx.clearRect(0, 0, W, H);

      // ── 3D perspective grid on bottom half ──
      const horizon  = H * 0.62;
      const vp       = { x: W / 2, y: horizon };
      const gridRows = 18;
      const gridCols = 24;
      const speed    = 0.4;

      offsetRef.current = (offsetRef.current + speed) % (H * 0.38 / gridRows);
      const rowOffset = offsetRef.current;

      // Horizontal lines (perspective)
      for (let i = 0; i <= gridRows; i++) {
        const t  = (i / gridRows);
        const yt = horizon + (H - horizon) * Math.pow(t, 1.6) + rowOffset * Math.pow(t, 1.4);
        if (yt > H) continue;

        const alpha = 0.04 + t * 0.22;
        const spreadX = (W * 0.7) * t;

        ctx.beginPath();
        ctx.moveTo(vp.x - spreadX, yt);
        ctx.lineTo(vp.x + spreadX, yt);
        ctx.strokeStyle = `rgba(41,121,255,${alpha})`;
        ctx.lineWidth   = 0.6 + t * 0.8;
        ctx.stroke();
      }

      // Vertical lines (converging to vanishing point)
      for (let j = 0; j <= gridCols; j++) {
        const t  = j / gridCols;
        const xBottom = W * t;
        const alpha   = 0.03 + Math.abs(t - 0.5) * 0.15;

        ctx.beginPath();
        ctx.moveTo(vp.x, horizon);
        ctx.lineTo(xBottom, H + 20);
        ctx.strokeStyle = `rgba(41,121,255,${alpha})`;
        ctx.lineWidth   = 0.5;
        ctx.stroke();
      }

      // Horizon glow line
      const hGrad = ctx.createLinearGradient(0, horizon, W, horizon);
      hGrad.addColorStop(0,   'rgba(41,121,255,0)');
      hGrad.addColorStop(0.3, 'rgba(0,229,255,0.35)');
      hGrad.addColorStop(0.5, 'rgba(41,121,255,0.55)');
      hGrad.addColorStop(0.7, 'rgba(0,229,255,0.35)');
      hGrad.addColorStop(1,   'rgba(41,121,255,0)');
      ctx.beginPath();
      ctx.moveTo(0, horizon);
      ctx.lineTo(W, horizon);
      ctx.strokeStyle = hGrad;
      ctx.lineWidth   = 1.5;
      ctx.stroke();

      // Horizon vertical glow
      const vGrad = ctx.createRadialGradient(W/2, horizon, 0, W/2, horizon, W * 0.45);
      vGrad.addColorStop(0,   'rgba(41,121,255,0.18)');
      vGrad.addColorStop(0.5, 'rgba(41,121,255,0.04)');
      vGrad.addColorStop(1,   'rgba(41,121,255,0)');
      ctx.beginPath();
      ctx.ellipse(W/2, horizon, W * 0.45, 60, 0, 0, Math.PI * 2);
      ctx.fillStyle = vGrad;
      ctx.fill();

      // Right side scrolling binary/hex data
      const binaryLines = [
        '0x1119e...0xc3 → +0000099056323330888',
        '0x1119e...0xc3 → +0000099056323330888',
        '0x2119e...0xb3 → +0000003341',
        '0x8211e...0xb3 → +0329933',
        '0x1119e...0xc3 → -103',
        '0x7219e...0xb3 → +0329933',
      ];
      ctx.font = '9px monospace';
      ctx.fillStyle = 'rgba(41,121,255,0.18)';
      const scrollY = (Date.now() / 60) % (binaryLines.length * 16);
      binaryLines.forEach((line, i) => {
        const y = ((i * 16 - scrollY + binaryLines.length * 16 * 10) % (binaryLines.length * 16)) + 40;
        if (y > 0 && y < H) {
          ctx.fillText(line, W - 260, y);
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
        display:       'block',
      }}
    />
  );
}
