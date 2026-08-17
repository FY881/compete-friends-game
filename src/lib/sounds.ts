/**
 * Tiny Web Audio sound effects — generated in the browser, no audio files.
 * A shared singleton context is created lazily on the first user gesture.
 */

const MUTE_KEY = "mindclash.sounds.muted";

let ctx: AudioContext | null = null;
let muted = false;

try {
  muted = localStorage.getItem(MUTE_KEY) === "1";
} catch {
  // storage unavailable — keep sounds on
}

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    // The constructor can throw synchronously in some WebViews (hardware
    // context limits, autoplay policy) — audio must never crash the game.
    try {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    } catch {
      return null;
    }
  }
  try {
    if (ctx.state === "suspended") {
      void ctx.resume().catch(() => undefined);
    }
  } catch {
    // ignore resume failures
  }
  return ctx;
}

function tone(
  frequency: number,
  startAt: number,
  duration: number,
  type: OscillatorType = "sine",
  volume = 0.1,
  slideTo?: number,
) {
  if (muted) return;
  try {
    const c = getCtx();
    if (!c) return;
    const t0 = c.currentTime + startAt;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, t0);
    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + duration);
    }
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  } catch {
    // audio unavailable — never crash the game over a sound effect
  }
}

export const sounds = {
  isMuted: () => muted,
  setMuted(value: boolean) {
    muted = value;
    try {
      localStorage.setItem(MUTE_KEY, value ? "1" : "0");
    } catch {
      // ignore storage failures
    }
  },
  toggleMuted: () => {
    sounds.setMuted(!muted);
    return muted;
  },
  click() {
    tone(620, 0, 0.07, "triangle", 0.06);
  },
  select() {
    tone(420, 0, 0.06, "sine", 0.05);
  },
  correct() {
    tone(523.25, 0, 0.11, "triangle", 0.11);
    tone(659.25, 0.09, 0.11, "triangle", 0.11);
    tone(783.99, 0.18, 0.22, "triangle", 0.11);
  },
  wrong() {
    tone(233, 0, 0.22, "sawtooth", 0.07, 140);
  },
  tick() {
    tone(880, 0, 0.05, "square", 0.025);
  },
  lifeline() {
    tone(420, 0, 0.1, "sine", 0.08, 880);
  },
  streak() {
    tone(587, 0, 0.08, "triangle", 0.1);
    tone(740, 0.08, 0.08, "triangle", 0.1);
    tone(932, 0.16, 0.16, "triangle", 0.1);
  },
  countdown() {
    tone(660, 0, 0.09, "triangle", 0.09);
    tone(880, 0.11, 0.16, "triangle", 0.1);
  },
  win() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => tone(f, i * 0.13, 0.18, "triangle", 0.12));
  },
  lose() {
    tone(440, 0, 0.16, "triangle", 0.09);
    tone(349.23, 0.16, 0.2, "triangle", 0.09);
    tone(293.66, 0.34, 0.3, "triangle", 0.09);
  },
  reveal() {
    tone(523.25, 0, 0.09, "triangle", 0.08);
    tone(392, 0.1, 0.14, "triangle", 0.08);
  },
};
