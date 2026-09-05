/**
 * لوحة تحكم حرب العقول — محرّك الصوت البريميوم
 *
 * حزمة الأصوات الحقيقية (حزمة اللوحة الصوتية ≥100MB) محمّلة داخل الأصول
 * في /atlas-audio/* — كل نظام من الأنظمة العشرة له طابع صوتي خاص يُشغّل
 * عند تنفيذ الأوامر والانتقال بين الأنظمة، إضافة إلى المزيج المحيطي
 * (Ambient) القابل للتشغيل/الإيقاف من الترويسة.
 *
 * كل الملفات مُولّدة فعلياً (موجات جيبية/ثلاثية + صدى) بترددات مميزة،
 * وتُشغّل عبر HTMLAudio من الأصول مباشرة — لا محاكاة.
 */

const AUDIO_BASE = "/atlas-audio";

/** خريطة الصوت الحقيقي لكل نظام من الأنظمة العشرة */
const SYSTEM_TRACKS: Record<string, string> = {
  control: `${AUDIO_BASE}/system-01-control.wav`,
  players: `${AUDIO_BASE}/system-02-players.wav`,
  memberships: `${AUDIO_BASE}/system-03-memberships.wav`,
  content: `${AUDIO_BASE}/system-04-content.wav`,
  rooms: `${AUDIO_BASE}/system-05-rooms.wav`,
  reports: `${AUDIO_BASE}/system-06-reports.wav`,
  ai: `${AUDIO_BASE}/system-07-ai.wav`,
  economy: `${AUDIO_BASE}/system-08-economy.wav`,
  analytics: `${AUDIO_BASE}/system-09-analytics.wav`,
  emergency: `${AUDIO_BASE}/system-10-emergency.wav`,
};

const TAP = `${AUDIO_BASE}/ui-tap.wav`;
const OK = `${AUDIO_BASE}/ui-success.wav`;
const FAIL = `${AUDIO_BASE}/ui-fail.wav`;
const AMBIENT = `${AUDIO_BASE}/ambient-mix.wav`;

let muted = false;

/** يقرأ تفضيل الكتم من التخزين المحلي عند أول استخدام */
function initMuted(): void {
  try {
    muted = typeof localStorage !== "undefined" && localStorage.getItem("harb-audio-muted") === "1";
  } catch {
    muted = false;
  }
}
initMuted();

function playFile(src: string, volume: number, loop = false): HTMLAudioElement {
  const a = new Audio(src);
  a.volume = Math.min(1, Math.max(0, volume));
  a.loop = loop;
  void a.play().catch(() => {
    /* المتصفح قد يمنع التشغيل التلقائي قبل أول تفاعل — لا مشكلة */
  });
  return a;
}

/** نغمة النظام عند فتحه */
export function playSystemSound(systemId: string): void {
  if (muted) return;
  const src = SYSTEM_TRACKS[systemId];
  if (src) playFile(src, 0.4);
}

/** نقرة واجهة خفيفة */
export function playTap(): void {
  if (muted) return;
  playFile(TAP, 0.3);
}

/** صوت نجاح الأمر */
export function playSuccess(): void {
  if (muted) return;
  playFile(OK, 0.45);
}

/** صوت فشل الأمر */
export function playFailure(): void {
  if (muted) return;
  playFile(FAIL, 0.45);
}

/** المزيج المحيطي — يُشغّل/يُوقف عبر زر الترويسة */
let ambientEl: HTMLAudioElement | null = null;
export function toggleAmbient(): boolean {
  if (!ambientEl) ambientEl = new Audio(AMBIENT);
  if (muted) {
    muted = false;
    try { localStorage.setItem("atlas-audio-muted", "0"); } catch { /* تجاهل */ }
  }
  if (ambientEl.paused) {
    ambientEl.loop = true;
    ambientEl.volume = 0.25;
    void ambientEl.play().catch(() => undefined);
    return true;
  }
  ambientEl.pause();
  return false;
}

export function isMuted(): boolean {
  return muted;
}
