// Tiny WebAudio synth — zero audio assets, ~1 KB of code. Mute state persists
// across sessions. The AudioContext is created lazily and must be unlocked by
// a user gesture (call unlockAudio() from a click/tap handler) per browser
// autoplay policy.
const STORAGE_KEY = 'teamtaboo:muted';

let ctx = null;
let muted = false;
try {
  muted = localStorage.getItem(STORAGE_KEY) === '1';
} catch {
  /* private browsing / storage unavailable */
}

function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

export function unlockAudio() {
  getCtx();
}

export function isMuted() {
  return muted;
}
export function setMuted(v) {
  muted = !!v;
  try {
    localStorage.setItem(STORAGE_KEY, muted ? '1' : '0');
  } catch {
    /* ignore */
  }
}
export function toggleMuted() {
  setMuted(!muted);
  return muted;
}

// Schedule one short tone. glideTo, if set, sweeps the pitch across `duration`.
function tone(freq, { type = 'triangle', duration = 0.14, delay = 0, gain = 0.14, glideTo } = {}) {
  if (muted) return;
  const c = getCtx();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + duration);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

export function playTurnStart() {
  tone(440, { duration: 0.11, gain: 0.12 });
  tone(660, { delay: 0.1, duration: 0.16, gain: 0.14 });
}
export function playExact() {
  tone(660, { duration: 0.1, gain: 0.16 });
  tone(880, { delay: 0.09, duration: 0.18, gain: 0.18 });
}
export function playClose() {
  tone(520, { duration: 0.16, gain: 0.14 });
}
export function playWrong() {
  tone(170, { type: 'sine', duration: 0.12, gain: 0.08 });
}
export function playTick() {
  tone(880, { type: 'square', duration: 0.045, gain: 0.05 });
}
export function playTurnEnd() {
  tone(660, { duration: 0.11, gain: 0.13 });
  tone(440, { delay: 0.1, duration: 0.2, gain: 0.13 });
}
export function playWin() {
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
    tone(f, { delay: i * 0.11, duration: 0.22, gain: 0.16 })
  );
}
