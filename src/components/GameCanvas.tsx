import { useEffect, useRef } from 'react';
import {
  DT,
  PX_PER_M,
  WORLD_H,
  WORLD_W,
  launch,
  len,
  newBall,
  previewPath,
  scoreAt,
  step,
  targetAt,
  vec,
  type Charge,
  type Field,
  type ShotResult,
  type Surface,
  type Vec,
} from '../game/physics';
import type { Level } from '../game/levels';
import { drawScene } from '../game/render';
import { sfx } from '../game/audio';

export interface Telemetry {
  speed: number; // m/s
  accel: number; // m/s²
  accelDir: number; // degrees, 0 = right, 90 = up
  maxSpeed: number; // m/s
  distance: number; // m
  ground: string; // what the ball is rolling on
  friction: number; // friction coefficient of that ground
  moving: boolean;
  history: { speed: number; accel: number }[];
}

interface Props {
  level: Level;
  surface: Surface;
  active: boolean;
  showVectors: boolean;
  holeKey: string;
  /** Ball's charge: +1, 0 or −1. */
  ballCharge: number;
  /** Charges the player has placed. */
  userCharges: Charge[];
  /** If set, clicking the course places a charge of this sign instead of aiming. */
  placeMode: 1 | -1 | null;
  onPlaceCharge: (p: Vec) => void;
  onRemoveCharge: (index: number) => void;
  onShot: () => void;
  /** Called once the one shot is over (ball stopped or went in the water). */
  onShotEnd: (result: ShotResult) => void;
  onTelemetry: (t: Telemetry) => void;
}

/** Minimum drag (px) before a shot counts — avoids accidental taps. */
const MIN_DRAG = 12;

const fieldOf = (p: Props): Field => ({
  ballQ: p.ballCharge,
  charges: [...(p.level.charges ?? []), ...p.userCharges],
});

export default function GameCanvas(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  const game = useRef({
    ball: newBall(props.level.tee),
    trail: [] as Vec[],
    aim: null as { v: Vec; preview: Vec[]; power: number } | null,
    dragStart: null as Vec | null,
    accel: vec(0, 0),
    shotActive: false,
    shotTaken: false,
    done: false,
    waterHit: false,
    hazard: undefined as 'water' | 'funnel' | undefined,
    clock: 0,
    flash: null as { text: string; until: number } | null,
    maxSpeed: 0,
    distance: 0,
    ground: '',
    friction: 0,
    history: [] as { speed: number; accel: number }[],
    lastTelemetry: 0,
  });

  // New hole (or restarted hole): put the ball on the tee.
  useEffect(() => {
    const g = game.current;
    const tee = propsRef.current.level.tee;
    g.ball = newBall(tee);
    g.trail = [];
    g.aim = null;
    g.dragStart = null;
    g.shotActive = false;
    g.shotTaken = false;
    g.done = false;
    g.waterHit = false;
    g.hazard = undefined;
    g.clock = 0;
    g.flash = null;
    g.maxSpeed = 0;
    g.distance = 0;
    g.history = [];
    g.accel = vec(0, 0);
  }, [props.holeKey]);

  // Main loop
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    let raf = 0;
    let last = performance.now();
    let acc = 0;

    const frame = (now: number) => {
      const p = propsRef.current;
      const g = game.current;
      const frameDt = Math.min(0.05, (now - last) / 1000);
      last = now;
      g.clock += frameDt;

      // Keep the backing store matched to the on-screen size.
      const dpr = window.devicePixelRatio || 1;
      const w = Math.round(canvas.clientWidth * dpr);
      const h = Math.round(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      if (!g.ball.resting && !g.done) {
        acc += frameDt;
        while (acc >= DT && !g.ball.resting) {
          acc -= DT;
          const info = step(p.level, p.surface, g.ball, DT, fieldOf(p));
          if (info.impact > 40) sfx.bounce(info.impact);
          g.accel = info.accel;
          g.ground = info.mat.name;
          g.friction = info.mat.friction;
          g.distance += len(g.ball.v) * DT;
          g.maxSpeed = Math.max(g.maxSpeed, len(g.ball.v));

          if (info.water || info.funnel) {
            g.ball.v = vec(0, 0);
            g.ball.resting = true;
            g.waterHit = true;
            g.hazard = info.funnel ? 'funnel' : 'water';
            break;
          }
        }
        if (g.ball.resting && g.shotActive) {
          // One shot only: score wherever the ball stopped.
          g.shotActive = false;
          g.done = true;
          g.accel = vec(0, 0);
          // Scored against wherever the target is at the moment the ball stops.
          const res = scoreAt(p.level, g.ball.p, g.waterHit, targetAt(p.level, g.clock));
          res.hazard = g.hazard;
          if (res.points > 0) {
            sfx.sink();
            g.flash = { text: `${res.ring!.name}! +${res.points}`, until: now + 2500 };
          } else {
            sfx.oops();
            g.flash = { text: res.hazard === 'funnel' ? 'Fell in!' : res.water ? 'Splash!' : 'Off target', until: now + 2500 };
          }
          p.onShotEnd(res);
        }
        if (g.shotActive) {
          g.trail.push({ ...g.ball.p });
          if (g.trail.length > 240) g.trail.shift();
        }
      } else {
        acc = 0;
      }

      // Telemetry to React ~12×/s
      if (now - g.lastTelemetry > 80) {
        g.lastTelemetry = now;
        const moving = !g.ball.resting;
        const speed = moving ? len(g.ball.v) / PX_PER_M : 0;
        const accel = moving ? len(g.accel) / PX_PER_M : 0;
        if (g.shotActive) {
          g.history.push({ speed, accel });
          if (g.history.length > 150) g.history.shift();
        }
        p.onTelemetry({
          speed,
          accel,
          accelDir: (Math.atan2(-g.accel.y, g.accel.x) * 180) / Math.PI,
          maxSpeed: g.maxSpeed / PX_PER_M,
          distance: g.distance / PX_PER_M,
          ground: g.ground,
          friction: g.friction,
          moving,
          history: [...g.history],
        });
      }

      const scale = canvas.width / WORLD_W;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      drawScene(ctx, p.level, p.surface, {
        ball: g.ball,
        trail: g.trail,
        aim: g.aim,
        accel: g.accel,
        showVectors: p.showVectors,
        time: now / 1000,
        targetPos: targetAt(p.level, g.clock),
        flash: g.flash && now < g.flash.until ? g.flash.text : undefined,
        field: fieldOf(p),
      });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const toWorld = (e: React.PointerEvent): Vec => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * WORLD_W, y: ((e.clientY - r.top) / r.height) * WORLD_H };
  };

  const onDown = (e: React.PointerEvent) => {
    const g = game.current;
    if (!props.active || g.shotTaken || g.done) return;
    if (props.placeMode !== null) {
      // Placing charges: click an existing one to remove it, empty ground to add one.
      const pt = toWorld(e);
      const c = props.level.course;
      if (pt.x < c.x || pt.x > c.x + c.w || pt.y < c.y || pt.y > c.y + c.h) return;
      const hit = props.userCharges.findIndex((ch) => len({ x: ch.p.x - pt.x, y: ch.p.y - pt.y }) < 20);
      if (hit >= 0) props.onRemoveCharge(hit);
      else if (props.userCharges.length < (props.level.maxCharges ?? 0)) props.onPlaceCharge(pt);
      return;
    }
    g.dragStart = toWorld(e);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onMove = (e: React.PointerEvent) => {
    const g = game.current;
    if (!g.dragStart) return;
    const cur = toWorld(e);
    const d = { x: g.dragStart.x - cur.x, y: g.dragStart.y - cur.y };
    const L = len(d);
    if (L < MIN_DRAG) {
      g.aim = null;
      return;
    }
    const speed = props.level.launchSpeed;
    const v = { x: (d.x / L) * speed, y: (d.y / L) * speed };
    g.aim = { v, preview: previewPath(props.level, props.surface, g.ball.p, v, speed, fieldOf(props)), power: 1 };
  };

  const onUp = () => {
    const g = game.current;
    const aim = g.aim;
    g.dragStart = null;
    g.aim = null;
    if (!aim) return;
    launch(g.ball, aim.v, props.level.launchSpeed);
    g.shotActive = true;
    g.shotTaken = true;
    g.maxSpeed = 0;
    g.distance = 0;
    g.history = [];
    g.trail = [];
    sfx.hit(aim.power);
    props.onShot();
  };

  return (
    <canvas
      ref={canvasRef}
      className="game-canvas"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    />
  );
}
