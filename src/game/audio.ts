// All sound is synthesized with Web Audio: no outside audio files, so nothing to license or load.
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfxBus: GainNode | null = null;
let musicBus: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;

const PREFS_KEY = 'trick-shot-physics:audio:v1';
type Prefs = { music: boolean; sound: boolean };
function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return { music: true, sound: true, ...JSON.parse(raw) };
  } catch {
    // Storage unavailable: use defaults.
  }
  return { music: true, sound: true };
}
const prefs = loadPrefs();
function savePrefs() {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Storage unavailable: settings just won't persist.
  }
}

const MUSIC_VOL = 0.22;
const SFX_VOL = 0.9;

function ac(): AudioContext | null {
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
    master = ctx.createGain();
    master.gain.value = 0.8;
    master.connect(ctx.destination);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = prefs.sound ? SFX_VOL : 0;
    sfxBus.connect(master);
    musicBus = ctx.createGain();
    musicBus.gain.value = prefs.music ? MUSIC_VOL : 0;
    musicBus.connect(master);
    // 2 s of white noise, reused by every noisy sound.
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return ctx;
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.15, when = 0, slideTo?: number) {
  const a = ac();
  if (!a || !sfxBus) return;
  const t = a.currentTime + when;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(sfxBus);
  o.start(t);
  o.stop(t + dur + 0.02);
}

/** Short burst of filtered noise (thuds, splashes, scrapes). */
function noise(dur: number, vol: number, filter: BiquadFilterType, freq: number, freqTo?: number, when = 0) {
  const a = ac();
  if (!a || !sfxBus || !noiseBuf) return;
  const t = a.currentTime + when;
  const src = a.createBufferSource();
  src.buffer = noiseBuf;
  const f = a.createBiquadFilter();
  f.type = filter;
  f.frequency.setValueAtTime(freq, t);
  if (freqTo) f.frequency.exponentialRampToValueAtTime(freqTo, t + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(sfxBus);
  src.start(t, Math.random());
  src.stop(t + dur + 0.02);
}

// ─── Rolling: a looping noise whose loudness/pitch follow the ball ───────────
let roll: { src: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode } | null = null;

function ensureRoll() {
  const a = ac();
  if (!a || !sfxBus || !noiseBuf) return null;
  if (!roll) {
    const src = a.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const filter = a.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 0.8;
    const gain = a.createGain();
    gain.gain.value = 0;
    src.connect(filter).connect(gain).connect(sfxBus);
    src.start();
    roll = { src, filter, gain };
  }
  return roll;
}

// ─── Background music: a gentle looping tune, scheduled ahead of time ────────
const BPM = 92;
const BEAT = 60 / BPM;
// I – vi – IV – V in C major, one chord per bar (4 beats).
const CHORDS = [
  [261.63, 329.63, 392.0], // C
  [220.0, 261.63, 329.63], // Am
  [174.61, 220.0, 261.63], // F
  [196.0, 246.94, 293.66], // G
];
const BASS = [65.41, 55.0, 87.31, 98.0];
// Melody: one note (Hz) per eighth note for each bar (0 = rest), on top of the chord.
const MELODY = [
  [523.25, 0, 659.25, 0, 783.99, 659.25, 587.33, 0],
  [523.25, 0, 440.0, 0, 523.25, 587.33, 659.25, 0],
  [698.46, 0, 659.25, 0, 587.33, 523.25, 440.0, 0],
  [587.33, 0, 493.88, 0, 587.33, 0, 783.99, 0],
];
let musicTimer: ReturnType<typeof setInterval> | null = null;
let nextBarTime = 0;
let bar = 0;

function musicNote(freq: number, t: number, dur: number, type: OscillatorType, vol: number) {
  const a = ctx!;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(musicBus!);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function scheduleBar(t: number, i: number) {
  const c = i % 4;
  // Soft pad chord across the bar.
  for (const f of CHORDS[c]) musicNote(f, t, BEAT * 4, 'triangle', 0.07);
  // Bass on beats 1 and 3.
  musicNote(BASS[c], t, BEAT * 1.8, 'sine', 0.3);
  musicNote(BASS[c], t + BEAT * 2, BEAT * 1.8, 'sine', 0.25);
  // Melody plays every other time round the progression so it doesn't get tiring.
  if (Math.floor(i / 4) % 2 === 0) {
    MELODY[c].forEach((f, k) => {
      if (f) musicNote(f, t + k * (BEAT / 2), BEAT * 0.9, 'sine', 0.09);
    });
  } else {
    // Light arpeggio instead.
    for (let k = 0; k < 8; k++) musicNote(CHORDS[c][k % 3] * 2, t + k * (BEAT / 2), BEAT * 0.45, 'sine', 0.04);
  }
}

function startMusic() {
  const a = ac();
  if (!a || musicTimer) return;
  nextBarTime = a.currentTime + 0.1;
  musicTimer = setInterval(() => {
    // Keep ~1 bar scheduled ahead.
    while (nextBarTime < a.currentTime + BEAT * 4) {
      scheduleBar(nextBarTime, bar++);
      nextBarTime += BEAT * 4;
    }
  }, 250);
}

function stopMusic() {
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = null;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Call on any user gesture: browsers only allow audio after one. Starts the music. */
export function unlockAudio() {
  const a = ac();
  if (!a) return;
  if (a.state === 'suspended') a.resume();
  if (prefs.music) startMusic();
}

export const audioPrefs = {
  get music() {
    return prefs.music;
  },
  get sound() {
    return prefs.sound;
  },
  setMusic(on: boolean) {
    prefs.music = on;
    savePrefs();
    const a = ac();
    if (a && musicBus) musicBus.gain.setTargetAtTime(on ? MUSIC_VOL : 0, a.currentTime, 0.1);
    if (on) unlockAudio();
    else setTimeout(() => !prefs.music && stopMusic(), 400);
  },
  setSound(on: boolean) {
    prefs.sound = on;
    savePrefs();
    const a = ac();
    if (a && sfxBus) sfxBus.gain.setTargetAtTime(on ? SFX_VOL : 0, a.currentTime, 0.05);
  },
};

export const sfx = {
  /** Putter strike: a woody thock. */
  hit: (power: number) => {
    tone(180 + power * 120, 0.12, 'sine', 0.35, 0, 90);
    noise(0.05, 0.25, 'bandpass', 2200);
  },
  /** Ball hitting a wall or bumper; louder for harder hits. */
  bounce: (speed: number) => {
    const v = Math.min(1, speed / 500);
    tone(140 + v * 160, 0.08, 'triangle', 0.08 + v * 0.22, 0, 80);
    noise(0.04, 0.05 + v * 0.15, 'bandpass', 1500);
  },
  /** Continuous rolling sound. Call every frame; speed in px/s, friction of the ground under the ball. */
  rolling: (speed: number, friction: number) => {
    const a = ac();
    if (!a) return;
    const r = ensureRoll();
    if (!r) return;
    const v = Math.min(1, speed / 450);
    // Smooth surfaces (ice) hiss high and quiet; rough ones (sand, mud) rumble low and gritty.
    const rough = Math.min(1, friction / 0.8);
    r.filter.frequency.setTargetAtTime(2400 - rough * 1800 + v * 600, a.currentTime, 0.05);
    r.gain.gain.setTargetAtTime(v * (0.06 + rough * 0.12), a.currentTime, 0.05);
  },
  stopRolling: () => {
    if (!roll || !ctx) return;
    roll.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.04);
  },
  /** Landed on the target: rising chime. */
  sink: () => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.35, 'sine', 0.18, i * 0.1)),
  /** Stopped off target: soft two-note "aww". */
  oops: () => {
    tone(330, 0.22, 'triangle', 0.14);
    tone(247, 0.35, 'triangle', 0.14, 0.18);
  },
  /** Rolled into water. */
  splash: () => {
    noise(0.5, 0.4, 'lowpass', 3000, 300);
    tone(600, 0.25, 'sine', 0.1, 0.02, 150);
  },
  /** Fell into the funnel: descending whistle. */
  fall: () => {
    tone(900, 0.7, 'sine', 0.14, 0, 120);
    tone(80, 0.2, 'sine', 0.25, 0.65);
  },
  /** Surface changed. */
  surface: () => tone(880, 0.06, 'square', 0.05),
  /** Any button press. */
  click: () => tone(660, 0.04, 'triangle', 0.08),
  lip: () => {
    tone(700, 0.05, 'square', 0.08);
    tone(500, 0.07, 'square', 0.08, 0.05);
  },
};
