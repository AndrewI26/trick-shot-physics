// Saves which levels the player has completed (and their best score) in localStorage,
// so progress survives a page refresh. Wrapped in try/catch because storage can be
// unavailable (private browsing, blocked cookies, sandboxed iframes).
import type { SurfaceId } from './physics';

export interface BestResult {
  points: number;
  ring: string;
  attempts: number;
  surface: SurfaceId;
}

/** Keyed by level id (not position), so adding/reordering levels doesn't scramble progress. */
export type Progress = Record<number, BestResult>;

const KEY = 'trick-shot-physics:progress:v1';

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const data = JSON.parse(raw);
    return data && typeof data === 'object' ? (data as Progress) : {};
  } catch {
    return {};
  }
}

export function saveProgress(p: Progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // Storage unavailable — progress just won't persist.
  }
}

export function clearProgress() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
