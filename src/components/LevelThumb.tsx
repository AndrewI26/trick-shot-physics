import { useEffect, useRef } from 'react';
import { WORLD_W, newBall, surfaceById, vec } from '../game/physics';
import type { Level } from '../game/levels';
import { drawScene } from '../game/render';

/** Static preview of a hole for the Levels screen. */
export default function LevelThumb({ level }: { level: Level }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = c.clientWidth * dpr;
    c.height = c.clientHeight * dpr;
    const ctx = c.getContext('2d')!;
    const scale = c.width / WORLD_W;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    drawScene(ctx, level, surfaceById('grass'), {
      ball: newBall(level.tee),
      trail: [],
      aim: null,
      accel: vec(0, 0),
      showVectors: false,
      time: 0,
    });
  }, [level]);
  return <canvas ref={ref} className="thumb" />;
}
