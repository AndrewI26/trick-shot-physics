// Pure physics simulation — no DOM, no React.
//
// Top-down view, like shuffleboard or mini golf: the ball slides/rolls across a
// flat course seen from above. There is no arc through the air — gravity only
// matters because it presses the ball into the ground, which is what creates
// friction (and, on tilted ground, pulls the ball sideways).
//
// World units are pixels: 1000 × 600 px, 50 px = 1 m (a 20 m × 12 m course).

export const PX_PER_M = 50;
export const WORLD_W = 1000;
export const WORLD_H = 600;
export const G_EARTH = 9.81 * PX_PER_M;
export const G_MOON = 1.62 * PX_PER_M;
export const BALL_R = 8;
export const DT = 1 / 240;

export interface Vec {
  x: number;
  y: number;
}
export const vec = (x: number, y: number): Vec => ({ x, y });
const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
const mul = (a: Vec, s: number): Vec => ({ x: a.x * s, y: a.y * s });
const dot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y;
export const len = (a: Vec) => Math.hypot(a.x, a.y);

// ─── Materials ───────────────────────────────────────────────────────────────

export interface Material {
  name: string;
  /** Friction coefficient: how strongly the ground resists the ball's motion. */
  friction: number;
  color: string;
  edge: string;
}

export type SurfaceId = 'ice' | 'concrete' | 'grass' | 'sand' | 'sandpaper' | 'mud';

export interface Surface extends Material {
  id: SurfaceId;
  frictionLabel: string;
  blurb: string;
  /** One-line physics takeaway shown after the hole. */
  takeaway: string;
}

/** Surfaces the player can pick for the green (the ground the hole sits on). */
export const SURFACES: Surface[] = [
  {
    id: 'ice',
    name: 'Ice',
    friction: 0.02,
    color: '#d6f1ff',
    edge: '#8fd0f2',
    frictionLabel: 'Very low',
    blurb: 'Super slippery. The ball barely slows down.',
    takeaway:
      'On ice the ball hardly slowed down. With almost no friction, almost none of its motion energy was turned into heat, so it kept gliding, just like Newton’s first law says.',
  },
  {
    id: 'concrete',
    name: 'Concrete',
    friction: 0.1,
    color: '#bdbdbd',
    edge: '#8a8a8a',
    frictionLabel: 'Low',
    blurb: 'Hard and smooth. Rolls a long way.',
    takeaway: 'Concrete is hard and smooth, so it grips the ball only lightly and the ball rolled a long way before stopping.',
  },
  {
    id: 'grass',
    name: 'Grass',
    friction: 0.25,
    color: '#7ccf52',
    edge: '#4c9a2e',
    frictionLabel: 'Medium',
    blurb: 'Classic putting green. A balanced choice.',
    takeaway: 'Grass is a middle ground: the blades bend and rub against the ball, slowing it steadily without stopping it dead.',
  },
  {
    id: 'sand',
    name: 'Sand',
    friction: 0.6,
    color: '#ecd394',
    edge: '#c9a85a',
    frictionLabel: 'High',
    blurb: 'Grabs the ball. It stops quickly.',
    takeaway:
      'Sand grains shift and rub against each other as the ball pushes through, turning its motion energy into heat. The speed graph dropped steeply.',
  },
  {
    id: 'sandpaper',
    name: 'Sandpaper',
    friction: 0.75,
    color: '#c08a52',
    edge: '#8d5f30',
    frictionLabel: 'Very high',
    blurb: 'Rough grit. Stops the ball fast.',
    takeaway:
      'Sandpaper is covered in tiny hard grains. They catch on the ball over and over, so it loses speed very quickly and stops in a short distance.',
  },
  {
    id: 'mud',
    name: 'Mud',
    friction: 1.0,
    color: '#7a5535',
    edge: '#553820',
    frictionLabel: 'Extreme',
    blurb: 'Sticky. The ball stops almost instantly.',
    takeaway:
      'Mud is soft and sticky: the ball sinks in slightly and has to keep pushing mud out of the way, so it stopped almost immediately. You needed a much harder shot.',
  },
];

export const surfaceById = (id: SurfaceId) => SURFACES.find((s) => s.id === id)!;

export type FixedId = 'fairway' | 'moonfelt';
export const FIXED: Record<FixedId, Material> = {
  fairway: { name: 'Fairway', friction: 0.2, color: '#4caf50', edge: '#388e3c' },
  moonfelt: { name: 'Moon turf', friction: 0.2, color: '#8b8fa3', edge: '#6d7186' },
};

/** 'green' = whatever surface the player has picked (can change mid-hole). */
export type MatRef = FixedId | SurfaceId | 'green';
export const resolveMat = (ref: MatRef, green: Surface): Material =>
  ref === 'green' ? green : ref in FIXED ? FIXED[ref as FixedId] : surfaceById(ref as SurfaceId);

// ─── Level geometry ──────────────────────────────────────────────────────────

export type Shape = { kind: 'rect'; x: number; y: number; w: number; h: number } | { kind: 'circle'; c: Vec; r: number };

export interface Zone {
  shape: Shape;
  /** Ground material, or water (a hazard: the shot is over). */
  mat: MatRef | 'water';
  /** Tilted ground: the sideways pull of gravity on the slope (px/s²). */
  slope?: Vec;
  /**
   * A funnel (circle zones only): the ground dips toward the centre, steeper the closer
   * you get. `strength` = pull at the rim (px/s²); `pit` = radius of the hole in the middle.
   */
  funnel?: { strength: number; pit: number };
  /** An air stream: air moving at velocity v (px/s). k = how strongly it drags the ball along (1/s). */
  air?: { v: Vec; k: number };
  label?: string;
}

export interface Wall {
  a: Vec;
  b: Vec;
}

export interface Bumper {
  c: Vec;
  r: number;
}

/** Rectangular traffic barrier (axis-aligned). x, y = top-left corner. */
export interface Barrier {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Barrier centred on (cx, cy). */
export const barrier = (cx: number, cy: number, w: number, h: number): Barrier => ({ x: cx - w / 2, y: cy - h / 2, w, h });

export interface PhysicsLevel {
  gravity: number; // how hard gravity presses the ball into the ground (px/s²)
  base: MatRef; // ground everywhere not covered by a zone
  tee: Vec;
  target: Vec;
  /** Playable area (drawn as the course). */
  course: { x: number; y: number; w: number; h: number };
  /** Rectangular traffic barriers the ball bounces off. */
  barriers?: Barrier[];
  /** Optional custom course outline (any polygon). If set, it's drawn instead of the rectangle. */
  shape?: Vec[];
  /** Fixed charges ("magnets") built into the level. */
  charges?: Charge[];
  /** How many charges the player may place (0/undefined = none). */
  maxCharges?: number;
  /** Moving target: slides smoothly back and forth between `target` and `to`. */
  targetMotion?: { to: Vec; period: number };
  zones: Zone[];
  walls: Wall[];
  bumpers: Bumper[];
}

// ─── Charges ("magnets") ─────────────────────────────────────────────────────

export interface Charge {
  p: Vec;
  /** +1 / −1 (bigger numbers = stronger). */
  q: number;
  fixed?: boolean;
}

/** Everything electric acting on the ball right now. */
export interface Field {
  ballQ: number;
  charges: Charge[];
}
export const NO_FIELD: Field = { ballQ: 0, charges: [] };

/** Strength of the push between charges. Bigger = stronger magnets. */
const K_ELECTRIC = 3.2e6;
/** Closer than this the push stops growing (keeps things from blowing up). */
const MIN_R = 28;

/**
 * Electric push on the ball (px/s²). Like charges repel, opposite charges attract,
 * and the push gets much weaker with distance (inverse-square, like gravity).
 */
export function electricAt(field: Field, p: Vec): Vec {
  if (!field.ballQ) return vec(0, 0);
  let a = vec(0, 0);
  for (const c of field.charges) {
    const d = sub(p, c.p);
    const r = Math.max(len(d), MIN_R);
    a = add(a, mul(d, (K_ELECTRIC * field.ballQ * c.q) / (r * r * r)));
  }
  return a;
}

const WALL_BOUNCE = 0.7;
const BUMPER_BOUNCE = 0.9;

const inShape = (p: Vec, s: Shape) =>
  s.kind === 'rect' ? p.x >= s.x && p.x <= s.x + s.w && p.y >= s.y && p.y <= s.y + s.h : len(sub(p, s.c)) <= s.r;

/** Which zone is the ball on? Later zones sit on top of earlier ones. */
export function zoneAt(level: PhysicsLevel, p: Vec): Zone | null {
  for (let i = level.zones.length - 1; i >= 0; i--) if (inShape(p, level.zones[i].shape)) return level.zones[i];
  return null;
}

export interface Ground {
  mat: Material;
  water: boolean;
  /** Ball reached the hole at the bottom of a funnel. */
  funnel: boolean;
  /** Steady push from tilted ground / funnels (px/s²). */
  slope: Vec;
  /** Air stream the ball is in, if any. */
  air: { v: Vec; k: number } | null;
}

export function groundAt(level: PhysicsLevel, green: Surface, p: Vec): Ground {
  // Slopes, funnels and air streams can overlap ordinary ground zones.
  let slope = vec(0, 0);
  let funnel = false;
  let air: Ground['air'] = null;
  for (const z of level.zones) {
    if (!inShape(p, z.shape)) continue;
    if (z.slope) slope = add(slope, z.slope);
    if (z.air) air = z.air;
    if (z.funnel && z.shape.kind === 'circle') {
      const d = sub(z.shape.c, p);
      const dist = len(d);
      if (dist < z.funnel.pit) funnel = true;
      else {
        // Steeper toward the middle: pull grows as the ball gets closer to the centre.
        const pull = (z.funnel.strength * z.shape.r) / Math.max(dist, 15);
        slope = add(slope, mul(d, pull / dist));
      }
    }
  }
  let z: Zone | null = null;
  for (let i = level.zones.length - 1; i >= 0; i--) {
    const zi = level.zones[i];
    if (!zi.slope && !zi.funnel && !zi.air && inShape(p, zi.shape)) {
      z = zi;
      break;
    }
  }
  if (z?.mat === 'water') return { mat: FIXED.fairway, water: true, funnel, slope, air };
  return { mat: resolveMat((z?.mat as MatRef) ?? level.base, green), water: false, funnel, slope, air };
}

// ─── Ball ────────────────────────────────────────────────────────────────────

export interface Ball {
  p: Vec;
  v: Vec;
  resting: boolean;
}

export const newBall = (p: Vec): Ball => ({ p: { ...p }, v: vec(0, 0), resting: true });

export interface StepInfo {
  /** Speed into a wall/bumper (px/s) if the ball hit one this step. */
  impact: number;
  /** Acceleration from friction + slope this step (px/s²). */
  accel: Vec;
  water: boolean;
  funnel: boolean;
  mat: Material;
}

function closestOnSegment(p: Vec, a: Vec, b: Vec): Vec {
  const ab = sub(b, a);
  const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / dot(ab, ab)));
  return add(a, mul(ab, t));
}

/**
 * One fixed time step.
 * Friction: a steady push opposite the direction of motion. Its strength is
 * (friction coefficient × gravity) — rougher ground or stronger gravity = more friction.
 */
export function step(level: PhysicsLevel, green: Surface, ball: Ball, dt = DT, field: Field = NO_FIELD): StepInfo {
  const ground = groundAt(level, green, ball.p);
  const frictionMax = ground.mat.friction * level.gravity;
  // Pushes that aren't friction: tilted ground/funnels + charges + air streams.
  // Air drags the ball toward the air's own velocity (no push if the ball moves with the air).
  const airPush = ground.air ? mul(sub(ground.air.v, ball.v), ground.air.k) : vec(0, 0);
  const push = add(add(ground.slope, electricAt(field, ball.p)), airPush);
  const slopeMag = len(push);

  if (ball.resting) {
    // A resting ball stays put unless the slope is steeper than friction can hold.
    if (slopeMag <= frictionMax) return { impact: 0, accel: vec(0, 0), water: ground.water, funnel: ground.funnel, mat: ground.mat };
    ball.resting = false;
  }

  const speed = len(ball.v);
  let a: Vec;
  if (speed > 1e-6) {
    a = add(push, mul(ball.v, -frictionMax / speed));
  } else {
    a = mul(push, 1 - frictionMax / Math.max(slopeMag, 1e-9));
  }

  const vOld = ball.v;
  ball.v = add(ball.v, mul(a, dt));
  // Friction can stop the ball, but never push it backwards.
  if (speed > 1e-6 && dot(ball.v, vOld) <= 0 && slopeMag <= frictionMax) {
    ball.v = vec(0, 0);
  }
  ball.p = add(ball.p, mul(ball.v, dt));

  // Collisions
  let impact = 0;
  const bounce = (q: Vec, e: number) => {
    const d = sub(ball.p, q);
    const dist = len(d);
    if (dist >= BALL_R || dist < 1e-9) return;
    const n = mul(d, 1 / dist);
    ball.p = add(ball.p, mul(n, BALL_R - dist));
    const vn = dot(ball.v, n);
    if (vn >= 0) return;
    impact = Math.max(impact, -vn);
    const vt = sub(ball.v, mul(n, vn));
    ball.v = add(mul(vt, 0.97), mul(n, -vn * e));
  };
  for (const w of level.walls) bounce(closestOnSegment(ball.p, w.a, w.b), WALL_BOUNCE);
  for (const r of level.barriers ?? []) {
    // Closest point on the rectangle to the ball's centre.
    const q = vec(Math.max(r.x, Math.min(ball.p.x, r.x + r.w)), Math.max(r.y, Math.min(ball.p.y, r.y + r.h)));
    if (q.x === ball.p.x && q.y === ball.p.y) {
      // Centre ended up inside (very fast hit): push out through the nearest side.
      const left = ball.p.x - r.x, right = r.x + r.w - ball.p.x, top = ball.p.y - r.y, bottom = r.y + r.h - ball.p.y;
      const m = Math.min(left, right, top, bottom);
      if (m === left) ball.p.x = r.x - BALL_R;
      else if (m === right) ball.p.x = r.x + r.w + BALL_R;
      else if (m === top) ball.p.y = r.y - BALL_R;
      else ball.p.y = r.y + r.h + BALL_R;
      continue;
    }
    bounce(q, BUMPER_BOUNCE);
  }
  for (const b of level.bumpers) {
    const d = sub(ball.p, b.c);
    const dist = len(d);
    if (dist < b.r + BALL_R && dist > 1e-9) bounce(add(b.c, mul(d, b.r / dist)), BUMPER_BOUNCE);
  }

  if (len(ball.v) < 1 && slopeMag <= frictionMax) {
    ball.v = vec(0, 0);
    ball.resting = true;
  }

  return { impact, accel: a, water: ground.water, funnel: ground.funnel, mat: ground.mat };
}

/** Every shot leaves at the same speed — the player only picks the direction. */
export function launch(ball: Ball, direction: Vec, speed: number) {
  const L = len(direction) || 1;
  ball.v = mul(direction, speed / L);
  ball.resting = false;
}

// ─── Curling-style target ────────────────────────────────────────────────────

export interface Ring {
  /** Radius in px. */
  r: number;
  points: number;
  name: string;
  color: string;
}

/** Innermost first. Like curling, the ball counts for a ring if any part of it touches that ring. */
export const TARGET_RINGS: Ring[] = [
  { r: 12, points: 100, name: 'Bullseye', color: '#ffffff' },
  { r: 30, points: 50, name: 'Red ring', color: '#d32f2f' },
  { r: 50, points: 25, name: 'White ring', color: '#f2f2f2' },
  { r: 72, points: 10, name: 'Blue ring', color: '#1e63c6' },
];

export interface ShotResult {
  points: number;
  ring: Ring | null;
  /** Distance from the bullseye, in metres. */
  distance: number;
  water: boolean;
  /** Which hazard ended the shot, if any. */
  hazard?: 'water' | 'funnel';
}

/** Where the target is at time t (seconds since the hole started). */
export function targetAt(level: PhysicsLevel, t: number): Vec {
  const m = level.targetMotion;
  if (!m) return level.target;
  const u = (1 - Math.cos((2 * Math.PI * t) / m.period)) / 2; // 0 → 1 → 0, easing at the ends
  return add(level.target, mul(sub(m.to, level.target), u));
}

/** Score for a ball resting at p (target position defaults to its starting spot). */
export function scoreAt(level: PhysicsLevel, p: Vec, water = false, targetPos: Vec = level.target): ShotResult {
  const d = len(sub(p, targetPos));
  const distance = d / PX_PER_M;
  if (water) return { points: 0, ring: null, distance, water };
  for (const ring of TARGET_RINGS) if (d - BALL_R <= ring.r) return { points: ring.points, ring, distance, water };
  return { points: 0, ring: null, distance, water };
}

/** Ghost path for aiming: the first ~0.5 s of the real simulation (walls included). */
export function previewPath(
  level: PhysicsLevel,
  green: Surface,
  start: Vec,
  direction: Vec,
  speed: number,
  field: Field = NO_FIELD,
  steps = 30,
): Vec[] {
  const b = newBall(start);
  launch(b, direction, speed);
  const out: Vec[] = [];
  for (let i = 0; i < steps && !b.resting; i++) {
    for (let k = 0; k < 4; k++) step(level, green, b, DT, field);
    out.push({ ...b.p });
  }
  return out;
}

// ─── Helpers for building levels ─────────────────────────────────────────────

export const rect = (x: number, y: number, w: number, h: number): Shape => ({ kind: 'rect', x, y, w, h });
export const circle = (x: number, y: number, r: number): Shape => ({ kind: 'circle', c: vec(x, y), r });

/** Four walls around a rectangle. */
export function boxWalls(x: number, y: number, w: number, h: number): Wall[] {
  const tl = vec(x, y), tr = vec(x + w, y), br = vec(x + w, y + h), bl = vec(x, y + h);
  return [
    { a: tl, b: tr },
    { a: tr, b: br },
    { a: br, b: bl },
    { a: bl, b: tl },
  ];
}

export const wall = (x1: number, y1: number, x2: number, y2: number): Wall => ({ a: vec(x1, y1), b: vec(x2, y2) });

/** Walls along every edge of a closed polygon (for custom-shaped courses). */
export function polyWalls(pts: Vec[]): Wall[] {
  return pts.map((a, i) => ({ a, b: pts[(i + 1) % pts.length] }));
}
