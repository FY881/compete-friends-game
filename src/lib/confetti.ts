/**
 * Lightweight canvas confetti — no dependency, pure rAF animation.
 * Call `burstConfetti()` anywhere; it cleans up its own canvas.
 */

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  spin: number;
  color: string;
  shape: "rect" | "circle";
  life: number;
};

const COLORS = [
  "#14b8a6", // teal — matches the app accent
  "#f59e0b", // amber
  "#f43f5e", // rose
  "#6366f1", // indigo
  "#10b981", // emerald
  "#fb923c", // orange
];

function random(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

export function burstConfetti(opts?: { count?: number; originY?: number }) {
  if (typeof window === "undefined") return;
  const count = opts?.count ?? 140;
  const originY = opts?.originY ?? 0.35;

  const canvas = document.createElement("canvas");
  canvas.style.cssText =
    "position:fixed;inset:0;pointer-events:none;z-index:9999;";
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    return;
  }

  const particles: Particle[] = Array.from({ length: count }, () => ({
    x: random(0, canvas.width),
    y: canvas.height * originY,
    vx: random(-6, 6),
    vy: random(-14, -6),
    size: random(5, 11),
    rotation: random(0, Math.PI * 2),
    spin: random(-0.3, 0.3),
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    shape: Math.random() > 0.5 ? "rect" : "circle",
    life: 1,
  }));

  const startedAt = performance.now();
  const duration = 3200;

  const frame = (now: number) => {
    const progress = (now - startedAt) / duration;
    if (progress >= 1) {
      canvas.remove();
      return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.22; // gravity
      p.vx *= 0.99;
      p.rotation += p.spin;
      p.life = Math.max(0, 1 - progress * 1.1);

      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      if (p.shape === "rect") {
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
