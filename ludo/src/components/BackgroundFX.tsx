import { useEffect, useRef } from 'react';
import type { Theme } from '../themes';

interface P {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  rot: number;
  vr: number;
  c: string;
  a: number;
  ph: number;
}

const COUNTS: Record<Theme['ambient'], number> = {
  bokeh: 14,
  dots: 46,
  grid: 22,
  sprinkles: 38,
  bubbles: 24,
  leaves: 15,
  stars: 110,
  hearts: 15,
  snow: 64,
};

export default function BackgroundFX({ theme }: { theme: Theme }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const amb = theme.ambient;
    const cols = theme.ambientColors;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let W = 0;
    let H = 0;
    let raf = 0;
    let last = performance.now();
    let t = 0;
    let ps: P[] = [];
    let shoot: { x: number; y: number; vx: number; vy: number; life: number } | null = null;
    let nextShoot = 3;
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    const pick = () => cols[(Math.random() * cols.length) | 0];

    const spawn = (initial: boolean): P => {
      const p: P = { x: rnd(0, W), y: rnd(0, H), vx: 0, vy: 0, r: 2, rot: rnd(0, 6.28), vr: 0, c: pick(), a: 1, ph: rnd(0, 6.28) };
      switch (amb) {
        case 'bokeh':
          p.r = rnd(30, 110);
          p.vx = rnd(-8, 8);
          p.vy = rnd(-14, -4);
          p.a = rnd(0.25, 0.5);
          if (!initial) p.y = H + p.r;
          break;
        case 'dots':
          p.r = rnd(0.8, 2.6);
          p.vx = rnd(-6, 6);
          p.vy = rnd(-6, 6);
          p.a = rnd(0.3, 0.8);
          break;
        case 'grid':
          p.r = rnd(1, 2.6);
          p.vy = rnd(-18, -6);
          p.a = rnd(0.4, 0.9);
          if (!initial) p.y = H + 5;
          break;
        case 'sprinkles':
          p.r = rnd(4, 7);
          p.vx = rnd(-6, 6);
          p.vy = rnd(18, 40);
          p.vr = rnd(-2, 2);
          p.a = rnd(0.55, 0.9);
          if (!initial) p.y = -12;
          break;
        case 'bubbles':
          p.r = rnd(4, 18);
          p.vy = rnd(-40, -15);
          p.a = rnd(0.35, 0.7);
          if (!initial) p.y = H + p.r;
          break;
        case 'leaves':
          p.r = rnd(9, 16);
          p.vx = rnd(-10, 10);
          p.vy = rnd(20, 40);
          p.vr = rnd(-1.5, 1.5);
          p.a = rnd(0.5, 0.85);
          if (!initial) p.y = -20;
          break;
        case 'stars':
          p.r = rnd(0.5, 2);
          p.a = rnd(0.4, 1);
          break;
        case 'hearts':
          p.r = rnd(8, 18);
          p.vx = rnd(-6, 6);
          p.vy = rnd(-26, -10);
          p.vr = rnd(-0.6, 0.6);
          p.a = rnd(0.35, 0.65);
          if (!initial) p.y = H + 20;
          break;
        case 'snow':
          p.r = rnd(1.5, 4.2);
          p.vx = rnd(-8, 8);
          p.vy = rnd(20, 50);
          p.a = rnd(0.6, 1);
          if (!initial) p.y = -6;
          break;
      }
      return p;
    };

    const resize = () => {
      W = c.width = window.innerWidth;
      H = c.height = window.innerHeight;
      const n = Math.round(COUNTS[amb] * (reduce ? 0.4 : 1) * Math.min(1.3, Math.max(0.6, (W * H) / (1280 * 800))));
      ps = Array.from({ length: n }, () => spawn(true));
    };
    resize();
    window.addEventListener('resize', resize);

    const drawGrid = () => {
      const hz = H * 0.6;
      // sun
      const sr = Math.min(W, H) * 0.17;
      const sy = hz - sr * 0.55;
      const g = ctx.createLinearGradient(0, sy - sr, 0, sy + sr);
      g.addColorStop(0, 'rgba(255,230,0,0.55)');
      g.addColorStop(1, 'rgba(255,46,136,0.45)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(W / 2, sy, sr, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(10,1,24,0.9)';
      for (let i = 0; i < 5; i++) {
        const yy = sy + sr * (0.1 + i * 0.2);
        ctx.fillRect(W / 2 - sr, yy, sr * 2, 2 + i * 1.5);
      }
      ctx.fillStyle = 'rgba(8,0,20,0.85)';
      ctx.fillRect(0, hz, W, H - hz);
      ctx.strokeStyle = 'rgba(255,46,136,0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = -12; i <= 12; i++) {
        ctx.moveTo(W / 2 + i * 14, hz);
        ctx.lineTo(W / 2 + i * W * 0.16, H);
      }
      ctx.stroke();
      ctx.beginPath();
      for (let i = 0; i < 14; i++) {
        const z = ((i + t * 0.9) % 14) / 14;
        const y = hz + (H - hz) * Math.pow(z, 2.2);
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
      }
      ctx.strokeStyle = 'rgba(0,229,255,0.35)';
      ctx.stroke();
    };

    const heart = (s: number) => {
      ctx.beginPath();
      ctx.moveTo(0, s * 0.35);
      ctx.bezierCurveTo(-s * 0.95, -s * 0.25, -s * 0.38, -s * 0.98, 0, -s * 0.42);
      ctx.bezierCurveTo(s * 0.38, -s * 0.98, s * 0.95, -s * 0.25, 0, s * 0.35);
      ctx.closePath();
    };

    const frame = (now: number) => {
      const dt = Math.min(50, now - last) / 1000;
      last = now;
      t += dt;
      ctx.clearRect(0, 0, W, H);
      if (amb === 'grid') drawGrid();
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        const sway = Math.sin(t * 1.3 + p.ph);
        switch (amb) {
          case 'bokeh': {
            if (p.y < -p.r * 2) ps[i] = spawn(false);
            const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
            g.addColorStop(0, p.c);
            g.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.globalAlpha = p.a;
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
            break;
          }
          case 'dots':
            if (p.x < -5) p.x = W + 5;
            if (p.x > W + 5) p.x = -5;
            if (p.y < -5) p.y = H + 5;
            if (p.y > H + 5) p.y = -5;
            ctx.globalAlpha = p.a * (0.5 + 0.5 * Math.sin(t * 2 + p.ph));
            ctx.fillStyle = p.c;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
            break;
          case 'grid':
            if (p.y < -5) ps[i] = spawn(false);
            ctx.globalAlpha = p.a * (0.6 + 0.4 * Math.sin(t * 3 + p.ph));
            ctx.fillStyle = p.c;
            ctx.beginPath();
            ctx.arc(p.x + sway * 6, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
            break;
          case 'sprinkles':
            if (p.y > H + 12) ps[i] = spawn(false);
            ctx.save();
            ctx.globalAlpha = p.a;
            ctx.translate(p.x + sway * 8, p.y);
            ctx.rotate(p.rot);
            ctx.fillStyle = p.c;
            ctx.beginPath();
            ctx.moveTo(-1.6, -p.r);
            ctx.arcTo(1.6, -p.r, 1.6, p.r, 1.6);
            ctx.arcTo(1.6, p.r, -1.6, p.r, 1.6);
            ctx.arcTo(-1.6, p.r, -1.6, -p.r, 1.6);
            ctx.arcTo(-1.6, -p.r, 1.6, -p.r, 1.6);
            ctx.fill();
            ctx.restore();
            break;
          case 'bubbles': {
            if (p.y < -p.r * 2) ps[i] = spawn(false);
            const bx = p.x + sway * 10;
            ctx.globalAlpha = p.a;
            ctx.strokeStyle = p.c;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(bx, p.y, p.r, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.18)';
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.beginPath();
            ctx.arc(bx - p.r * 0.35, p.y - p.r * 0.35, p.r * 0.22, 0, Math.PI * 2);
            ctx.fill();
            break;
          }
          case 'leaves':
            if (p.y > H + 24) ps[i] = spawn(false);
            ctx.save();
            ctx.globalAlpha = p.a;
            ctx.translate(p.x + sway * 22, p.y);
            ctx.rotate(p.rot + sway * 0.6);
            ctx.fillStyle = p.c;
            ctx.beginPath();
            ctx.moveTo(-p.r, 0);
            ctx.quadraticCurveTo(0, -p.r * 0.65, p.r, 0);
            ctx.quadraticCurveTo(0, p.r * 0.65, -p.r, 0);
            ctx.fill();
            ctx.strokeStyle = 'rgba(0,60,0,0.35)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(-p.r, 0);
            ctx.lineTo(p.r, 0);
            ctx.stroke();
            ctx.restore();
            break;
          case 'stars': {
            const tw = 0.45 + 0.55 * Math.sin(t * (1 + p.ph * 0.3) + p.ph);
            ctx.globalAlpha = p.a * tw;
            ctx.fillStyle = p.c;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
            if (p.r > 1.6) {
              ctx.fillRect(p.x - p.r * 2.5, p.y - 0.4, p.r * 5, 0.8);
              ctx.fillRect(p.x - 0.4, p.y - p.r * 2.5, 0.8, p.r * 5);
            }
            break;
          }
          case 'hearts':
            if (p.y < -30) ps[i] = spawn(false);
            ctx.save();
            ctx.globalAlpha = p.a;
            ctx.translate(p.x + sway * 12, p.y);
            ctx.rotate(Math.sin(t + p.ph) * 0.3);
            ctx.fillStyle = p.c;
            heart(p.r);
            ctx.fill();
            ctx.restore();
            break;
          case 'snow':
            if (p.y > H + 6) ps[i] = spawn(false);
            ctx.globalAlpha = p.a;
            ctx.fillStyle = p.c;
            ctx.beginPath();
            ctx.arc(p.x + sway * 14, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
            break;
        }
      }
      if (amb === 'stars') {
        nextShoot -= dt;
        if (!shoot && nextShoot <= 0) {
          shoot = { x: rnd(W * 0.1, W * 0.7), y: rnd(0, H * 0.4), vx: rnd(500, 800), vy: rnd(160, 300), life: 0 };
          nextShoot = rnd(4, 8);
        }
        if (shoot) {
          shoot.life += dt;
          shoot.x += shoot.vx * dt;
          shoot.y += shoot.vy * dt;
          const g = ctx.createLinearGradient(shoot.x, shoot.y, shoot.x - shoot.vx * 0.15, shoot.y - shoot.vy * 0.15);
          g.addColorStop(0, 'rgba(255,255,255,0.95)');
          g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.globalAlpha = Math.max(0, 1 - shoot.life / 1.2);
          ctx.strokeStyle = g;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(shoot.x, shoot.y);
          ctx.lineTo(shoot.x - shoot.vx * 0.15, shoot.y - shoot.vy * 0.15);
          ctx.stroke();
          if (shoot.life > 1.2) shoot = null;
        }
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [theme]);

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 h-full w-full" />;
}
