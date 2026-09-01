/**
 * ═══════════════════════════════════════════════════════════════
 * محرك الصوت البرمجي — Sound Engine
 * ═══════════════════════════════════════════════════════════════
 *
 * يُولّد جميع الأصوات برمجياً باستخدام Web Audio API
 * بدون ملفات صوتية خارجية — يعمل أوفلاين بالكامل.
 *
 * الميزات:
 * 1. موسيقى خلفية مولّدة برمجياً لكل قسم
 * 2. مؤثرات صوتية فورية للأحداث
 * 3. خلفيات صوتية طبيعية (مطر، نار، محيط...)
 * 4. تأثيرات انتقالية سلسة
 * 5. تحكم كامل بالصوت
 */

// ═══════════════════════════════════════════════════════════════
// الأنواع
// ═══════════════════════════════════════════════════════════════

export interface SoundSettings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  ambientVolume: number;
  muted: boolean;
  musicEnabled: boolean;
  sfxEnabled: boolean;
  ambientEnabled: boolean;
  reduceMotion: boolean;
  autoPlay: boolean;
  currentTrack?: string;
  currentAmbient?: string;
}

type SoundCategory = "music" | "sfx" | "ambient";

// ═══════════════════════════════════════════════════════════════
// المحرك الرئيسي
// ═══════════════════════════════════════════════════════════════

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private currentMusicOsc: OscillatorNode | null = null;
  private currentMusicGain: GainNode | null = null;
  private ambientNodes: (OscillatorNode | AudioBufferSourceNode)[] = [];
  private ambientGains: GainNode[] = [];
  private settings: SoundSettings = {
    masterVolume: 0.7,
    musicVolume: 0.5,
    sfxVolume: 0.6,
    ambientVolume: 0.3,
    muted: false,
    musicEnabled: true,
    sfxEnabled: true,
    ambientEnabled: true,
    reduceMotion: false,
    autoPlay: true,
  };
  private initialized = false;

  /** تهيئة المحرك */
  init() {
    if (this.initialized) return;
    try {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.ambientGain = this.ctx.createGain();

      this.musicGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.ambientGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      this.updateGains();
      this.initialized = true;
    } catch {
      // المتصفح لا يدعم Web Audio
    }
  }

  /** استئناف السياق (مطلوب بعد تفاعل المستخدم) */
  resume() {
    if (this.ctx?.state === "suspended") {
      this.ctx.resume();
    }
  }

  /** تحديث مستوى الصوت */
  updateSettings(settings: Partial<SoundSettings>) {
    this.settings = { ...this.settings, ...settings };
    this.updateGains();
  }

  private updateGains() {
    const s = this.settings;
    const master = s.muted ? 0 : s.masterVolume;
    if (this.masterGain) this.masterGain.gain.value = master;
    if (this.musicGain) this.musicGain.gain.value = s.musicVolume;
    if (this.sfxGain) this.sfxGain.gain.value = s.sfxVolume;
    if (this.ambientGain) this.ambientGain.gain.value = s.ambientVolume;
  }

  // ═══════════════════════════════════════════════════════════════
  // المؤثرات الصوتية (SFX)
  // ═══════════════════════════════════════════════════════════════

  /** تشغيل مؤثر صوتي */
  playSfx(type: string) {
    if (!this.ctx || !this.sfxGain || !this.settings.sfxEnabled) return;
    this.resume();

    const now = this.ctx.currentTime;

    switch (type) {
      case "click":
        this.playTone(800, 0.06, "sine", 0.3);
        break;
      case "hover":
        this.playTone(600, 0.03, "sine", 0.15);
        break;
      case "success":
        this.playTone(523, 0.1, "sine", 0.4);
        this.playTone(659, 0.1, "sine", 0.4, 0.1);
        this.playTone(784, 0.15, "sine", 0.5, 0.2);
        break;
      case "error":
        this.playTone(300, 0.15, "sawtooth", 0.3);
        this.playTone(250, 0.15, "sawtooth", 0.3, 0.15);
        break;
      case "level_up":
        this.playTone(440, 0.08, "sine", 0.4);
        this.playTone(554, 0.08, "sine", 0.4, 0.08);
        this.playTone(659, 0.08, "sine", 0.4, 0.16);
        this.playTone(880, 0.2, "sine", 0.5, 0.24);
        break;
      case "achievement":
        [523, 659, 784, 1047].forEach((f, i) => {
          this.playTone(f, 0.12, "sine", 0.35, i * 0.08);
        });
        break;
      case "win":
        [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => {
          this.playTone(f, 0.1, "triangle", 0.4, i * 0.07);
        });
        break;
      case "lose":
        this.playTone(400, 0.2, "sine", 0.3);
        this.playTone(350, 0.2, "sine", 0.3, 0.2);
        this.playTone(300, 0.3, "sine", 0.25, 0.4);
        break;
      case "notification":
        this.playTone(880, 0.08, "sine", 0.3);
        this.playTone(1100, 0.12, "sine", 0.35, 0.08);
        break;
      case "report":
        this.playTone(600, 0.05, "square", 0.3);
        this.playTone(800, 0.05, "square", 0.3, 0.06);
        this.playTone(600, 0.05, "square", 0.3, 0.12);
        this.playTone(800, 0.08, "square", 0.35, 0.18);
        break;
      case "gift":
        this.playTone(660, 0.08, "sine", 0.35);
        this.playTone(880, 0.08, "sine", 0.35, 0.08);
        this.playTone(1100, 0.15, "sine", 0.4, 0.16);
        break;
      case "coin":
        this.playTone(1200, 0.04, "sine", 0.3);
        this.playTone(1600, 0.06, "sine", 0.25, 0.04);
        break;
      case "unlock":
        this.playTone(440, 0.1, "triangle", 0.35);
        this.playTone(554, 0.1, "triangle", 0.35, 0.1);
        this.playTone(659, 0.1, "triangle", 0.35, 0.2);
        this.playTone(880, 0.2, "triangle", 0.45, 0.3);
        break;
      case "fanfare":
        [523, 659, 784, 1047, 784, 1047, 1319, 1047, 1319, 1568].forEach((f, i) => {
          this.playTone(f, 0.1, "triangle", 0.4, i * 0.06);
        });
        break;
      case "whoosh":
        this.playNoise(0.15, 800, 2000);
        break;
      default:
        this.playTone(600, 0.05, "sine", 0.2);
    }
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    delay = 0,
  ) {
    if (!this.ctx || !this.sfxGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, this.ctx.currentTime + delay);
    gain.gain.linearRampToValueAtTime(volume, this.ctx.currentTime + delay + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + delay + duration);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(this.ctx.currentTime + delay);
    osc.stop(this.ctx.currentTime + delay + duration + 0.01);
  }

  private playNoise(duration: number, lowFreq: number, highFreq: number) {
    if (!this.ctx || !this.sfxGain) return;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.3;
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = (lowFreq + highFreq) / 2;
    filter.Q.value = 1;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.2, this.ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    source.start();
  }

  // ═══════════════════════════════════════════════════════════════
  // موسيقى الخلفية (Music)
  // ═══════════════════════════════════════════════════════════════

  /** تشغيل موسيقى حسب النوع */
  playMusic(trackId: string) {
    if (!this.ctx || !this.musicGain || !this.settings.musicEnabled) return;
    this.resume();
    this.stopMusic();

    // إنشاء موسيقى برمجية حسب المسار
    const patterns: Record<string, () => void> = {
      epic_main: () => this.playEpicPattern(),
      chill_lobby: () => this.playChillPattern(),
      intense_battle: () => this.playBattlePattern(),
      mystery_quiz: () => this.playMysteryPattern(),
      celebration: () => this.playCelebrationPattern(),
      dark_owner: () => this.playDarkPattern(),
      ambient_nature: () => this.playNaturePattern(),
      cyber_punk: () => this.playCyberPattern(),
    };

    (patterns[trackId] || patterns.epic_main)();
  }

  private playEpicPattern() {
    // أنماط موسيقية بسيطة باستخدام oscillators
    this.loopArpeggio([261, 329, 392, 523], 0.3, 0.12, "triangle");
  }

  private playChillPattern() {
    this.loopArpeggio([220, 277, 329, 440], 0.5, 0.1, "sine");
  }

  private playBattlePattern() {
    this.loopArpeggio([196, 233, 293, 349], 0.2, 0.15, "sawtooth");
  }

  private playMysteryPattern() {
    this.loopArpeggio([261, 311, 370, 466], 0.4, 0.08, "sine");
  }

  private playCelebrationPattern() {
    this.loopArpeggio([329, 392, 493, 659], 0.25, 0.14, "triangle");
  }

  private playDarkPattern() {
    this.loopArpeggio([130, 155, 196, 233], 0.6, 0.1, "sine");
  }

  private playNaturePattern() {
    this.loopArpeggio([174, 220, 261, 349], 0.7, 0.08, "sine");
  }

  private playCyberPattern() {
    this.loopArpeggio([220, 277, 349, 440], 0.2, 0.12, "square");
  }

  private loopArpeggio(
    notes: number[],
    beatDuration: number,
    noteVolume: number,
    waveType: OscillatorType,
  ) {
    if (!this.ctx || !this.musicGain) return;

    let noteIndex = 0;
    const playNext = () => {
      if (!this.ctx || !this.musicGain) return;
      const freq = notes[noteIndex % notes.length];
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = waveType;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(noteVolume, this.ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + beatDuration * 0.9);
      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start();
      osc.stop(this.ctx.currentTime + beatDuration);
      noteIndex++;
      this.currentMusicOsc = osc;
      this.currentMusicGain = gain;
    };

    playNext();
    const interval = setInterval(() => {
      if (!this.settings.musicEnabled || this.settings.muted) {
        clearInterval(interval);
        return;
      }
      playNext();
    }, beatDuration * 1000);

    // حفظ مرجع للوقت
    (this as any)._musicInterval = interval;
  }

  stopMusic() {
    if ((this as any)._musicInterval) {
      clearInterval((this as any)._musicInterval);
      (this as any)._musicInterval = null;
    }
    try {
      this.currentMusicOsc?.stop();
    } catch {}
    this.currentMusicOsc = null;
  }

  // ═══════════════════════════════════════════════════════════════
  // الخلفيات الصوتية (Ambient)
  // ═══════════════════════════════════════════════════════════════

  /** تشغيل خلفية صوتية */
  playAmbient(patternId: string) {
    if (!this.ctx || !this.ambientGain || !this.settings.ambientEnabled) return;
    this.resume();
    this.stopAmbient();

    const generators: Record<string, () => void> = {
      rain: () => this.generateRain(),
      forest: () => this.generateForest(),
      fire: () => this.generateFire(),
      ocean: () => this.generateOcean(),
      wind: () => this.generateWind(),
      thunder: () => this.generateThunder(),
      city: () => this.generateCity(),
      space: () => this.generateSpace(),
    };

    (generators[patternId] || generators.rain)();
  }

  private generateRain() {
    if (!this.ctx || !this.ambientGain) return;
    // Noise-based rain sound
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.15;
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 3000;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.3;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.ambientGain);
    source.start();
    this.ambientNodes.push(source);
    this.ambientGains.push(gain);
  }

  private generateForest() {
    if (!this.ctx || !this.ambientGain) return;
    // Gentle high-frequency chirps
    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 2000;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.05;
    // Modulate for bird-like effect
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 3;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 200;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    lfo.start();
    osc.connect(gain);
    gain.connect(this.ambientGain);
    osc.start();
    this.ambientNodes.push(osc, lfo);
    this.ambientGains.push(gain);
  }

  private generateFire() {
    if (!this.ctx || !this.ambientGain) return;
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.1;
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 500;
    filter.Q.value = 2;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.25;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.ambientGain);
    source.start();
    this.ambientNodes.push(source);
    this.ambientGains.push(gain);
  }

  private generateOcean() {
    if (!this.ctx || !this.ambientGain) return;
    const bufferSize = this.ctx.sampleRate * 3;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const t = i / this.ctx.sampleRate;
      const wave = Math.sin(t * 0.5) * 0.5 + 0.5;
      data[i] = (Math.random() * 2 - 1) * 0.12 * wave;
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1500;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.3;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.ambientGain);
    source.start();
    this.ambientNodes.push(source);
    this.ambientGains.push(gain);
  }

  private generateWind() {
    if (!this.ctx || !this.ambientGain) return;
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.08;
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 800;
    filter.Q.value = 0.5;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.2;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.ambientGain);
    source.start();
    this.ambientNodes.push(source);
    this.ambientGains.push(gain);
  }

  private generateThunder() {
    this.generateRain();
    // Add periodic thunder rumbles
    const thunderInterval = setInterval(() => {
      if (!this.ctx || !this.ambientGain) return;
      const bufferSize = this.ctx.sampleRate * 1;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        const t = i / this.ctx.sampleRate;
        data[i] = (Math.random() * 2 - 1) * 0.4 * Math.exp(-t * 3);
      }
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      const gain = this.ctx.createGain();
      gain.gain.value = 0.15;
      source.connect(gain);
      gain.connect(this.ambientGain!);
      source.start();
    }, 8000 + Math.random() * 12000);
    (this as any)._thunderInterval = thunderInterval;
  }

  private generateCity() {
    if (!this.ctx || !this.ambientGain) return;
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.06;
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 600;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.15;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.ambientGain);
    source.start();
    this.ambientNodes.push(source);
    this.ambientGains.push(gain);
  }

  private generateSpace() {
    if (!this.ctx || !this.ambientGain) return;
    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 110;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.08;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.1;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 20;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    lfo.start();
    osc.connect(gain);
    gain.connect(this.ambientGain);
    osc.start();
    this.ambientNodes.push(osc, lfo);
    this.ambientGains.push(gain);
  }

  stopAmbient() {
    this.ambientNodes.forEach((n) => {
      try { n.stop(); } catch {}
    });
    this.ambientNodes = [];
    this.ambientGains = [];
    if ((this as any)._thunderInterval) {
      clearInterval((this as any)._thunderInterval);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // التحكم العام
  // ═══════════════════════════════════════════════════════════════

  stopAll() {
    this.stopMusic();
    this.stopAmbient();
  }

  destroy() {
    this.stopAll();
    this.ctx?.close();
    this.initialized = false;
  }
}

// ═══════════════════════════════════════════════════════════════
// نسخة واحدة مشتركة
// ═══════════════════════════════════════════════════════════════

export const soundEngine = new SoundEngine();
