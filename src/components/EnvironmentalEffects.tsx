'use client';

import { useEffect, useRef } from 'react';

export function EnvironmentalEffects() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    // Particles arrays
    const raindrops: any[] = [];
    const dustParticles: any[] = [];
    const sparks: any[] = [];

    // Initialize particles
    for (let i = 0; i < 150; i++) {
      raindrops.push({
        x: Math.random() * width,
        y: Math.random() * height,
        len: Math.random() * 20 + 10,
        speed: Math.random() * 10 + 15,
        thickness: Math.random() * 1.5 + 0.5
      });
    }

    for (let i = 0; i < 100; i++) {
      dustParticles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 1.5 + 0.5,
        speedX: Math.random() * 5 + 2,
        speedY: (Math.random() - 0.5) * 1,
        opacity: Math.random() * 0.5 + 0.1
      });
    }

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };
    window.addEventListener('resize', resize);

    let animationFrameId: number;
    let frameCount = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      frameCount++;

      // Draw Rain
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
      ctx.lineCap = 'round';
      raindrops.forEach(drop => {
        ctx.lineWidth = drop.thickness;
        ctx.beginPath();
        ctx.moveTo(drop.x, drop.y);
        ctx.lineTo(drop.x + drop.len * 0.2, drop.y + drop.len); // angled rain
        ctx.stroke();

        drop.y += drop.speed;
        drop.x += drop.speed * 0.2;

        if (drop.y > height) {
          drop.y = -20;
          drop.x = Math.random() * width;
        }
        if (drop.x > width) {
          drop.x = -20;
        }
      });

      // Draw Wind/Dust
      dustParticles.forEach(dust => {
        ctx.fillStyle = `rgba(255, 255, 255, ${dust.opacity})`;
        ctx.beginPath();
        ctx.arc(dust.x, dust.y, dust.radius, 0, Math.PI * 2);
        ctx.fill();

        dust.x += dust.speedX;
        dust.y += dust.speedY;

        if (dust.x > width) {
          dust.x = -10;
          dust.y = Math.random() * height;
        }
      });

      // Electric Sparks
      if (Math.random() < 0.05) { // 5% chance every frame to spawn a spark
        sparks.push({
          x: Math.random() * width,
          y: Math.random() * height,
          life: 15,
          branches: Array.from({length: Math.floor(Math.random() * 3 + 2)}).map(() => ({
            dx: (Math.random() - 0.5) * 40,
            dy: (Math.random() - 0.5) * 40
          }))
        });
      }

      for (let i = sparks.length - 1; i >= 0; i--) {
        const spark = sparks[i];
        ctx.strokeStyle = `rgba(255, 0, 255, ${spark.life / 15})`;
        ctx.lineWidth = 1.5;
        
        spark.branches.forEach((b: any) => {
          ctx.beginPath();
          ctx.moveTo(spark.x, spark.y);
          ctx.lineTo(spark.x + b.dx + (Math.random()-0.5)*10, spark.y + b.dy + (Math.random()-0.5)*10);
          ctx.stroke();
        });

        spark.life--;
        if (spark.life <= 0) {
          sparks.splice(i, 1);
        }
      }

      // Lightning flash occasionally
      if (Math.random() < 0.005) {
        ctx.fillStyle = 'rgba(0, 240, 255, 0.15)';
        ctx.fillRect(0, 0, width, height);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.8 }}
    />
  );
}
