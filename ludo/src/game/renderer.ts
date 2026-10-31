import type { LudoGame, Token } from './engine';
import type { Theme } from '../themes';
import { isLight, rgba, shade } from '../themes';
import { TOKEN_R, type BoardGeom, type Vec } from './geometry';

const FONT = `'Fredoka', 'Baloo 2', 'Nunito', system-ui, sans-serif`;
const TAU = Math.PI * 2;

type Ctx = CanvasRenderingContext2D;

function pathPoly(ctx: Ctx, pts: Vec[]) {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
}

function roundPoly(ctx: Ctx, pts: Vec[], r: number) {
  ctx.beginPath();
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const d1 = Math.hypot(p0.x - p1.x, p0.y - p1.y) || 1;
    const d2 = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1;
    const rr = Math.min(r, d1 / 2, d2 / 2);
    const ax = p1.x + ((p0.x - p1.x) / d1) * rr;
    const ay = p1.y + ((p0.y - p1.y) / d1) * rr;
    const bx = p1.x + ((p2.x - p1.x) / d2) * rr;
    const by = p1.y + ((p2.y - p1.y) / d2) * rr;
    if (i === 0) ctx.moveTo(ax, ay);
    else ctx.lineTo(ax, ay);
    ctx.quadraticCurveTo(p1.x, p1.y, bx, by);
  }
  ctx.closePath();
}

function rrect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function starPath(ctx: Ctx, cx: number, cy: number, R: number, r: number, n = 5, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const rad = i % 2 ? r : R;
    const a = rot + (i * Math.PI) / n;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.closePath();
}

const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
const easeOutBack = (x: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

function shrink(poly: Vec[], c: Vec, f: number): Vec[] {
  return poly.map((p) => ({ x: c.x + (p.x - c.x) * f, y: c.y + (p.y - c.y) * f }));
}

export class Renderer {
  private ctx: Ctx;
  private board: HTMLCanvasElement | null = null;
  private boardKey = '';
  private sprites = new Map<string, { c: HTMLCanvasElement; half: number }>();
  private yardDraw = new Map<BoardGeom, Vec[][]>();
  private canvas: HTMLCanvasElement;
  private theme: Theme;
  w = 1;
  h = 1;
  dpr = 1;
  scale = 1;
  ox = 0;
  oy = 0;

  constructor(canvas: HTMLCanvasElement, theme: Theme) {
    this.canvas = canvas;
    this.theme = theme;
    this.ctx = canvas.getContext('2d')!;
  }

  setTheme(t: Theme) {
    if (t.id !== this.theme.id) {
      this.theme = t;
      this.boardKey = '';
      this.sprites.clear();
    }
  }

  resize(w: number, h: number) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = Math.max(1, Math.floor(w));
    h = Math.max(1, Math.floor(h));
    if (w === this.w && h === this.h && dpr === this.dpr) return;
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.boardKey = '';
    this.sprites.clear();
  }

  private fit(game: LudoGame) {
    const b = game.geom.bounds;
    const bw = b.maxX - b.minX;
    const bh = b.maxY - b.minY;
    this.scale = Math.min(this.w / bw, this.h / bh);
    this.ox = (this.w - bw * this.scale) / 2 - b.minX * this.scale;
    this.oy = (this.h - bh * this.scale) / 2 - b.minY * this.scale;
  }

  toBoard(px: number, py: number): Vec {
    return { x: (px - this.ox) / this.scale, y: (py - this.oy) / this.scale };
  }

  /** Canvas-pixel position of a board-space point. */
  toCanvas(p: Vec): Vec {
    return { x: p.x * this.scale + this.ox, y: p.y * this.scale + this.oy };
  }

  /** Pixel position of each arm's yard center relative to the canvas element. */
  armCanvasPositions(game: LudoGame): Vec[] {
    return game.geom.yardCenter.map((c) => this.toCanvas(c));
  }

  private yards(g: BoardGeom) {
    let y = this.yardDraw.get(g);
    if (!y) {
      y = g.yardPoly.map((p, i) => shrink(p, g.yardCenter[i], 0.965));
      this.yardDraw.set(g, y);
    }
    return y;
  }

  render(game: LudoGame) {
    const ctx = this.ctx;
    this.fit(game);
    const key = `${this.theme.id}|${this.canvas.width}x${this.canvas.height}|${game.N}|${game.opts.tokens}|${game.armOwner
      .map((pi) => (pi >= 0 ? game.color(pi) : '-'))
      .join(',')}`;
    if (key !== this.boardKey) {
      this.buildBoard(game);
      this.boardKey = key;
    }
    const k = this.dpr * this.scale;
    const sh = game.shakeOffset();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.board) ctx.drawImage(this.board, sh.x * k, sh.y * k);
    ctx.setTransform(k, 0, 0, k, this.dpr * this.ox + sh.x * k, this.dpr * this.oy + sh.y * k);
    this.drawOverlay(game);
    this.drawTokens(game);
    this.drawParticles(game);
    if (game.flashT > 0) {
      ctx.globalAlpha = Math.min(1, game.flashT / game.flashMax) * 0.3;
      pathPoly(ctx, game.geom.outline);
      ctx.fillStyle = game.flashColor;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    this.drawTexts(game, sh);
  }

  // ------------------------------------------------------------------ static board
  private buildBoard(game: LudoGame) {
    if (!this.board) this.board = document.createElement('canvas');
    const c = this.board;
    c.width = this.canvas.width;
    c.height = this.canvas.height;
    const x = c.getContext('2d')!;
    const T = this.theme;
    const g = game.geom;
    const dpr = this.dpr;
    const k = dpr * this.scale;
    const neon = T.style === 'neon';
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.clearRect(0, 0, c.width, c.height);
    x.setTransform(k, 0, 0, k, dpr * this.ox, dpr * this.oy);
    const armCol = (arm: number) => {
      const pi = game.armOwner[arm];
      return pi >= 0 ? game.color(pi) : null;
    };
    const neutral = isLight(T.boardBg) ? '#d9dee7' : '#3f4b5e';

    // board body
    x.save();
    x.lineJoin = 'round';
    pathPoly(x, g.outline);
    x.shadowColor = T.boardShadow;
    x.shadowBlur = (neon ? 28 : 22) * dpr;
    x.shadowOffsetY = (neon ? 0 : 7) * dpr;
    x.lineWidth = 1.55;
    x.strokeStyle = T.boardEdge;
    x.stroke();
    x.restore();
    x.save();
    x.lineJoin = 'round';
    pathPoly(x, g.outline);
    x.lineWidth = 1.22;
    x.strokeStyle = T.boardBg;
    x.stroke();
    x.fillStyle = T.boardBg;
    x.fill();
    x.restore();

    // yards
    const yards = this.yards(g);
    for (let arm = 0; arm < g.N; arm++) {
      const col = armCol(arm);
      x.save();
      roundPoly(x, yards[arm], 0.45);
      if (col) {
        if (neon) {
          x.fillStyle = rgba(col, 0.14);
          x.fill();
          x.shadowColor = col;
          x.shadowBlur = 12 * dpr;
          x.lineWidth = 0.09;
          x.strokeStyle = col;
          x.stroke();
        } else {
          const c0 = g.yardCenter[arm];
          const gr = x.createLinearGradient(c0.x - 3, c0.y - 3, c0.x + 3, c0.y + 3);
          gr.addColorStop(0, shade(col, 0.2));
          gr.addColorStop(1, shade(col, -0.12));
          x.fillStyle = gr;
          x.fill();
          x.lineWidth = 0.06;
          x.strokeStyle = shade(col, -0.25);
          x.stroke();
        }
      } else {
        x.globalAlpha = neon ? 0.25 : 0.55;
        x.fillStyle = neutral;
        x.fill();
      }
      x.restore();

      x.save();
      roundPoly(x, g.yardInset[arm], 0.55);
      x.fillStyle = neon ? 'rgba(5,1,15,0.8)' : T.cell;
      if (!col) x.globalAlpha = 0.5;
      x.fill();
      if (col) {
        x.lineWidth = 0.07;
        x.strokeStyle = neon ? col : shade(col, -0.2);
        x.globalAlpha = neon ? 0.85 : 0.45;
        x.stroke();
      }
      x.restore();

      if (col) {
        for (let j = 0; j < game.opts.tokens; j++) {
          const s = g.yardSpots[arm][j];
          x.beginPath();
          x.arc(s.x, s.y, 0.43, 0, TAU);
          x.fillStyle = rgba(col, neon ? 0.16 : 0.2);
          x.fill();
          x.lineWidth = 0.05;
          x.strokeStyle = rgba(col, 0.7);
          x.stroke();
        }
      } else {
        const cc = g.yardCenter[arm];
        starPath(x, cc.x, cc.y, 0.7, 0.3);
        x.globalAlpha = 0.25;
        x.fillStyle = T.star;
        x.fill();
        x.globalAlpha = 1;
      }
    }

    // home triangles
    for (let arm = 0; arm < g.N; arm++) {
      const col = armCol(arm) ?? neutral;
      const tri = g.homeTri[arm];
      x.save();
      pathPoly(x, tri);
      if (neon) {
        x.fillStyle = rgba(col, 0.32);
        x.fill();
        x.shadowColor = col;
        x.shadowBlur = 10 * dpr;
        x.strokeStyle = col;
        x.lineWidth = 0.06;
        x.stroke();
      } else {
        const m = { x: (tri[1].x + tri[2].x) / 2, y: (tri[1].y + tri[2].y) / 2 };
        const gr = x.createLinearGradient(0, 0, m.x, m.y);
        gr.addColorStop(0, shade(col, 0.25));
        gr.addColorStop(1, col);
        x.fillStyle = gr;
        x.fill();
        x.strokeStyle = T.boardBg;
        x.lineWidth = 0.07;
        x.stroke();
      }
      x.restore();
    }
    const cr = Math.min(0.62, g.apothem * 0.5);
    x.beginPath();
    x.arc(0, 0, cr, 0, TAU);
    x.fillStyle = neon ? '#0c0620' : T.boardBg;
    x.fill();
    x.lineWidth = 0.06;
    x.strokeStyle = neon ? '#ffffff' : T.boardEdge;
    x.stroke();
    starPath(x, 0, 0, cr * 0.72, cr * 0.32);
    x.fillStyle = '#fbbf24';
    x.fill();
    x.lineWidth = 0.035;
    x.strokeStyle = '#d97706';
    x.stroke();

    // track cells
    for (let i = 0; i < g.T; i++) {
      const arm = g.trackArm[i];
      const kind = g.trackKind[i];
      const col = armCol(arm);
      const p = g.track[i];
      const ang = g.trackAngle[i];
      let fill = T.cell;
      let stroke = T.cellStroke;
      let glow: string | null = null;
      if (kind === 'start' && col) {
        fill = neon ? rgba(col, 0.3) : col;
        stroke = neon ? col : shade(col, -0.22);
        glow = neon ? col : null;
      }
      this.cell(x, p, ang, fill, stroke, glow);
      if (kind === 'start') this.arrow(x, p, ang, col ? '#ffffff' : T.star);
      else if (kind === 'star') {
        starPath(x, p.x, p.y, 0.3, 0.13, 5, -Math.PI / 2);
        x.fillStyle = T.star;
        x.globalAlpha = 0.85;
        x.fill();
        x.globalAlpha = 1;
      } else if (kind === 'cap' && col) this.arrow(x, p, ang, col);
    }
    // home columns
    for (let arm = 0; arm < g.N; arm++) {
      const col = armCol(arm) ?? neutral;
      const ang = g.arms[arm].angle;
      for (const p of g.homeCol[arm]) {
        this.cell(x, p, ang, neon ? rgba(col, 0.28) : col, neon ? col : shade(col, -0.2), neon ? col : null);
      }
    }
  }

  private cell(x: Ctx, p: Vec, ang: number, fill: string, stroke: string, glow: string | null) {
    x.save();
    x.translate(p.x, p.y);
    if (this.theme.style !== 'neon') {
      x.save();
      x.translate(0, 0.05);
      x.rotate(ang);
      rrect(x, -0.45, -0.45, 0.9, 0.9, 0.16);
      x.fillStyle = 'rgba(0,0,0,0.13)';
      x.fill();
      x.restore();
    }
    x.rotate(ang);
    rrect(x, -0.45, -0.45, 0.9, 0.9, 0.16);
    x.fillStyle = fill;
    x.fill();
    if (glow) {
      x.shadowColor = glow;
      x.shadowBlur = 8 * this.dpr;
    }
    x.lineWidth = 0.045;
    x.strokeStyle = stroke;
    x.stroke();
    x.restore();
  }

  private arrow(x: Ctx, p: Vec, ang: number, color: string) {
    x.save();
    x.translate(p.x, p.y);
    x.rotate(ang);
    x.beginPath();
    x.moveTo(-0.29, 0);
    x.lineTo(0.02, -0.25);
    x.lineTo(0.02, -0.09);
    x.lineTo(0.27, -0.09);
    x.lineTo(0.27, 0.09);
    x.lineTo(0.02, 0.09);
    x.lineTo(0.02, 0.25);
    x.closePath();
    x.fillStyle = color;
    x.fill();
    x.restore();
  }

  // ------------------------------------------------------------------ dynamic layers
  private drawOverlay(game: LudoGame) {
    const ctx = this.ctx;
    const g = game.geom;
    const T = this.theme;
    if (!game.over) {
      const pi = game.current;
      const arm = game.players[pi].arm;
      const col = game.color(pi);
      const pulse = 0.5 + 0.5 * Math.sin(game.clock / 210);
      ctx.save();
      roundPoly(ctx, this.yards(g)[arm], 0.45);
      ctx.lineWidth = 0.1 + 0.1 * pulse;
      ctx.strokeStyle = T.dark || T.style === 'neon' ? '#ffffff' : col;
      ctx.globalAlpha = 0.5 + 0.5 * pulse;
      ctx.shadowColor = col;
      ctx.shadowBlur = (8 + 16 * pulse) * this.dpr;
      ctx.stroke();
      ctx.restore();
    }

    if (game.phase === 'select' && game.selected >= 0) {
      const pi = game.current;
      const t = game.tokens[pi][game.selected];
      if (!t || t.pos >= g.homeIndex) return;
      const col = game.color(pi);
      const start = t.pos < 0 ? 0 : t.pos + 1;
      const end = t.pos < 0 ? 0 : Math.min(g.homeIndex, t.pos + game.dice);
      ctx.save();
      for (let s = start; s < end; s++) {
        const p = game.cellPos(pi, s, t.idx);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 0.11, 0, TAU);
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = col;
        ctx.fill();
        ctx.lineWidth = 0.035;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      }
      const dest = game.cellPos(pi, end, t.idx);
      const cap = game.wouldCapture(pi, game.selected, game.dice);
      const pulse = 0.5 + 0.5 * Math.sin(game.clock / 140);
      ctx.translate(dest.x, dest.y);
      ctx.rotate(game.clock / 650);
      ctx.globalAlpha = 1;
      ctx.setLineDash([0.17, 0.12]);
      ctx.lineWidth = 0.08;
      ctx.strokeStyle = cap ? '#ef4444' : col;
      ctx.beginPath();
      ctx.arc(0, 0, 0.47 + 0.05 * pulse, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      if (cap) {
        ctx.lineWidth = 0.07;
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
          const a = (i * Math.PI) / 2;
          ctx.moveTo(Math.cos(a) * 0.38, Math.sin(a) * 0.38);
          ctx.lineTo(Math.cos(a) * 0.62, Math.sin(a) * 0.62);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  private sprite(color: string) {
    const r = TOKEN_R * this.scale * this.dpr;
    const shape = this.theme.tokenShape ?? 'circle';
    const key = color + '|' + shape + '|' + Math.round(r * 4);
    let sp = this.sprites.get(key);
    if (sp) return sp;
    const neon = this.theme.style === 'neon';
    const pad = Math.ceil(r * (neon ? 0.9 : shape === 'circle' || shape === 'flat' ? 0.4 : 0.6)) + 2;
    const size = Math.ceil(r * 2 + pad * 2);
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const x = c.getContext('2d')!;
    const cx = size / 2;
    const cy = size / 2;
    if (neon) {
      x.shadowColor = color;
      x.shadowBlur = r * 0.9;
    }
    const path = (px: number, py: number, pr: number) => {
      x.beginPath();
      if (shape === 'hexagon') {
        for (let i = 0; i < 6; i++) {
          const a = (TAU * i) / 6 - TAU / 4;
          i ? x.lineTo(px + Math.cos(a) * pr * 1.08, py + Math.sin(a) * pr * 1.08) : x.moveTo(px + Math.cos(a) * pr * 1.08, py + Math.sin(a) * pr * 1.08);
        }
        x.closePath();
      } else if (shape === 'star') {
        for (let i = 0; i < 10; i++) {
          const a = (TAU * i) / 10 - TAU / 4;
          const rr = pr * (i % 2 ? 0.55 : 1.2);
          i ? x.lineTo(px + Math.cos(a) * rr, py + Math.sin(a) * rr) : x.moveTo(px + Math.cos(a) * rr, py + Math.sin(a) * rr);
        }
        x.closePath();
      } else if (shape === 'heart') {
        x.moveTo(px, py + pr * 0.95);
        x.bezierCurveTo(px - pr * 1.5, py, px - pr * 0.95, py - pr * 1.1, px, py - pr * 0.35);
        x.bezierCurveTo(px + pr * 0.95, py - pr * 1.1, px + pr * 1.5, py, px, py + pr * 0.95);
        x.closePath();
      } else {
        x.arc(px, py, pr, 0, TAU);
      }
    };
    const flat = shape === 'flat';
    if (!flat) {
      x.fillStyle = shade(color, -0.42);
      path(cx, cy + r * 0.15, r);
      x.fill();
    }
    x.shadowBlur = 0;
    if (flat) {
      x.fillStyle = color;
    } else {
      const gr = x.createRadialGradient(cx - r * 0.35, cy - r * 0.45, r * 0.1, cx, cy, r * 1.05);
      gr.addColorStop(0, shade(color, 0.5));
      gr.addColorStop(0.5, color);
      gr.addColorStop(1, shade(color, -0.22));
      x.fillStyle = gr;
    }
    path(cx, cy, r);
    x.fill();
    x.lineWidth = r * 0.13;
    x.strokeStyle = neon ? shade(color, 0.65) : 'rgba(255,255,255,0.95)';
    path(cx, cy, r * 0.9);
    x.stroke();
    if (!flat) {
      x.fillStyle = 'rgba(255,255,255,0.4)';
      x.beginPath();
      x.ellipse(cx - r * 0.28, cy - r * 0.52, r * 0.34, r * 0.15, -0.5, 0, TAU);
      x.fill();
    }
    sp = { c, half: size / 2 };
    this.sprites.set(key, sp);
    return sp;
  }

  private drawTokens(game: LudoGame) {
    const ctx = this.ctx;
    const clock = game.clock;
    const list: Token[] = [];
    for (const arr of game.tokens) for (const t of arr) list.push(t);
    list.sort((a, b) => (a.moving ? 1 : 0) - (b.moving ? 1 : 0) || a.vy - b.vy);
    const humanSelect = game.phase === 'select' && game.isHuman(game.current) && !game.paused;
    const pxR = TOKEN_R * this.scale;
    for (const t of list) {
      if (t.alpha <= 0) continue;
      const col = game.color(t.player);
      const movable = humanSelect && t.player === game.current && game.movable.includes(t.idx);
      const selected = movable && t.idx === game.selected;
      let z = t.z;
      if (movable) z += Math.abs(Math.sin(clock / 170 + t.idx * 0.9)) * (selected ? 0.3 : 0.18);
      const sc = t.scale;
      const dl = clock - t.landAt;
      let sx = 1;
      let sy = 1;
      if (dl >= 0 && dl < 280) {
        const q = dl / 280;
        const s = Math.sin(q * Math.PI * 2.2) * (1 - q) * 0.3;
        sx = 1 + s;
        sy = 1 - s;
      }
      if (z > 0.05) {
        sx *= 0.94;
        sy *= 1.07;
      }
      const r = TOKEN_R * sc;

      ctx.globalAlpha = t.alpha * Math.max(0.06, 0.26 - z * 0.035);
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(t.vx, t.vy + r * 0.62, Math.max(0.05, r * (0.95 - Math.min(z, 6) * 0.07)), r * 0.34, 0, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = t.alpha;

      if (movable) {
        const pulse = 0.5 + 0.5 * Math.sin(clock / 150 + t.idx);
        ctx.beginPath();
        ctx.arc(t.vx, t.vy + r * 0.12, r * (1.34 + 0.14 * pulse), 0, TAU);
        ctx.lineWidth = 0.12;
        ctx.strokeStyle = 'rgba(15,23,42,0.35)';
        ctx.stroke();
        ctx.lineWidth = 0.075;
        ctx.strokeStyle = selected ? '#fde047' : '#ffffff';
        ctx.stroke();
      }

      const sp = this.sprite(col);
      const hb = sp.half / (this.scale * this.dpr);
      ctx.save();
      ctx.translate(t.vx, t.vy - z - r * 0.08);
      if (t.rot) ctx.rotate(t.rot);
      ctx.scale(sc * sx, sc * sy);
      ctx.drawImage(sp.c, -hb, -hb, hb * 2, hb * 2);
      if (pxR * sc > 4.5) this.face(ctx, t, clock, pxR * sc);
      ctx.restore();

      if (selected) {
        const b = Math.abs(Math.sin(clock / 170)) * 0.18;
        const ay = t.vy - z - r * 1.25 - 0.28 - b;
        ctx.beginPath();
        ctx.moveTo(t.vx - 0.2, ay - 0.22);
        ctx.lineTo(t.vx + 0.2, ay - 0.22);
        ctx.lineTo(t.vx, ay);
        ctx.closePath();
        ctx.fillStyle = '#fde047';
        ctx.fill();
        ctx.lineWidth = 0.05;
        ctx.strokeStyle = 'rgba(15,23,42,0.6)';
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  private face(ctx: Ctx, t: Token, clock: number, pxR: number) {
    const r = TOKEN_R;
    const ink = '#1f2937';
    const ey = -r * 0.1;
    const ex = r * 0.34;
    const er = r * 0.21;
    ctx.lineCap = 'round';
    if (t.face === 'dizzy') {
      ctx.strokeStyle = ink;
      ctx.lineWidth = r * 0.11;
      ctx.beginPath();
      for (const s of [-1, 1]) {
        const cx = s * ex;
        ctx.moveTo(cx - er * 0.7, ey - er * 0.7);
        ctx.lineTo(cx + er * 0.7, ey + er * 0.7);
        ctx.moveTo(cx + er * 0.7, ey - er * 0.7);
        ctx.lineTo(cx - er * 0.7, ey + er * 0.7);
      }
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, r * 0.36, r * 0.11, 0, TAU);
      ctx.stroke();
      return;
    }
    const blink = clock >= t.blinkAt && clock < t.blinkAt + 130;
    if (pxR < 8) {
      if (!blink) {
        ctx.fillStyle = ink;
        ctx.beginPath();
        ctx.arc(-ex, ey, er * 0.62, 0, TAU);
        ctx.arc(ex, ey, er * 0.62, 0, TAU);
        ctx.fill();
      }
    } else if (t.face === 'happy' || blink) {
      ctx.strokeStyle = ink;
      ctx.lineWidth = r * 0.1;
      ctx.beginPath();
      for (const s of [-1, 1]) {
        if (t.face === 'happy') {
          ctx.moveTo(s * ex + er * 0.72 * Math.cos(Math.PI * 1.15), ey + er * 0.45 + er * 0.72 * Math.sin(Math.PI * 1.15));
          ctx.arc(s * ex, ey + er * 0.45, er * 0.72, Math.PI * 1.15, Math.PI * 1.85);
        } else {
          ctx.moveTo(s * ex - er * 0.7, ey);
          ctx.lineTo(s * ex + er * 0.7, ey);
        }
      }
      ctx.stroke();
    } else {
      const lx = t.moving ? t.lookX : Math.sin(clock / 1300 + t.idx * 2 + t.player) * 0.5;
      const ly = t.moving ? t.lookY : Math.cos(clock / 1700 + t.idx) * 0.3;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-ex, ey, er, 0, TAU);
      ctx.arc(ex, ey, er, 0, TAU);
      ctx.fill();
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.arc(-ex + lx * er * 0.38, ey + ly * er * 0.38, er * 0.58, 0, TAU);
      ctx.arc(ex + lx * er * 0.38, ey + ly * er * 0.38, er * 0.58, 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = ink;
    ctx.lineWidth = r * 0.09;
    ctx.beginPath();
    if (t.face === 'happy') {
      ctx.arc(0, r * 0.14, r * 0.25, 0.08 * Math.PI, 0.92 * Math.PI);
      ctx.closePath();
      ctx.fillStyle = ink;
      ctx.fill();
    } else {
      ctx.arc(0, r * 0.12, r * 0.24, 0.22 * Math.PI, 0.78 * Math.PI);
      ctx.stroke();
    }
  }

  private drawParticles(game: LudoGame) {
    const ctx = this.ctx;
    const dustCol = isLight(this.theme.boardBg) ? 'rgba(120,130,150,0.6)' : 'rgba(255,255,255,0.85)';
    for (const p of game.particles) {
      const q = p.life / p.max;
      const a = 1 - q;
      switch (p.kind) {
        case 0:
          ctx.globalAlpha = a;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (0.4 + 0.6 * a), 0, TAU);
          ctx.fill();
          break;
        case 1:
          ctx.globalAlpha = a;
          ctx.fillStyle = p.color;
          starPath(ctx, p.x, p.y, p.size * 1.3, p.size * 0.55, 5, p.rot);
          ctx.fill();
          break;
        case 2: {
          ctx.globalAlpha = Math.min(1, a * 3);
          const cs = Math.cos(p.rot);
          const sn = Math.sin(p.rot);
          const flip = Math.cos(p.rot * 1.7);
          ctx.save();
          ctx.transform(cs, sn, -sn * flip, cs * flip, p.x, p.y);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
          ctx.restore();
          break;
        }
        case 3: {
          ctx.globalAlpha = a;
          const rr = p.size * (0.2 + 0.8 * easeOut(q));
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 0.16 * a + 0.02;
          ctx.beginPath();
          ctx.arc(p.x, p.y, rr, 0, TAU);
          ctx.stroke();
          break;
        }
        case 4:
          ctx.globalAlpha = a * 0.75;
          ctx.fillStyle = dustCol;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (1 + q), 0, TAU);
          ctx.fill();
          break;
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawTexts(game: LudoGame, sh: Vec) {
    if (!game.texts.length) return;
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const t of game.texts) {
      const q = t.life / t.max;
      const pop = q < 0.18 ? easeOutBack(q / 0.18) : 1;
      const fs = Math.max(14, this.scale * 0.62) * t.size * Math.max(0.01, pop);
      const px = this.ox + (t.x + sh.x) * this.scale;
      const py = this.oy + (t.y + sh.y - easeOut(q) * 1.3) * this.scale;
      ctx.globalAlpha = q > 0.7 ? 1 - (q - 0.7) / 0.3 : 1;
      ctx.font = `700 ${fs.toFixed(1)}px ${FONT}`;
      ctx.lineWidth = Math.max(3, fs * 0.2);
      ctx.strokeStyle = 'rgba(15,23,42,0.8)';
      ctx.strokeText(t.text, px, py);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, px, py);
    }
    ctx.globalAlpha = 1;
  }
}
