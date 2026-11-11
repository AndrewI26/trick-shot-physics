// Tiny synthesized sound effects (Web Audio) — no outside audio files, so nothing to cite.
let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
  }
  return ctx;
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.15) {
  const a = ac();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(vol, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
  o.connect(g).connect(a.destination);
  o.start();
  o.stop(a.currentTime + dur);
}

export const sfx = {
  hit: (power: number) => tone(200 + power * 400, 0.12, 'triangle', 0.2),
  bounce: (speed: number) => tone(120 + Math.min(speed, 600) * 0.4, 0.06, 'square', Math.min(0.1, speed / 4000)),
  sink: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.25, 'sine', 0.15), i * 110)),
  oops: () => tone(150, 0.3, 'sawtooth', 0.1),
  lip: () => {
    tone(700, 0.05, 'square', 0.08);
    setTimeout(() => tone(500, 0.07, 'square', 0.08), 50);
  },
};
