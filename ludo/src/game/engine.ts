import { buildGeometry, homeSpot, type BoardGeom, type Vec } from './geometry';
import type { BannerMsg, GameOptions, Phase, PlayerSetup, Results, Snapshot, Speed } from './types';
import { audio } from '../audio/audio';
import { chooseBotMove } from './ai';

export const SPEED_MUL: Record<Speed, number> = { slow: 0.7, normal: 1, fast: 1.6, turbo: 2.6 };

export const ROLL_MS = 580;
const STEP_MS = 140;
const BOT_ROLL_DELAY = 420;
const BOT_THINK = 240;
const AUTO_MOVE_MS = 360;
const MAX_PARTICLES = 520;

export type Face = 'normal' | 'dizzy' | 'happy';

export interface Token {
  player: number;
  idx: number;
  pos: number; // -1 yard, 0..homeIndex
  vx: number;
  vy: number;
  z: number;
  rot: number;
  scale: number;
  alpha: number;
  rx: number;
  ry: number;
  rs: number;
  moving: boolean;
  face: Face;
  landAt: number;
  blinkAt: number;
  lookX: number;
  lookY: number;
}

export interface PlayerState {
  id: number;
  setup: PlayerSetup;
  arm: number;
  score: number;
  rank: number;
  captures: number;
  captured: number;
  sixes: number;
  rolls: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  kind: 0 | 1 | 2 | 3 | 4; // circle, star, confetti, ring, dust
  rot: number;
  vr: number;
  g: number;
  drag: number;
}

export interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  max: number;
  size: number;
}

interface Tween {
  t: number;
  dur: number;
  fn?: (k: number) => void;
  res: () => void;
}

interface BurstOpts {
  speed?: number;
  kind?: Particle['kind'];
  size?: number;
  life?: number;
  g?: number;
  colors?: string[];
}

export class LudoGame {
  readonly geom: BoardGeom;
  readonly N: number;
  readonly opts: GameOptions;
  readonly armOwner: number[];
  players: PlayerState[];
  tokens: Token[][];
  palette: string[];
  current = 0;
  phase: Phase = 'intro';
  dice = 6;
  rolling = false;
  rollId = 0;
  sixCount = 0;
  movable: number[] = [];
  selected = -1;
  clock = 0;
  paused = false;
  over = false;
  disposed = false;
  speedMul = 1;
  shakeEnabled = true;
  particles: Particle[] = [];
  texts: FloatText[] = [];
  results: Results | null = null;
  onChange?: () => void;
  onBanner?: (b: BannerMsg) => void;
  onGameOver?: (r: Results) => void;

  private shakeMag = 0;
  private shakeDur = 1;
  private shakeT = 0;
  private hitStop = 0;
  private finishCount = 0;
  private startedAt = 0;
  private tweens: Tween[] = [];
  private rollResolver: (() => void) | null = null;
  private selectResolver: ((ti: number) => void) | null = null;
  private selectGen = 0;
  private bannerId = 0;
  private lastTurn = -1;

  constructor(opts: GameOptions, palette: string[]) {
    this.opts = opts;
    this.palette = palette;
    const count = opts.players.length;
    this.N = count === 2 ? 4 : count;
    this.geom = buildGeometry(this.N);
    const arms = count === 2 ? [0, 2] : opts.players.map((_, i) => i);
    this.armOwner = new Array(this.N).fill(-1);
    this.players = opts.players.map((setup, i) => {
      this.armOwner[arms[i]] = i;
      return { id: i, setup, arm: arms[i], score: 0, rank: 0, captures: 0, captured: 0, sixes: 0, rolls: 0 };
    });
    this.tokens = this.players.map((p, pi) =>
      Array.from({ length: opts.tokens }, (_, idx) => {
        const spot = this.geom.yardSpots[p.arm][idx];
        return {
          player: pi,
          idx,
          pos: -1,
          vx: spot.x,
          vy: spot.y,
          z: 0,
          rot: 0,
          scale: 1,
          alpha: 1,
          rx: spot.x,
          ry: spot.y,
          rs: 1,
          moving: false,
          face: 'normal' as Face,
          landAt: -1e9,
          blinkAt: 1500 + Math.random() * 4000,
          lookX: 0,
          lookY: 0,
        };
      }),
    );
    this.speedMul = SPEED_MUL[opts.speed];
  }

  // ---------------------------------------------------------------- helpers
  color(pi: number): string {
    return this.palette[this.players[pi].setup.color] ?? '#888888';
  }
  isHuman(pi: number) {
    return this.players[pi].setup.kind === 'human';
  }
  get humanCount() {
    return this.players.filter((p) => p.setup.kind === 'human').length;
  }
  globalCell(pi: number, pos: number) {
    return (this.geom.startCell[this.players[pi].arm] + pos) % this.geom.T;
  }
  cellPos(pi: number, pos: number, idx = 0): Vec {
    const g = this.geom;
    const arm = this.players[pi].arm;
    if (pos < 0) return g.yardSpots[arm][idx];
    if (pos <= g.lastTrack) return g.track[this.globalCell(pi, pos)];
    if (pos < g.homeIndex) return g.homeCol[arm][pos - g.lastTrack - 1];
    return homeSpot(g, arm, idx, this.opts.tokens);
  }
  canMove(pi: number, ti: number, d: number) {
    const t = this.tokens[pi][ti];
    if (t.pos === this.geom.homeIndex) return false;
    if (t.pos < 0) return d === 6;
    return t.pos + d <= this.geom.homeIndex;
  }
  getMovable(pi: number, d: number) {
    return this.tokens[pi].filter((t) => this.canMove(pi, t.idx, d)).map((t) => t.idx);
  }
  tokensOnCell(cell: number): Token[] {
    const out: Token[] = [];
    const g = this.geom;
    for (const list of this.tokens)
      for (const t of list) if (t.pos >= 0 && t.pos <= g.lastTrack && this.globalCell(t.player, t.pos) === cell) out.push(t);
    return out;
  }
  homeCount(pi: number) {
    return this.tokens[pi].filter((t) => t.pos === this.geom.homeIndex).length;
  }
  progress(pi: number) {
    const total = this.opts.tokens * (this.geom.homeIndex + 1);
    return this.tokens[pi].reduce((a, t) => a + (t.pos + 1), 0) / total;
  }
  /** Would moving token ti by d capture an opponent? */
  wouldCapture(pi: number, ti: number, d: number) {
    const t = this.tokens[pi][ti];
    const to = t.pos < 0 ? 0 : t.pos + d;
    if (to > this.geom.lastTrack) return false;
    const cell = this.globalCell(pi, to);
    if (this.geom.safe[cell]) return false;
    return this.tokensOnCell(cell).some((o) => o.player !== pi);
  }

  // ---------------------------------------------------------------- timing
  tween(dur: number, fn?: (k: number) => void): Promise<void> {
    return new Promise((res) => {
      this.tweens.push({ t: 0, dur: Math.max(1, dur), fn, res });
    });
  }
  wait(ms: number) {
    return this.tween(ms);
  }

  update(dtMs: number) {
    if (this.disposed || this.paused) return;
    const dt = Math.min(dtMs, 50);
    this.clock += dt;
    let gdt = dt * this.speedMul;
    if (this.hitStop > 0) {
      this.hitStop -= dt;
      gdt *= 0.06;
    }
    if (this.tweens.length) {
      const list = this.tweens;
      this.tweens = [];
      for (const tw of list) {
        tw.t += gdt;
        const k = Math.min(1, tw.t / tw.dur);
        tw.fn?.(k);
        if (k >= 1) tw.res();
        else this.tweens.push(tw);
      }
    }
    this.computeRest();
    const f = 1 - Math.exp(-dt / 65);
    for (const list of this.tokens)
      for (const t of list) {
        if (!t.moving) {
          t.vx += (t.rx - t.vx) * f;
          t.vy += (t.ry - t.vy) * f;
        }
        t.scale += (t.rs - t.scale) * f;
        if (this.clock > t.blinkAt + 140) t.blinkAt = this.clock + 1800 + Math.random() * 4200;
      }
    const s = dt / 1000;
    const ps = this.particles;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life += dt;
      if (p.life >= p.max) {
        ps[i] = ps[ps.length - 1];
        ps.pop();
        continue;
      }
      p.vy += p.g * s;
      const dr = Math.max(0, 1 - p.drag * s);
      p.vx *= dr;
      p.vy *= dr;
      p.x += p.vx * s;
      p.y += p.vy * s;
      p.rot += p.vr * s;
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life += dt;
      if (t.life >= t.max) this.texts.splice(i, 1);
    }
    if (this.shakeT > 0) this.shakeT -= dt;
    if (this.flashT > 0) this.flashT -= dt;
  }

  private computeRest() {
    const g = this.geom;
    const groups = new Map<number, Token[]>();
    for (const list of this.tokens)
      for (const t of list) {
        if (t.pos < 0 || t.pos === g.homeIndex) {
          const p = this.cellPos(t.player, t.pos, t.idx);
          t.rx = p.x;
          t.ry = p.y;
          t.rs = t.pos < 0 ? 1 : 0.62;
          continue;
        }
        if (t.moving) {
          t.rs = 1;
          continue;
        }
        const key = t.pos <= g.lastTrack ? this.globalCell(t.player, t.pos) : 10000 + t.player * 100 + t.pos;
        const arr = groups.get(key);
        if (arr) arr.push(t);
        else groups.set(key, [t]);
      }
    groups.forEach((arr) => {
      const base = this.cellPos(arr[0].player, arr[0].pos, arr[0].idx);
      const n = arr.length;
      if (n === 1) {
        arr[0].rx = base.x;
        arr[0].ry = base.y;
        arr[0].rs = 1;
        return;
      }
      const sc = n === 2 ? 0.78 : n <= 4 ? 0.66 : 0.56;
      const rad = n === 2 ? 0.19 : 0.25;
      arr.forEach((t, i) => {
        const ang = -Math.PI / 2 + (i * Math.PI * 2) / n + (n === 2 ? Math.PI / 4 : 0);
        t.rx = base.x + Math.cos(ang) * rad;
        t.ry = base.y + Math.sin(ang) * rad;
        t.rs = sc;
      });
    });
  }

  // ---------------------------------------------------------------- fx
  flashT = 0;
  flashMax = 1;
  flashColor = '#ffffff';
  flash(color: string, ms = 260) {
    this.flashT = ms;
    this.flashMax = ms;
    this.flashColor = color;
  }
  shake(mag: number, dur: number) {
    if (!this.shakeEnabled) return;
    const curr = this.shakeT > 0 ? this.shakeMag * (this.shakeT / this.shakeDur) : 0;
    if (mag >= curr) {
      this.shakeMag = mag;
      this.shakeDur = dur;
      this.shakeT = dur;
    }
  }
  shakeOffset(): Vec {
    if (this.shakeT <= 0 || !this.shakeEnabled || this.paused) return { x: 0, y: 0 };
    const k = this.shakeT / this.shakeDur;
    const m = this.shakeMag * k * k;
    return { x: (Math.random() * 2 - 1) * m, y: (Math.random() * 2 - 1) * m };
  }
  burst(x: number, y: number, color: string, n: number, o: BurstOpts = {}) {
    const speed = o.speed ?? 5;
    for (let i = 0; i < n && this.particles.length < MAX_PARTICLES; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.35 + Math.random() * 0.65);
      const kind = o.kind ?? 0;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - (kind === 2 ? speed * 0.4 : 0),
        life: 0,
        max: (o.life ?? 750) * (0.6 + Math.random() * 0.6),
        size: (o.size ?? 0.16) * (0.6 + Math.random() * 0.8),
        color: o.colors ? o.colors[(Math.random() * o.colors.length) | 0] : color,
        kind,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() * 2 - 1) * 8,
        g: o.g ?? (kind === 2 ? 9 : 2),
        drag: kind === 2 ? 1.6 : 2.6,
      });
    }
  }
  ring(x: number, y: number, color: string, size = 1.3) {
    if (this.particles.length >= MAX_PARTICLES) return;
    this.particles.push({ x, y, vx: 0, vy: 0, life: 0, max: 520, size, color, kind: 3, rot: 0, vr: 0, g: 0, drag: 0 });
  }
  dust(x: number, y: number, amt = 1) {
    const n = Math.round(4 * amt);
    for (let i = 0; i < n && this.particles.length < MAX_PARTICLES; i++) {
      const a = Math.random() * Math.PI * 2;
      this.particles.push({
        x: x + Math.cos(a) * 0.2,
        y: y + 0.22,
        vx: Math.cos(a) * 1.4,
        vy: -0.4 - Math.random() * 0.6,
        life: 0,
        max: 380 + Math.random() * 200,
        size: 0.08 + Math.random() * 0.07,
        color: 'rgba(255,255,255,0.9)',
        kind: 4,
        rot: 0,
        vr: 0,
        g: 0,
        drag: 3,
      });
    }
  }
  sparkle(x: number, y: number, color: string) {
    this.burst(x, y - 0.2, color, 8, { kind: 1, speed: 2.6, size: 0.14, life: 600, g: -1 });
  }
  confetti(n: number, colors?: string[]) {
    const g = this.geom;
    const cols = colors ?? this.players.map((_, i) => this.color(i)).concat(['#ffffff', '#fde047']);
    const w = g.bounds.maxX - g.bounds.minX;
    for (let i = 0; i < n && this.particles.length < MAX_PARTICLES; i++) {
      this.particles.push({
        x: g.bounds.minX + Math.random() * w,
        y: g.bounds.minY - 1 - Math.random() * 6,
        vx: (Math.random() * 2 - 1) * 1.5,
        vy: 2 + Math.random() * 3,
        life: 0,
        max: 2600 + Math.random() * 1600,
        size: 0.2 + Math.random() * 0.18,
        color: cols[(Math.random() * cols.length) | 0],
        kind: 2,
        rot: Math.random() * 6,
        vr: (Math.random() * 2 - 1) * 10,
        g: 2.5,
        drag: 0.6,
      });
    }
  }
  floatText(x: number, y: number, text: string, color: string, size = 1) {
    this.texts.push({ x, y, text, color, life: 0, max: 1150, size });
  }

  // ---------------------------------------------------------------- input API
  requestRoll(): boolean {
    if (this.paused || this.phase !== 'roll' || !this.rollResolver || !this.isHuman(this.current)) return false;
    const r = this.rollResolver;
    this.rollResolver = null;
    r();
    return true;
  }
  chooseToken(ti: number): boolean {
    if (this.paused || this.phase !== 'select' || !this.selectResolver || !this.isHuman(this.current)) return false;
    if (!this.movable.includes(ti)) {
      audio.play('error');
      return false;
    }
    audio.play('select');
    this.selectResolver(ti);
    return true;
  }
  cycle(dir: number) {
    if (this.paused || this.phase !== 'select' || !this.isHuman(this.current) || !this.movable.length) return;
    const i = this.movable.indexOf(this.selected);
    const n = this.movable.length;
    this.selected = i < 0 ? this.movable[0] : this.movable[(i + dir + n) % n];
    audio.play('select');
    this.emit();
  }
  confirm(): boolean {
    if (this.phase === 'roll') return this.requestRoll();
    if (this.phase === 'select') return this.chooseToken(this.selected >= 0 ? this.selected : this.movable[0]);
    return false;
  }
  selectNumber(n: number) {
    if (this.phase !== 'select' || !this.isHuman(this.current)) return;
    this.chooseToken(n - 1);
  }
  tokenNear(bx: number, by: number, maxDist: number): number {
    if (this.phase !== 'select') return -1;
    const pi = this.current;
    let best = -1;
    let bd = maxDist;
    for (const ti of this.movable) {
      const t = this.tokens[pi][ti];
      const d = Math.hypot(t.vx - bx, t.vy - by);
      if (d < bd) {
        bd = d;
        best = ti;
      }
    }
    if (best < 0) {
      // tap anywhere inside own yard picks a yard token
      const arm = this.players[pi].arm;
      const c = this.geom.yardCenter[arm];
      if (Math.hypot(c.x - bx, c.y - by) < 2.6) {
        const yt = this.movable.find((ti) => this.tokens[pi][ti].pos < 0);
        if (yt !== undefined) best = yt;
      }
    }
    return best;
  }
  /** pointer tap on the board (board coordinates) */
  tapAt(bx: number, by: number): boolean {
    if (this.paused || !this.isHuman(this.current)) return false;
    if (this.phase === 'roll') return this.requestRoll();
    if (this.phase === 'select') {
      const ti = this.tokenNear(bx, by, 1.5);
      if (ti >= 0) return this.chooseToken(ti);
    }
    return false;
  }
  hoverAt(bx: number, by: number): boolean {
    if (this.paused || this.phase !== 'select' || !this.isHuman(this.current)) return false;
    const ti = this.tokenNear(bx, by, 0.85);
    if (ti >= 0 && ti !== this.selected) {
      this.selected = ti;
      this.emit();
    }
    return ti >= 0;
  }
  setPaused(p: boolean) {
    this.paused = p;
  }
  dispose() {
    this.disposed = true;
    this.tweens = [];
    this.rollResolver = null;
    this.selectResolver = null;
  }

  // ---------------------------------------------------------------- flow
  async start() {
    this.startedAt = Date.now();
    this.phase = 'intro';
    this.emit();
    const all = this.tokens.flat();
    for (const t of all) {
      t.z = 14;
      t.alpha = 0;
    }
    const stagger = Math.min(30, 640 / all.length);
    await Promise.all(all.map((t, i) => this.dropIn(t, 80 + i * stagger)));
    if (this.disposed) return;
    await this.wait(120);
    this.loop();
  }

  private async dropIn(t: Token, delay: number) {
    await this.wait(delay);
    t.alpha = 1;
    await this.tween(330, (k) => {
      t.z = 14 * (1 - k * k);
    });
    t.z = 0;
    t.landAt = this.clock;
    if (t.idx % 2 === 0) audio.play('pop', { pitch: t.player + t.idx });
    this.dust(t.vx, t.vy, 0.8);
  }

  private async loop() {
    while (!this.over && !this.disposed) {
      await this.turn();
    }
  }

  private async turn() {
    const pi = this.current;
    const p = this.players[pi];
    if (p.rank) {
      this.advance();
      await this.wait(10);
      return;
    }
    this.phase = 'roll';
    this.movable = [];
    this.selected = -1;
    if (this.isHuman(pi)) {
      const waitRoll = new Promise<void>((res) => {
        this.rollResolver = res;
      });
      this.emit();
      audio.play('turn');
      if (this.humanCount > 1 && this.lastTurn !== pi) {
        this.banner(`${p.setup.avatar} ${p.setup.name}'s turn!`, 'Tap the dice to roll', pi);
      }
      this.lastTurn = pi;
      await waitRoll;
    } else {
      this.emit();
      await this.wait(BOT_ROLL_DELAY);
    }
    if (this.disposed || this.over) return;

    const value = this.rollValue(pi);
    this.phase = 'rolling';
    this.rolling = true;
    this.dice = value;
    this.rollId++;
    this.emit();
    audio.play('roll');
    await this.wait(ROLL_MS);
    if (this.disposed) return;
    this.rolling = false;
    audio.play('land');
    if (value === 6) {
      this.sixCount++;
      p.sixes++;
      audio.play('six');
    }
    this.emit();

    if (value === 6 && this.sixCount >= 3) {
      this.banner('😵 Three 6s!', 'Turn skipped', pi);
      audio.play('buzz');
      this.shake(0.25, 300);
      await this.wait(950);
      this.sixCount = 0;
      this.advance();
      return;
    }

    const movable = this.getMovable(pi, value);
    let extra = value === 6;
    if (movable.length === 0) {
      if (this.isHuman(pi)) this.banner('😅 No moves', value === 6 ? 'Roll again!' : 'Better luck next roll!', pi);
      audio.play('nomove');
      await this.wait(this.isHuman(pi) ? 760 : 520);
    } else {
      if (value === 6 && this.isHuman(pi)) this.banner('🎉 SIX!', 'Bonus roll after this move', pi);
      let choice: number;
      if (this.isHuman(pi)) {
        choice = await this.humanChoice(pi, movable, value);
      } else {
        this.phase = 'select';
        this.movable = movable;
        this.selected = -1;
        this.emit();
        await this.wait(BOT_THINK);
        if (this.disposed) return;
        choice = chooseBotMove(this, pi, value, movable);
        this.selected = choice;
        this.emit();
        await this.wait(150);
      }
      if (this.disposed) return;
      this.phase = 'moving';
      this.movable = [];
      this.selected = -1;
      this.emit();
      const r = await this.moveToken(pi, choice, value);
      if (this.disposed) return;
      if (r.captured || r.home) extra = true;
      if (r.finished) {
        this.finishPlayer(pi);
        if (this.over) return;
        extra = false;
      }
    }
    if (this.over || this.disposed) return;
    if (extra) {
      if (value !== 6) this.sixCount = 0;
    } else {
      this.advance();
    }
  }

  private humanChoice(pi: number, movable: number[], value: number): Promise<number> {
    this.phase = 'select';
    this.movable = movable;
    this.selected = chooseBotMove(this, pi, value, movable, 'normal');
    const gen = ++this.selectGen;
    const promise = new Promise<number>((res) => {
      this.selectResolver = (ti: number) => {
        if (gen !== this.selectGen) return;
        this.selectGen++;
        this.selectResolver = null;
        res(ti);
      };
    });
    this.emit();
    const unique = new Set(movable.map((ti) => this.tokens[pi][ti].pos));
    if (this.opts.autoMove && unique.size === 1) {
      this.wait(AUTO_MOVE_MS).then(() => {
        if (gen === this.selectGen && this.selectResolver) this.selectResolver(movable[0]);
      });
    }
    return promise;
  }

  private rollValue(pi: number): number {
    const p = this.players[pi];
    const ts = this.tokens[pi];
    const first = p.rolls === 0;
    p.rolls++;
    if (this.opts.easyStart && first) return 6; // instant action on the very first roll
    const stuck = ts.some((t) => t.pos < 0) && ts.every((t) => t.pos < 0 || t.pos === this.geom.homeIndex);
    if (this.opts.easyStart && stuck && Math.random() < 0.28) return 6;
    return 1 + Math.floor(Math.random() * 6);
  }

  private advance() {
    const n = this.players.length;
    for (let i = 1; i <= n; i++) {
      const ni = (this.current + i) % n;
      if (!this.players[ni].rank) {
        this.current = ni;
        break;
      }
    }
    this.sixCount = 0;
    this.emit();
  }

  private async hop(t: Token, from: Vec, to: Vec, dur: number, h: number, dustAmt: number) {
    t.moving = true;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const l = Math.hypot(dx, dy) || 1;
    t.lookX = dx / l;
    t.lookY = dy / l;
    await this.tween(dur, (k) => {
      t.vx = from.x + dx * k;
      t.vy = from.y + dy * k;
      t.z = Math.sin(Math.PI * k) * h;
    });
    t.vx = to.x;
    t.vy = to.y;
    t.z = 0;
    t.landAt = this.clock;
    if (dustAmt > 0) this.dust(to.x, to.y, dustAmt);
  }

  private async moveToken(pi: number, ti: number, d: number) {
    const g = this.geom;
    const t = this.tokens[pi][ti];
    const col = this.color(pi);
    const res = { captured: 0, home: false, finished: false };
    t.moving = true;
    if (t.pos < 0) {
      const from = { x: t.vx, y: t.vy };
      const to = this.cellPos(pi, 0);
      t.pos = 0;
      audio.play('out');
      await this.hop(t, from, to, 380, 1.9, 1.2);
      if (this.disposed) return res;
      this.burst(to.x, to.y, col, 16, { kind: 1, speed: 5 });
      this.ring(to.x, to.y, col);
      this.addScore(pi, 10, to, '+10');
    } else {
      let from: Vec = { x: t.vx, y: t.vy };
      for (let s = 1; s <= d; s++) {
        const to = this.cellPos(pi, t.pos + 1, ti);
        t.pos++;
        audio.play('step', { i: s });
        await this.hop(t, from, to, STEP_MS, 0.62, s === d ? 1 : 0.45);
        if (this.disposed) return res;
        from = to;
      }
      this.addScore(pi, d, { x: t.vx, y: t.vy }, `+${d}`);
    }

    if (t.pos === g.homeIndex) {
      res.home = true;
      t.face = 'happy';
      audio.play('home');
      this.burst(t.vx, t.vy, col, 26, { kind: 1, speed: 6 });
      this.burst(0, 0, col, 24, { kind: 2, speed: 7, colors: [col, '#ffffff', '#fde047'] });
      this.ring(t.vx, t.vy, col, 1.8);
      this.shake(0.14, 220);
      this.flash('#fde047', 220);
      this.addScore(pi, 50, { x: t.vx, y: t.vy - 1.0 }, '+50 🏠');
      if (this.tokens[pi].every((x) => x.pos === g.homeIndex)) res.finished = true;
      else this.banner('🏠 Home!', 'Bonus roll!', pi);
    } else if (t.pos <= g.lastTrack) {
      const cell = this.globalCell(pi, t.pos);
      if (g.safe[cell]) {
        audio.play('safe');
        this.sparkle(t.vx, t.vy, col);
      } else {
        const victims = this.tokensOnCell(cell).filter((o) => o.player !== pi);
        if (victims.length) {
          res.captured = victims.length;
          this.players[pi].captures += victims.length;
          this.hitStop = 110;
          this.shake(0.55, 460);
          audio.play('capture');
          const vc = this.color(victims[0].player);
          this.flash(vc, 280);
          this.burst(t.vx, t.vy, vc, 34, { kind: 0, speed: 9, size: 0.18 });
          this.burst(t.vx, t.vy, col, 14, { kind: 1, speed: 6 });
          this.ring(t.vx, t.vy, vc, 2.2);
          const pts = 25 * victims.length;
          this.addScore(pi, pts, { x: t.vx, y: t.vy - 1.0 }, `+${pts} 💥`);
          const vp = this.players[victims[0].player].setup;
          this.banner('💥 Gotcha!', `${this.players[pi].setup.avatar} sent ${vp.avatar} ${vp.name} home!`, pi);
          t.landAt = this.clock;
          await Promise.all(victims.map((v) => this.sendHome(v)));
        }
      }
    }
    t.moving = false;
    return res;
  }

  private async sendHome(v: Token) {
    const from = { x: v.vx, y: v.vy };
    v.pos = -1;
    v.moving = true;
    v.face = 'dizzy';
    this.players[v.player].captured++;
    const to = this.cellPos(v.player, -1, v.idx);
    audio.play('whoosh');
    await this.tween(720, (k) => {
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      v.vx = from.x + (to.x - from.x) * e;
      v.vy = from.y + (to.y - from.y) * e;
      v.z = Math.sin(Math.PI * k) * 4;
      v.rot = k * Math.PI * 4;
    });
    v.vx = to.x;
    v.vy = to.y;
    v.z = 0;
    v.rot = 0;
    v.landAt = this.clock;
    v.moving = false;
    this.dust(to.x, to.y, 1);
    this.wait(900).then(() => {
      if (v.face === 'dizzy') v.face = 'normal';
    });
  }

  private addScore(pi: number, pts: number, at: Vec, label: string) {
    this.players[pi].score += pts;
    this.floatText(at.x, at.y - 0.35, label, this.color(pi), pts >= 25 ? 1.25 : 1);
    this.emit();
  }

  private finishPlayer(pi: number) {
    const p = this.players[pi];
    this.finishCount++;
    p.rank = this.finishCount;
    const bonus = [0, 150, 80, 40, 20, 10, 5][p.rank] ?? 0;
    p.score += bonus;
    audio.play('finish');
    this.confetti(70, [this.color(pi), '#ffffff', '#fde047']);
    const medal = ['', '🥇', '🥈', '🥉'][p.rank] ?? '🏅';
    this.banner(`${medal} ${p.setup.name} finished!`, `+${bonus} bonus points`, pi, true);
    this.emit();
    const remaining = this.players.filter((x) => !x.rank);
    const humansLeft = remaining.filter((x) => x.setup.kind === 'human').length;
    if (this.opts.endMode === 'first' || remaining.length <= 1 || (this.humanCount > 0 && humansLeft === 0)) {
      this.endGame();
    } else {
      this.advance();
    }
  }

  private endGame() {
    this.over = true;
    this.phase = 'over';
    this.movable = [];
    this.selected = -1;
    const unfinished = this.players
      .filter((p) => !p.rank)
      .sort(
        (a, b) =>
          this.homeCount(b.id) - this.homeCount(a.id) || this.progress(b.id) - this.progress(a.id) || b.score - a.score,
      );
    for (const p of unfinished) p.rank = ++this.finishCount;
    const rows = this.players
      .map((p) => ({
        pi: p.id,
        name: p.setup.name,
        avatar: p.setup.avatar,
        color: p.setup.color,
        kind: p.setup.kind,
        score: p.score,
        rank: p.rank,
        home: this.homeCount(p.id),
        captures: p.captures,
      }))
      .sort((a, b) => a.rank - b.rank);
    const winner = rows[0].pi;
    this.results = { rows, winner, durationMs: Date.now() - this.startedAt };
    this.emit();
    const humanWon = this.isHuman(winner);
    const cheer = humanWon || this.humanCount !== 1;
    this.wait(500).then(() => audio.play(cheer ? 'win' : 'lose'));
    this.confetti(150);
    this.wait(1100).then(() => {
      if (this.results) this.onGameOver?.(this.results);
    });
  }

  private banner(text: string, sub?: string, pi?: number, big = false) {
    this.onBanner?.({ id: ++this.bannerId, text, sub, color: pi !== undefined ? this.players[pi].setup.color : undefined, big });
  }

  private emit() {
    this.onChange?.();
  }

  snapshot(): Snapshot {
    return {
      phase: this.phase,
      current: this.current,
      dice: this.dice,
      rolling: this.rolling,
      rollId: this.rollId,
      rollMs: ROLL_MS / this.speedMul,
      sixCount: this.sixCount,
      players: this.players.map((p, pi) => ({
        name: p.setup.name,
        avatar: p.setup.avatar,
        color: p.setup.color,
        kind: p.setup.kind,
        level: p.setup.level,
        score: p.score,
        rank: p.rank,
        home: this.homeCount(pi),
        out: this.tokens[pi].filter((t) => t.pos >= 0 && t.pos < this.geom.homeIndex).length,
        tokens: this.opts.tokens,
        progress: this.progress(pi),
        captures: p.captures,
      })),
      humanTurn: !this.over && this.isHuman(this.current),
      canRoll: this.phase === 'roll' && this.isHuman(this.current) && !this.over,
      canSelect: this.phase === 'select' && this.isHuman(this.current),
      movableCount: this.movable.length,
      over: this.over,
    };
  }
}
