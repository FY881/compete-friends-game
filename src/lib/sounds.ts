/**
 * Sound system using Web Audio API — no external files needed.
 * Generates all sounds procedurally so the app stays lightweight.
 */

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || (window as unknown as Record<string, typeof AudioContext>).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  return audioCtx;
}

function playTone(frequency: number, duration: number, type: OscillatorType = "sine", volume = 0.15) {
  const ctx = getCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, ctx.currentTime);
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

/** Click / tap feedback — short, subtle */
export function playClick() {
  playTone(800, 0.06, "sine", 0.08);
}

/** Correct answer — bright ascending */
export function playCorrect() {
  const ctx = getCtx();
  if (!ctx) return;
  playTone(523, 0.12, "sine", 0.12);
  setTimeout(() => playTone(659, 0.12, "sine", 0.12), 100);
  setTimeout(() => playTone(784, 0.18, "sine", 0.14), 200);
}

/** Wrong answer — descending buzz */
export function playWrong() {
  playTone(300, 0.15, "sawtooth", 0.1);
  setTimeout(() => playTone(220, 0.2, "sawtooth", 0.1), 120);
}

/** Victory / win — triumphant fanfare */
export function playVictory() {
  const notes = [523, 659, 784, 1047];
  notes.forEach((freq, i) => {
    setTimeout(() => playTone(freq, 0.2, "sine", 0.12), i * 150);
  });
}

/** Achievement unlocked — sparkle */
export function playAchievement() {
  playTone(880, 0.15, "sine", 0.1);
  setTimeout(() => playTone(1109, 0.15, "sine", 0.1), 80);
  setTimeout(() => playTone(1319, 0.25, "sine", 0.12), 160);
}

/** Notification received — gentle chime */
export function playNotification() {
  playTone(698, 0.1, "sine", 0.1);
  setTimeout(() => playTone(880, 0.15, "sine", 0.1), 120);
}

/** Level up — ascending scale */
export function playLevelUp() {
  const notes = [262, 330, 392, 523, 659, 784];
  notes.forEach((freq, i) => {
    setTimeout(() => playTone(freq, 0.15, "triangle", 0.1), i * 100);
  });
}

/** Gift received — happy jingle */
export function playGift() {
  playTone(784, 0.12, "sine", 0.1);
  setTimeout(() => playTone(988, 0.12, "sine", 0.1), 100);
  setTimeout(() => playTone(1175, 0.2, "sine", 0.12), 200);
}

/** Timer ticking — urgent beep */
export function playTimerTick() {
  playTone(1000, 0.05, "square", 0.05);
}

/** Game start — energizing */
export function playGameStart() {
  playTone(440, 0.1, "sine", 0.1);
  setTimeout(() => playTone(554, 0.1, "sine", 0.1), 100);
  setTimeout(() => playTone(659, 0.15, "sine", 0.12), 200);
}

/** Error / warning */
export function playError() {
  playTone(200, 0.2, "sawtooth", 0.08);
  setTimeout(() => playTone(150, 0.3, "sawtooth", 0.08), 200);
}

/** Mute/unmute state */
let _muted = false;
export function isSoundMuted() { return _muted; }
export function setSoundMuted(muted: boolean) { _muted = muted; }

/** Wrapper that respects mute state */
function muted(fn: () => void) {
  if (!_muted) fn();
}

export const Sound = {
  click: () => muted(playClick),
  correct: () => muted(playCorrect),
  wrong: () => muted(playWrong),
  victory: () => muted(playVictory),
  achievement: () => muted(playAchievement),
  notification: () => muted(playNotification),
  levelUp: () => muted(playLevelUp),
  gift: () => muted(playGift),
  timerTick: () => muted(playTimerTick),
  gameStart: () => muted(playGameStart),
  error: () => muted(playError),
};
