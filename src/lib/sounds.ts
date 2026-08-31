/**
 * Sound system using Web Audio API — no external files needed.
 */

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || (window as unknown as Record<string, typeof AudioContext>).webkitAudioContext)();
    } catch { return null; }
  }
  return audioCtx;
}

function playTone(f: number, d: number, type: OscillatorType = "sine", vol = 0.15) {
  const ctx = getCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f, ctx.currentTime);
  gain.gain.setValueAtTime(vol, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + d);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + d);
}

let _muted = false;
export function isSoundMuted() { return _muted; }
export function setSoundMuted(m: boolean) { _muted = m; }
function muted(fn: () => void) { if (!_muted) fn(); }

export const Sound = {
  click: () => muted(() => playTone(800, 0.06, "sine", 0.08)),
  correct: () => muted(() => { playTone(523, 0.12, "sine", 0.12); setTimeout(() => playTone(659, 0.12, "sine", 0.12), 100); setTimeout(() => playTone(784, 0.18, "sine", 0.14), 200); }),
  wrong: () => muted(() => { playTone(300, 0.15, "sawtooth", 0.1); setTimeout(() => playTone(220, 0.2, "sawtooth", 0.1), 120); }),
  victory: () => muted(() => { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => playTone(f, 0.2, "sine", 0.12), i * 150)); }),
  achievement: () => muted(() => { playTone(880, 0.15, "sine", 0.1); setTimeout(() => playTone(1109, 0.15, "sine", 0.1), 80); setTimeout(() => playTone(1319, 0.25, "sine", 0.12), 160); }),
  notification: () => muted(() => { playTone(698, 0.1, "sine", 0.1); setTimeout(() => playTone(880, 0.15, "sine", 0.1), 120); }),
  levelUp: () => muted(() => { [262, 330, 392, 523, 659, 784].forEach((f, i) => setTimeout(() => playTone(f, 0.15, "triangle", 0.1), i * 100)); }),
  gift: () => muted(() => { playTone(784, 0.12, "sine", 0.1); setTimeout(() => playTone(988, 0.12, "sine", 0.1), 100); setTimeout(() => playTone(1175, 0.2, "sine", 0.12), 200); }),
  timerTick: () => muted(() => playTone(1000, 0.05, "square", 0.05)),
  gameStart: () => muted(() => { playTone(440, 0.1, "sine", 0.1); setTimeout(() => playTone(554, 0.1, "sine", 0.1), 100); setTimeout(() => playTone(659, 0.15, "sine", 0.12), 200); }),
  error: () => muted(() => { playTone(200, 0.2, "sawtooth", 0.08); setTimeout(() => playTone(150, 0.3, "sawtooth", 0.08), 200); }),
  countdown: () => muted(() => playTone(660, 0.08, "square", 0.1)),
  tick: () => muted(() => playTone(1000, 0.04, "square", 0.06)),
  reveal: () => muted(() => { playTone(440, 0.15, "triangle", 0.12); setTimeout(() => playTone(660, 0.2, "triangle", 0.14), 150); }),
  select: () => muted(() => playTone(600, 0.08, "sine", 0.1)),
  lifeline: () => muted(() => { playTone(523, 0.1, "sine", 0.1); setTimeout(() => playTone(784, 0.15, "sine", 0.12), 100); }),
  isMuted: () => _muted,
  toggleMuted: () => { _muted = !_muted; return _muted; },
};

/** Backward-compatible alias so existing `import { sounds }` still works */
export const sounds = Sound;
