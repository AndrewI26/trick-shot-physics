import {
  BALL_R,
  TARGET_RINGS,
  WORLD_H,
  WORLD_W,
  electricAt,
  len,
  resolveMat,
  type Ball,
  type Field,
  type Shape,
  type Surface,
  type Vec,
} from './physics';
import type { Level } from './levels';

export interface DrawState {
  ball: Ball;
  trail: Vec[];
  aim: { v: Vec; preview: Vec[]; power: number } | null;
  accel: Vec;
  showVectors: boolean;
  time: number;
  /** Short message shown above the target. */
  flash?: string;
  /** Charges on the field + the ball's charge. */
  field?: Field;
  /** Current target position (for moving targets). */
  targetPos?: Vec;
}

function shapePath(ctx: CanvasRenderingContext2D, s: Shape) {
  ctx.beginPath();
  if (s.kind === 'rect') ctx.rect(s.x, s.y, s.w, s.h);
  else ctx.arc(s.c.x, s.c.y, s.r, 0, Math.PI * 2);
}

function arrow(ctx: CanvasRenderingContext2D, from: Vec, d: Vec, color: string, label: string) {
  const L = len(d);
  if (L < 4) return;
  const to = { x: from.x + d.x, y: from.y + d.y };
  const ux = d.x / L;
  const uy = d.y / L;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - ux * 10 - uy * 6, to.y - uy * 10 + ux * 6);
  ctx.lineTo(to.x - ux * 10 + uy * 6, to.y - uy * 10 - ux * 6);
  ctx.closePath();
  ctx.fill();
  if (label) {
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText(label, to.x + ux * 8 + 4, to.y + uy * 8 + 4);
  }
}

const STARS = Array.from({ length: 120 }, (_, i) => ({ x: (i * 137.5) % WORLD_W, y: (i * 71.3) % WORLD_H, r: (i % 3) * 0.5 + 0.4 }));

export function drawScene(ctx: CanvasRenderingContext2D, level: Level, green: Surface, s: DrawState) {
  // Backdrop
  ctx.fillStyle = level.backdrop;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  if (level.gravityLabel.startsWith('Moon')) {
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (const st of STARS) {
      ctx.beginPath();
      ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Course base with mowing stripes
  const c = level.course;
  const base = resolveMat(level.base, green);
  ctx.save();
  ctx.beginPath();
  if (level.shape) {
    level.shape.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
  } else {
    ctx.rect(c.x, c.y, c.w, c.h);
  }
  ctx.clip();
  ctx.fillStyle = base.color;
  ctx.fillRect(c.x, c.y, c.w, c.h);
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  for (let x = c.x; x < c.x + c.w; x += 80) ctx.fillRect(x, c.y, 40, c.h);

  // Zones
  for (const z of level.zones) {
    if (z.slope) {
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      shapePath(ctx, z.shape);
      ctx.fill();
      // Arrows showing which way is downhill
      const L = len(z.slope);
      const dir = { x: z.slope.x / L, y: z.slope.y / L };
      if (z.shape.kind === 'rect') {
        ctx.globalAlpha = 0.35;
        for (let x = z.shape.x + 40; x < z.shape.x + z.shape.w; x += 80) {
          for (let y = z.shape.y + 40; y < z.shape.y + z.shape.h; y += 90) {
            const off = ((s.time * 30) % 30) - 15;
            arrow(ctx, { x: x + dir.x * off, y: y + dir.y * off }, { x: dir.x * 30, y: dir.y * 30 }, '#fff', '');
          }
        }
        ctx.globalAlpha = 1;
      }
    } else if (z.funnel && z.shape.kind === 'circle') {
      const { c: fc, r: fr } = z.shape;
      const g = ctx.createRadialGradient(fc.x, fc.y, z.funnel.pit, fc.x, fc.y, fr);
      g.addColorStop(0, 'rgba(0,0,0,0.85)');
      g.addColorStop(0.35, 'rgba(0,0,0,0.45)');
      g.addColorStop(1, 'rgba(0,0,0,0.05)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(fc.x, fc.y, fr, 0, Math.PI * 2);
      ctx.fill();
      // Rings crowd together toward the middle (steeper slope), slowly spinning.
      ctx.lineWidth = 1.5;
      ctx.setLineDash([14, 10]);
      [0.95, 0.75, 0.58, 0.44, 0.33, 0.24].forEach((k, i) => {
        ctx.strokeStyle = `rgba(255,255,255,${0.12 + i * 0.04})`;
        ctx.lineDashOffset = -s.time * (20 + i * 12);
        ctx.beginPath();
        ctx.arc(fc.x, fc.y, fr * k, 0, Math.PI * 2);
        ctx.stroke();
      });
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
      ctx.fillStyle = '#050505';
      ctx.beginPath();
      ctx.arc(fc.x, fc.y, z.funnel.pit, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('FUNNEL', fc.x, fc.y - fr + 22);
      ctx.textAlign = 'left';
    } else if (z.air) {
      ctx.fillStyle = 'rgba(190,225,255,0.18)';
      shapePath(ctx, z.shape);
      ctx.fill();
      ctx.save();
      shapePath(ctx, z.shape);
      ctx.clip();
      const sp = len(z.air.v) || 1;
      const ux = z.air.v.x / sp, uy = z.air.v.y / sp;
      const box = z.shape.kind === 'rect' ? z.shape : { x: z.shape.c.x - z.shape.r, y: z.shape.c.y - z.shape.r, w: z.shape.r * 2, h: z.shape.r * 2 };
      const along = Math.abs(ux) > Math.abs(uy) ? box.w : box.h;
      const across = Math.abs(ux) > Math.abs(uy) ? box.h : box.w;
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 2;
      for (let lane = 12; lane < across; lane += 22) {
        for (let k = -1; k < along / 60 + 1; k++) {
          const t = ((s.time * sp * 0.5 + k * 60 + lane * 7) % (along + 60)) - 30;
          let x0: number, y0: number;
          if (Math.abs(ux) > Math.abs(uy)) {
            x0 = ux > 0 ? box.x + t : box.x + box.w - t;
            y0 = box.y + lane;
          } else {
            x0 = box.x + lane;
            y0 = uy > 0 ? box.y + t : box.y + box.h - t;
          }
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x0 - ux * 22, y0 - uy * 22);
          ctx.stroke();
        }
      }
      ctx.restore();
    } else if (z.mat === 'water') {
      ctx.fillStyle = '#2f7dd1';
      shapePath(ctx, z.shape);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      if (z.shape.kind === 'circle') {
        for (let i = 0; i < 3; i++) {
          const r = ((s.time * 12 + i * 15) % 45) + 3;
          ctx.beginPath();
          ctx.arc(z.shape.c.x, z.shape.c.y, Math.min(r, z.shape.r - 2), 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    } else {
      const m = resolveMat(z.mat, green);
      ctx.fillStyle = m.color;
      shapePath(ctx, z.shape);
      ctx.fill();
      ctx.strokeStyle = m.edge;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    if (z.label) {
      const cx = z.shape.kind === 'rect' ? z.shape.x + z.shape.w / 2 : z.shape.c.x;
      const cy = z.shape.kind === 'rect' ? z.shape.y + 24 : z.shape.c.y + 5;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(z.label, cx, cy);
      ctx.textAlign = 'left';
    }
  }
  // Electric field arrows: which way a charge would push the ball at each spot
  const field = s.field;
  if (field && field.ballQ && field.charges.length) {
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let x = c.x + 25; x < c.x + c.w; x += 50) {
      for (let y = c.y + 25; y < c.y + c.h; y += 50) {
        const a = electricAt(field, { x, y });
        const m = len(a);
        if (m < 15) continue;
        const L = Math.min(20, 4 + m * 0.03);
        const ux = a.x / m, uy = a.y / m;
        ctx.globalAlpha = Math.min(0.8, 0.15 + m / 1500);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x - ux * L * 0.5, y - uy * L * 0.5);
        ctx.lineTo(x + ux * L * 0.5, y + uy * L * 0.5);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + ux * L * 0.5, y + uy * L * 0.5);
        ctx.lineTo(x + ux * L * 0.5 - ux * 5 - uy * 3, y + uy * L * 0.5 - uy * 5 + ux * 3);
        ctx.lineTo(x + ux * L * 0.5 - ux * 5 + uy * 3, y + uy * L * 0.5 - uy * 5 - ux * 3);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  // Surface label (top-left of the course)
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillText(`Surface: ${green.name}`, c.x + 12, c.y + 22);

  // Walls (wooden rails)
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#6d4c41';
  ctx.lineWidth = 12;
  for (const w of level.walls) {
    ctx.beginPath();
    ctx.moveTo(w.a.x, w.a.y);
    ctx.lineTo(w.b.x, w.b.y);
    ctx.stroke();
  }
  ctx.strokeStyle = '#a1887f';
  ctx.lineWidth = 4;
  for (const w of level.walls) {
    ctx.beginPath();
    ctx.moveTo(w.a.x, w.a.y);
    ctx.lineTo(w.b.x, w.b.y);
    ctx.stroke();
  }

  // Traffic barriers: white bars with diagonal orange stripes
  for (const r of level.barriers ?? []) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(r.x + 3, r.y + 4, r.w, r.h);
    // Sawhorse legs: A-frame feet splayed out at each end of the bar
    ctx.fillStyle = '#5d4037';
    const horiz = r.w >= r.h;
    const legLen = 7, legW = 5;
    for (const t of [0.12, 0.88]) {
      if (horiz) {
        const lx = r.x + r.w * t - legW / 2;
        ctx.fillRect(lx, r.y - legLen, legW, r.h + legLen * 2);
      } else {
        const ly = r.y + r.h * t - legW / 2;
        ctx.fillRect(r.x - legLen, ly, r.w + legLen * 2, legW);
      }
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = '#ff6d00';
    const stripe = 12;
    for (let k = -r.h; k < r.w + r.h; k += stripe * 2) {
      ctx.beginPath();
      ctx.moveTo(r.x + k, r.y + r.h);
      ctx.lineTo(r.x + k + stripe, r.y + r.h);
      ctx.lineTo(r.x + k + stripe + r.h, r.y);
      ctx.lineTo(r.x + k + r.h, r.y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = '#3e2723';
    ctx.lineWidth = 2;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
  }

  // Bumpers: orange-and-white traffic barrels, seen from above
  for (const b of level.bumpers) {
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.arc(b.c.x + 3, b.c.y + 4, b.r, 0, Math.PI * 2);
    ctx.fill();
    // Alternating reflective bands: orange, white, orange, white…
    const bands = ['#ff6d00', '#ffffff', '#ff6d00', '#ffffff', '#ff6d00'];
    bands.forEach((col, i) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(b.c.x, b.c.y, b.r * (1 - i * 0.17), 0, Math.PI * 2);
      ctx.fill();
    });
    // Black top cap + rim outline
    ctx.fillStyle = '#212121';
    ctx.beginPath();
    ctx.arc(b.c.x, b.c.y, b.r * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#bf360c';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(b.c.x, b.c.y, b.r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Moving target: show the track it slides along
  if (level.targetMotion) {
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 4;
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(level.target.x, level.target.y);
    ctx.lineTo(level.targetMotion.to.x, level.targetMotion.to.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Curling-style target (outer ring first)
  const target = s.targetPos ?? level.target;
  for (let i = TARGET_RINGS.length - 1; i >= 0; i--) {
    const ring = TARGET_RINGS[i];
    ctx.fillStyle = ring.color;
    ctx.beginPath();
    ctx.arc(target.x, target.y, ring.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1.5;
  for (const ring of TARGET_RINGS) {
    ctx.beginPath();
    ctx.arc(target.x, target.y, ring.r, 0, Math.PI * 2);
    ctx.stroke();
  }
  const outer = TARGET_RINGS[TARGET_RINGS.length - 1].r;
  ctx.beginPath();
  ctx.moveTo(target.x - outer, target.y);
  ctx.lineTo(target.x + outer, target.y);
  ctx.moveTo(target.x, target.y - outer);
  ctx.lineTo(target.x, target.y + outer);
  ctx.stroke();
  ctx.fillStyle = '#d32f2f';
  ctx.beginPath();
  ctx.arc(target.x, target.y, 3, 0, Math.PI * 2);
  ctx.fill();

  if (s.flash) {
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.strokeText(s.flash, target.x, target.y - outer - 12);
    ctx.fillStyle = '#ffeb3b';
    ctx.fillText(s.flash, target.x, target.y - outer - 12);
    ctx.textAlign = 'left';
  }

  // Charges
  if (field) {
    for (const ch of field.charges) {
      const r = ch.fixed ? 18 : 14;
      const glow = ctx.createRadialGradient(ch.p.x, ch.p.y, 2, ch.p.x, ch.p.y, r * 3);
      const col = ch.q > 0 ? '229,57,53' : '30,136,229';
      glow.addColorStop(0, `rgba(${col},0.45)`);
      glow.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(ch.p.x, ch.p.y, r * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgb(${col})`;
      ctx.beginPath();
      ctx.arc(ch.p.x, ch.p.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = ch.fixed ? '#ffd54f' : '#fff';
      ctx.lineWidth = ch.fixed ? 3 : 2;
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${ch.fixed ? 20 : 16}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(ch.q > 0 ? '+' : '−', ch.p.x, ch.p.y + 6);
      if (ch.fixed) {
        ctx.font = 'bold 11px system-ui, sans-serif';
        ctx.fillText('MAGNET', ch.p.x, ch.p.y + r + 14);
      }
      ctx.textAlign = 'left';
    }
  }

  // Tee marker
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.arc(level.tee.x, level.tee.y, 14, 0, Math.PI * 2);
  ctx.fill();

  // Trail
  if (s.trail.length > 1) {
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(s.trail[0].x, s.trail[0].y);
    for (const p of s.trail) ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Aim
  const b = s.ball.p;
  if (s.aim) {
    ctx.fillStyle = '#fff';
    s.aim.preview.forEach((p, i) => {
      ctx.globalAlpha = 0.9 * (1 - i / s.aim!.preview.length);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    const L = len(s.aim.v) || 1;
    arrow(ctx, b, { x: (s.aim.v.x / L) * 70, y: (s.aim.v.y / L) * 70 }, '#ffeb3b', '');
  }

  // Ball
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.arc(b.x + 2, b.y + 3, BALL_R, 0, Math.PI * 2);
  ctx.fill();
  // Black puck (seen from above): dark body, light rim so it shows on dark surfaces, soft shine
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#9e9e9e';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(b.x, b.y, BALL_R * 0.6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(b.x, b.y, BALL_R * 0.75, Math.PI * 1.1, Math.PI * 1.45);
  ctx.stroke();
  if (field && field.ballQ) {
    ctx.fillStyle = field.ballQ > 0 ? '#e53935' : '#1e88e5';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(field.ballQ > 0 ? '+' : '−', b.x, b.y + 4);
    ctx.textAlign = 'left';
  }

  // Velocity + acceleration vectors
  if (s.showVectors && !s.ball.resting) {
    arrow(ctx, b, { x: s.ball.v.x * 0.16, y: s.ball.v.y * 0.16 }, '#2196f3', 'v');
    arrow(ctx, b, { x: s.accel.x * 0.25, y: s.accel.y * 0.25 }, '#ff9800', 'a');
  }
}
