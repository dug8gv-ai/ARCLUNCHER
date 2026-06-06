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

const DROP_COUNT = 60; // Low count = zero frame lag on mobile

function createDrop(canvasWidth: number, canvasHeight: number): Drop {
  return {
    x:       Math.random() * canvasWidth,
    y:       Math.random() * canvasHeight - canvasHeight,
    length:  Math.random() * 18 + 8,
    speed:   Math.random() * 0.8 + 0.3,   // very slow — 0.3–1.1 px/frame
    opacity: Math.random() * 0.12 + 0.04, // 0.04–0.16, very translucent
    width:   Math.random() * 0.8 + 0.4,   // thin strokes
  };
}

export function RainBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);
  const dropsRef  = useRef<Drop[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      // Re-seed drops on resize
      dropsRef.current = Array.from({ length: DROP_COUNT }, () =>
        createDrop(canvas.width, canvas.height)
      );
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      dropsRef.current.forEach(drop => {
        ctx.beginPath();
        ctx.moveTo(drop.x, drop.y);
        ctx.lineTo(drop.x - drop.width, drop.y + drop.length);
        ctx.strokeStyle = `rgba(59, 130, 246, ${drop.opacity})`;
        ctx.lineWidth   = drop.width;
        ctx.lineCap     = 'round';
        ctx.stroke();

        // Advance drop
        drop.y += drop.speed;

        // Reset when off-screen
        if (drop.y > canvas.height + drop.length) {
          drop.y  = -drop.length - Math.random() * 100;
          drop.x  = Math.random() * canvas.width;
          drop.speed   = Math.random() * 0.8 + 0.3;
          drop.opacity = Math.random() * 0.12 + 0.04;
          drop.length  = Math.random() * 18 + 8;
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
        position:   'fixed',
        inset:      0,
        zIndex:     0,
        pointerEvents: 'none',
        willChange: 'transform',
      }}
    />
  );
}
