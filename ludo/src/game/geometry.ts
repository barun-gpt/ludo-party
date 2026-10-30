export interface Vec {
  x: number;
  y: number;
}

export interface Arm {
  angle: number;
  d: Vec; // outward direction
  p: Vec; // perpendicular, pointing towards the next (clockwise) arm
}

export type CellKind = 'normal' | 'start' | 'star' | 'cap';

export interface BoardGeom {
  N: number;
  T: number; // main track length (13 * N)
  lastTrack: number; // last progress index on main track (13N - 2)
  homeIndex: number; // progress index of the finished state (13N + 4)
  apothem: number;
  arms: Arm[];
  track: Vec[];
  trackAngle: number[];
  trackArm: number[];
  trackKind: CellKind[];
  safe: boolean[];
  startCell: number[]; // per arm, global track index
  homeCol: Vec[][]; // per arm, 5 cells in travel order
  yardPoly: Vec[][];
  yardInset: Vec[][];
  yardCenter: Vec[];
  yardSpots: Vec[][];
  centerPoly: Vec[];
  homeTri: Vec[][];
  outline: Vec[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

export const TOKEN_R = 0.38;
const ARM_LEN = 6;

const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
const mul = (a: Vec, s: number): Vec => ({ x: a.x * s, y: a.y * s });
const len = (a: Vec) => Math.hypot(a.x, a.y);
const norm = (a: Vec): Vec => {
  const l = len(a) || 1;
  return { x: a.x / l, y: a.y / l };
};

const cache = new Map<number, BoardGeom>();

export function buildGeometry(N: number): BoardGeom {
  const hit = cache.get(N);
  if (hit) return hit;

  const a = 1.5 / Math.tan(Math.PI / N);
  const arms: Arm[] = [];
  for (let k = 0; k < N; k++) {
    // arm 0 points down; angles grow clockwise on screen (y axis points down)
    const angle = Math.PI / 2 + (k * 2 * Math.PI) / N;
    arms.push({
      angle,
      d: { x: Math.cos(angle), y: Math.sin(angle) },
      p: { x: -Math.sin(angle), y: Math.cos(angle) },
    });
  }

  const cell = (k: number, u: number, v: number): Vec => {
    const { d, p } = arms[k];
    const r = a + 0.5 + v;
    return { x: d.x * r + p.x * u, y: d.y * r + p.y * u };
  };

  const T = 13 * N;
  const track: Vec[] = [];
  const trackAngle: number[] = [];
  const trackArm: number[] = [];
  const trackKind: CellKind[] = [];
  for (let k = 0; k < N; k++) {
    for (let i = 0; i < 13; i++) {
      let u: number;
      let v: number;
      if (i <= 5) {
        u = -1;
        v = i;
      } else if (i === 6) {
        u = 0;
        v = 5;
      } else {
        u = 1;
        v = 12 - i;
      }
      track.push(cell(k, u, v));
      trackAngle.push(arms[k].angle);
      trackArm.push(k);
      trackKind.push(i === 8 ? 'start' : i === 3 ? 'star' : i === 6 ? 'cap' : 'normal');
    }
  }
  const safe = trackKind.map((kind) => kind === 'start' || kind === 'star');
  const startCell = arms.map((_, k) => 13 * k + 8);
  const homeCol = arms.map((_, k) => [0, 1, 2, 3, 4].map((j) => cell(k, 0, 4 - j)));

  // polygon vertices: V[k] sits between arm k and arm k+1
  const V = arms.map(({ d, p }) => ({ x: d.x * a + p.x * 1.5, y: d.y * a + p.y * 1.5 }));

  const yardPoly: Vec[][] = [];
  const yardInset: Vec[][] = [];
  const yardCenter: Vec[] = [];
  const yardSpots: Vec[][] = [];
  const farPts: (Vec | null)[] = [];

  for (let k = 0; k < N; k++) {
    const k2 = (k + 1) % N;
    const vk = V[k];
    const A = add(vk, mul(arms[k].d, ARM_LEN));
    const B = add(vk, mul(arms[k2].d, ARM_LEN));
    let poly: Vec[];
    let center: Vec;
    let inset: number;
    if (N <= 4) {
      const F = sub(add(A, B), vk);
      poly = [vk, A, F, B];
      center = mul(add(vk, F), 0.5);
      farPts.push(F);
      inset = N === 4 ? 0.62 : 0.66;
    } else {
      poly = [vk, A, B];
      const base = len(sub(A, B));
      center = mul(add(add(mul(vk, base), mul(A, ARM_LEN)), mul(B, ARM_LEN)), 1 / (base + 2 * ARM_LEN));
      farPts.push(null);
      inset = 0.78;
    }
    yardPoly.push(poly);
    yardCenter.push(center);
    yardInset.push(poly.map((pt) => add(center, mul(sub(pt, center), inset))));

    let e1: Vec;
    let e2: Vec;
    let R: number;
    if (N === 4) {
      e1 = arms[k].d;
      e2 = arms[k2].d;
      R = 1.05;
    } else {
      const b = norm(add(arms[k].d, arms[k2].d));
      e1 = b;
      e2 = { x: -b.y, y: b.x };
      R = N === 3 ? 0.85 : 0.55;
    }
    const spots: Vec[] = [];
    for (const [sx, sy] of [
      [-1, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
    ]) {
      spots.push(add(center, add(mul(e1, sx * R), mul(e2, sy * R))));
    }
    yardSpots.push(spots);
  }

  const homeTri: Vec[][] = arms.map((_, k) => [{ x: 0, y: 0 }, V[(k - 1 + N) % N], V[k]]);

  const outline: Vec[] = [];
  const corner = (k: number, u: number) => {
    const { d, p } = arms[k];
    const r = a + ARM_LEN;
    return { x: d.x * r + p.x * u, y: d.y * r + p.y * u };
  };
  for (let k = 0; k < N; k++) {
    outline.push(corner(k, -1.5));
    outline.push(corner(k, 1.5));
    const F = farPts[k];
    if (F) outline.push(F);
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const pt of outline) {
    minX = Math.min(minX, pt.x);
    minY = Math.min(minY, pt.y);
    maxX = Math.max(maxX, pt.x);
    maxY = Math.max(maxY, pt.y);
  }
  const m = 0.8;
  const geom: BoardGeom = {
    N,
    T,
    lastTrack: T - 2,
    homeIndex: T + 4,
    apothem: a,
    arms,
    track,
    trackAngle,
    trackArm,
    trackKind,
    safe,
    startCell,
    homeCol,
    yardPoly,
    yardInset,
    yardCenter,
    yardSpots,
    centerPoly: V,
    homeTri,
    outline,
    bounds: { minX: minX - m, minY: minY - m, maxX: maxX + m, maxY: maxY + m },
  };
  cache.set(N, geom);
  return geom;
}

/** Position for a finished token inside the home triangle of arm k. */
export function homeSpot(g: BoardGeom, k: number, j: number, count: number): Vec {
  const { d, p } = g.arms[k];
  const r = g.apothem * 0.6;
  const spacing = 0.44;
  const off = (j - (count - 1) / 2) * spacing;
  return { x: d.x * r + p.x * off, y: d.y * r + p.y * off };
}
