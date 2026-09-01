/**
 * ═══════════════════════════════════════════════════════════════
 * لوحة تحكم الصوت البريميوم
 * ═══════════════════════════════════════════════════════════════
 *
 * تحكم كامل في كل الأصوات مع معاينة حية:
 * 1. الصوت الرئيسي + كتم شامل
 * 2. موسيقى الخلفية مع اختيار مسار
 * 3. المؤثرات الصوتية مع معاينة
 * 4. الخلفيات الصوتية مع معاينة
 * 5. موسيقى كل قسم على حدة
 */

import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { soundEngine, type SoundSettings } from "@/lib/soundEngine";
import { motion } from "framer-motion";
import {
  Volume2,
  VolumeX,
  Music,
  Headphones,
  Waves,
  Play,
  Pause,
  Volume1,
  Volume,
  Radio,
  TreePine,
  Flame,
  Droplets,
  Wind,
  CloudRain,
  CloudLightning,
  Building2,
  Sparkles,
  Settings,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════
// المكونات المساعدة
// ═══════════════════════════════════════════════════════════════

function VolumeSlider({
  label,
  icon: Icon,
  value,
  onChange,
  color = "primary",
}: {
  label: string;
  icon: React.ElementType;
  value: number;
  onChange: (v: number) => void;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg",
        color === "primary" && "bg-primary/10 text-primary",
        color === "blue" && "bg-blue-500/10 text-blue-600",
        color === "emerald" && "bg-emerald-500/10 text-emerald-600",
        color === "amber" && "bg-amber-500/10 text-amber-600",
      )}>
        <Icon className="size-4" />
      </span>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium">{label}</span>
          <span className="text-[10px] text-muted-foreground tabular-nums">{Math.round(value * 100)}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full h-1.5 rounded-full bg-muted appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-sm"
        />
      </div>
    </div>
  );
}

function TrackButton({
  track,
  isActive,
  onClick,
}: {
  track: { id: string; name: string; bpm: number; mood: string };
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-all",
        isActive
          ? "bg-primary/10 text-primary ring-1 ring-primary/30"
          : "bg-muted/30 text-muted-foreground hover:bg-muted/50",
      )}
    >
      <Play className="size-3" />
      <span className="flex-1 text-start truncate">{track.name}</span>
      <span className="text-[10px] tabular-nums">{track.bpm} BPM</span>
    </button>
  );
}

function SfxButton({
  sfx,
  onClick,
}: {
  sfx: { id: string; name: string; icon: string };
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded-xl bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground transition-all hover:bg-muted/50 hover:text-foreground active:scale-95"
    >
      <span className="text-base">{sfx.icon}</span>
      <span>{sfx.name}</span>
    </button>
  );
}

const AMBIENT_ICONS: Record<string, React.ElementType> = {
  rain: CloudRain,
  forest: TreePine,
  fire: Flame,
  ocean: Droplets,
  wind: Wind,
  thunder: CloudLightning,
  city: Building2,
  space: Sparkles,
};

function AmbientButton({
  pattern,
  isActive,
  onClick,
}: {
  pattern: { id: string; name: string; icon: string; description: string };
  isActive: boolean;
  onClick: () => void;
}) {
  const Icon = AMBIENT_ICONS[pattern.id] || Waves;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1.5 rounded-xl p-3 transition-all",
        isActive
          ? "bg-primary/10 text-primary ring-1 ring-primary/30"
          : "bg-muted/30 text-muted-foreground hover:bg-muted/50",
      )}
    >
      <span className="text-xl">{pattern.icon}</span>
      <span className="text-[10px] font-medium">{pattern.name.replace(/^[^\s]+\s/, "")}</span>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════
// المكون الرئيسي
// ═══════════════════════════════════════════════════════════════

export function SoundControlPanel() {
  const serverSettings = useQuery(api.sounds.getSoundSettings);
  const updateSettings = useMutation(api.sounds.updateSoundSettings);
  const toggleMuteMutation = useMutation(api.sounds.toggleMute);
  const tracks = useQuery(api.sounds.getAvailableTracks);
  const sfxList = useQuery(api.sounds.getAvailableSfx);
  const ambientList = useQuery(api.sounds.getAmbientPatterns);

  const [settings, setSettings] = useState<SoundSettings>({
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
  });
  const [activeTrack, setActiveTrack] = useState("epic_main");
  const [activeAmbient, setActiveAmbient] = useState("");
  const [playing, setPlaying] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // تحميل الإعدادات من الخادم
  useEffect(() => {
    if (serverSettings) {
      setSettings(serverSettings);
      soundEngine.updateSettings(serverSettings);
      if (serverSettings.currentTrack) setActiveTrack(serverSettings.currentTrack);
      if (serverSettings.currentAmbient) setActiveAmbient(serverSettings.currentAmbient);
    }
  }, [serverSettings]);

  const initAudio = useCallback(() => {
    if (!initialized) {
      soundEngine.init();
      setInitialized(true);
    }
    soundEngine.resume();
  }, [initialized]);

  // ── تحديث الإعدادات ──
  const update = async (patch: Partial<SoundSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    soundEngine.updateSettings(next);
    try { await updateSettings({ settings: next }); } catch {}
  };

  // ── تشغيل/إيقاف الموسيقى ──
  const handlePlayMusic = () => {
    initAudio();
    if (playing) {
      soundEngine.stopMusic();
      setPlaying(false);
    } else {
      soundEngine.playMusic(activeTrack);
      setPlaying(true);
    }
  };

  const handleSelectTrack = (trackId: string) => {
    setActiveTrack(trackId);
    if (playing) {
      soundEngine.playMusic(trackId);
    }
    update({ currentTrack: trackId });
  };

  // ── تشغيل SFX ──
  const handlePlaySfx = (sfxId: string) => {
    initAudio();
    soundEngine.playSfx(sfxId);
  };

  // ── تشغيل Ambient ──
  const handleSelectAmbient = (patternId: string) => {
    initAudio();
    if (activeAmbient === patternId) {
      soundEngine.stopAmbient();
      setActiveAmbient("");
      update({ currentAmbient: "" });
    } else {
      soundEngine.playAmbient(patternId);
      setActiveAmbient(patternId);
      update({ currentAmbient: patternId });
    }
  };

  // ── كتم شامل ──
  const handleToggleMute = async () => {
    initAudio();
    const newMuted = !settings.muted;
    update({ muted: newMuted });
    try { await toggleMuteMutation(); } catch {}
  };

  // ── إعادة تعيين ──
  const handleReset = () => {
    const defaults: SoundSettings = {
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
    setSettings(defaults);
    soundEngine.updateSettings(defaults);
    soundEngine.stopAll();
    setPlaying(false);
    setActiveAmbient("");
    update(defaults);
  };

  return (
    <div dir="rtl" className="space-y-6">
      {/* ── العنوان ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Music className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold">نظام الصوتيات</h2>
            <p className="text-xs text-muted-foreground">تحكم كامل في كل الأصوات والم music</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
        >
          <RotateCcw className="size-3.5" />
          إعادة تعيين
        </button>
      </div>

      {/* ── الصوت الرئيسي ── */}
      <div className="rounded-2xl border border-border/60 bg-card/80 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <Volume2 className="size-4 text-primary" />
            التحكم الرئيسي
          </h3>
          <button
            type="button"
            onClick={handleToggleMute}
            className={cn(
              "flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all",
              settings.muted
                ? "bg-rose-500/10 text-rose-600"
                : "bg-emerald-500/10 text-emerald-600",
            )}
          >
            {settings.muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
            {settings.muted ? "مكتوم" : "مفعّل"}
          </button>
        </div>

        <div className="space-y-4">
          <VolumeSlider
            label="الصوت الرئيسي"
            icon={Volume2}
            value={settings.masterVolume}
            onChange={(v) => update({ masterVolume: v })}
            color="primary"
          />
          <VolumeSlider
            label="الموسيقى"
            icon={Music}
            value={settings.musicVolume}
            onChange={(v) => update({ musicVolume: v })}
            color="blue"
          />
          <VolumeSlider
            label="المؤثرات"
            icon={Headphones}
            value={settings.sfxVolume}
            onChange={(v) => update({ sfxVolume: v })}
            color="emerald"
          />
          <VolumeSlider
            label="الخلفيات"
            icon={Waves}
            value={settings.ambientVolume}
            onChange={(v) => update({ ambientVolume: v })}
            color="amber"
          />
        </div>
      </div>

      {/* ── موسيقى الخلفية ── */}
      <div className="rounded-2xl border border-border/60 bg-card/80 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <Radio className="size-4 text-blue-600" />
            موسيقى الخلفية
          </h3>
          <button
            type="button"
            onClick={handlePlayMusic}
            className={cn(
              "flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all",
              playing
                ? "bg-primary text-primary-foreground"
                : "bg-primary/10 text-primary",
            )}
          >
            {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
            {playing ? "إيقاف" : "تشغيل"}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {tracks?.map((track) => (
            <TrackButton
              key={track.id}
              track={track}
              isActive={activeTrack === track.id}
              onClick={() => handleSelectTrack(track.id)}
            />
          ))}
        </div>
      </div>

      {/* ── المؤثرات الصوتية ── */}
      <div className="rounded-2xl border border-border/60 bg-card/80 p-5">
        <h3 className="flex items-center gap-2 text-sm font-bold mb-4">
          <Headphones className="size-4 text-emerald-600" />
          المؤثرات الصوتية — اضغط لمعاينة
        </h3>
        <div className="flex flex-wrap gap-2">
          {sfxList?.map((sfx) => (
            <SfxButton
              key={sfx.id}
              sfx={sfx}
              onClick={() => handlePlaySfx(sfx.id)}
            />
          ))}
        </div>
      </div>

      {/* ── الخلفيات الصوتية ── */}
      <div className="rounded-2xl border border-border/60 bg-card/80 p-5">
        <h3 className="flex items-center gap-2 text-sm font-bold mb-4">
          <Waves className="size-4 text-amber-600" />
          الخلفيات الصوتية
        </h3>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          {ambientList?.map((pattern) => (
            <AmbientButton
              key={pattern.id}
              pattern={pattern}
              isActive={activeAmbient === pattern.id}
              onClick={() => handleSelectAmbient(pattern.id)}
            />
          ))}
        </div>
        {activeAmbient && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 text-center text-[11px] text-muted-foreground"
          >
            🔊 الخلفية النشطة: {ambientList?.find((a) => a.id === activeAmbient)?.name}
            {" — "}
            <button
              type="button"
              onClick={() => handleSelectAmbient(activeAmbient)}
              className="text-rose-500 hover:underline"
            >
              إيقاف
            </button>
          </motion.p>
        )}
      </div>

      {/* ── الإعدادات ── */}
      <div className="rounded-2xl border border-border/60 bg-card/80 p-5">
        <h3 className="flex items-center gap-2 text-sm font-bold mb-4">
          <Settings className="size-4 text-primary" />
          إعدادات متقدمة
        </h3>
        <div className="space-y-3">
          <label className="flex items-center justify-between">
            <span className="text-xs font-medium">تشغيل تلقائي عند الدخول</span>
            <input
              type="checkbox"
              checked={settings.autoPlay}
              onChange={(e) => update({ autoPlay: e.target.checked })}
              className="size-4 rounded border-border"
            />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-xs font-medium">تقليل الحركة (Reduce Motion)</span>
            <input
              type="checkbox"
              checked={settings.reduceMotion}
              onChange={(e) => update({ reduceMotion: e.target.checked })}
              className="size-4 rounded border-border"
            />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-xs font-medium">تفعيل المؤثرات</span>
            <input
              type="checkbox"
              checked={settings.sfxEnabled}
              onChange={(e) => update({ sfxEnabled: e.target.checked })}
              className="size-4 rounded border-border"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
