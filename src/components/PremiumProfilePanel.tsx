import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Lock, Palette, Save, Sparkles, Eye, Swords, Loader2, Check } from "lucide-react";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🎨 التخصيص العميق للملف الشخصي — طبقة بريميوم حقيقية
 *
 *  • ثيمات حقيقية (لون تمييز + خلفية) تُفتح حسب العضوية الفعلية غير المنتهية
 *  • أنماط بطاقة استثنائية بمعاينة حيّة
 *  • نبذة شخصية (حتى 160 حرفاً) + تثبيت 3 شارات يملكها اللاعب فعلاً
 *  • تحكّم خصوصية حقيقي يُحترم على الخادم: من يرى إحصاءاتك، ومن يستطيع تحدّيك
 * ═══════════════════════════════════════════════════════════════════════
 */

const TIER_LABEL: Record<string, string> = {
  bronze: "برونزية",
  silver: "فضية",
  gold: "ذهبية",
  diamond: "ماسية",
  exclusive: "حصرية",
};

const CARD_CLASS: Record<string, string> = {
  classic: "rounded-3xl border border-border/70",
  royal: "rounded-3xl border-2 border-yellow-400/60",
  neon: "rounded-3xl border border-sky-400/50 shadow-[0_0_35px_-8px_rgba(96,165,250,0.75)]",
  midnight: "rounded-3xl border border-white/10 backdrop-blur-md",
  aurora: "rounded-3xl border-2 border-cyan-400/50",
};

export function PremiumProfilePanel() {
  const catalog = useQuery(api.profileCustomization.getCustomizationCatalog);
  const mine = useQuery(api.profileCustomization.getMyCustomization);
  const save = useMutation(api.profileCustomization.updateCustomization);

  const [hydrated, setHydrated] = useState(false);
  const [bio, setBio] = useState("");
  const [themeKey, setThemeKey] = useState<string | null>(null);
  const [cardStyle, setCardStyle] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string[]>([]);
  const [showStats, setShowStats] = useState(true);
  const [allowChallenges, setAllowChallenges] = useState(true);
  const [busy, setBusy] = useState(false);

  // نهيّئ الحقول مرة واحدة من الخادم ثم نترك اللاعب يتحرّر بالتحرير المحلي
  useEffect(() => {
    if (!catalog || hydrated) return;
    setBio(catalog.selected.bio);
    setThemeKey(catalog.selected.themeKey);
    setCardStyle(catalog.selected.cardStyle);
    setPinned(catalog.selected.pinnedBadges);
    setShowStats(catalog.selected.showStats);
    setAllowChallenges(catalog.selected.allowChallenges);
    setHydrated(true);
  }, [catalog, hydrated]);

  const activeThemeKey = themeKey ?? catalog?.selected.themeKey ?? "royal";
  const activeCard = cardStyle ?? catalog?.selected.cardStyle ?? "classic";
  const theme = catalog?.themes.find((t) => t.key === activeThemeKey) ?? catalog?.themes[0];
  const ownedBadges = mine?.ownedBadges ?? [];

  const togglePin = (badge: string) => {
    const max = catalog?.maxPinned ?? 3;
    setPinned((prev) => {
      if (prev.includes(badge)) return prev.filter((b) => b !== badge);
      if (prev.length >= max) {
        toast.error(`يمكنك تثبيت ${max} شارات فقط`);
        return prev;
      }
      return [...prev, badge];
    });
  };

  const onSave = async () => {
    setBusy(true);
    try {
      const r = await save({
        bio,
        themeKey: activeThemeKey,
        cardStyle: activeCard,
        pinnedBadges: pinned,
        showStats,
        allowChallenges,
      });
      const applied = (r as { applied?: string[] } | undefined)?.applied ?? [];
      toast.success(applied.length ? `حُفظ: ${applied.join(" · ")}` : "حُفظ تخصيص ملفك");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الحفظ");
    } finally {
      setBusy(false);
    }
  };

  if (catalog === undefined) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (catalog === null || !catalog.signedIn) return null;

  return (
    <div dir="rtl" className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Palette className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-bold tracking-tight">تخصيص ملفك العميق</h2>
          <p className="text-xs text-muted-foreground">
            ثيمك، نمط بطاقتك، نبذتك، وشاراتك المثبتة — وما يراه الآخرون عنك
          </p>
        </div>
        <Badge variant="outline" className="ms-auto rounded-full text-[10px]">
          {catalog.tierRank > 0 ? `عضويتك مفتوحة · رتبة ${catalog.tierRank}` : "بلا عضوية — ثيمات الأساس فقط"}
        </Badge>
      </div>

      {/* ═══ معاينة حيّة ═══ */}
      {theme && (
        <div
          className={cn("relative overflow-hidden p-4", CARD_CLASS[activeCard] ?? CARD_CLASS.classic)}
          style={{ background: theme.gradient }}
        >
          <div className="flex items-center gap-3">
            <span
              className="flex size-12 shrink-0 items-center justify-center rounded-2xl text-2xl"
              style={{ background: theme.accentSoft, border: `1px solid ${theme.accent}` }}
            >
              {theme.emoji}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-black" style={{ color: theme.accent }}>
                ملفك بالثيم {theme.name}
              </p>
              <p className="truncate text-[11px] text-white/70">{bio || "أضف نبذة قصيرة تعرّف بها نفسك…"}</p>
            </div>
          </div>
          {pinned.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {pinned.map((b) => (
                <Badge key={b} variant="outline" className="rounded-full text-[10px] text-white/80">
                  {b}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ الثيمات ═══ */}
      <div className="rounded-2xl border border-border/70 bg-card p-3">
        <p className="mb-2 flex items-center gap-2 text-xs font-bold">
          <Sparkles className="size-3.5 text-primary" /> الثيمات
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {catalog.themes.map((t) => {
            const active = activeThemeKey === t.key;
            return (
              <button
                key={t.key}
                type="button"
                disabled={!t.unlocked}
                onClick={() => (t.unlocked ? setThemeKey(t.key) : toast.error(`يتطلب عضوية ${TIER_LABEL[t.minTier ?? ""] ?? t.minTier}`))}
                className={cn(
                  "relative overflow-hidden rounded-xl border p-2.5 text-start transition-all",
                  active ? "border-primary ring-2 ring-primary/30" : "border-border/60 hover:border-border",
                  !t.unlocked && "opacity-60",
                )}
                style={{ background: t.gradient }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="flex size-7 shrink-0 items-center justify-center rounded-lg text-sm"
                    style={{ background: t.accentSoft, border: `1px solid ${t.accent}` }}
                  >
                    {t.emoji}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12px] font-bold text-white/90">{t.name}</span>
                  {active && <Check className="size-3.5 shrink-0" style={{ color: t.accent }} />}
                  {!t.unlocked && <Lock className="size-3.5 shrink-0 text-white/60" />}
                </div>
                <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-white/55">{t.desc}</p>
                {!t.unlocked && (
                  <span className="mt-1 inline-block rounded-full bg-black/40 px-2 py-0.5 text-[9px] text-white/70">
                    عضوية {TIER_LABEL[t.minTier ?? ""] ?? t.minTier}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══ نمط البطاقة ═══ */}
      <div className="rounded-2xl border border-border/70 bg-card p-3">
        <p className="mb-2 text-xs font-bold">نمط البطاقة</p>
        <div className="flex flex-wrap gap-1.5">
          {catalog.cards.map((c) => {
            const active = activeCard === c.key;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => (c.unlocked ? setCardStyle(c.key) : toast.error(`يتطلب عضوية ${TIER_LABEL[c.minTier ?? ""] ?? c.minTier}`))}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs transition",
                  active ? "border-primary bg-primary text-primary-foreground" : "border-border/60 bg-muted/40 hover:bg-muted",
                  !c.unlocked && "opacity-60",
                )}
                title={c.desc}
              >
                {!c.unlocked && <Lock className="me-1 inline size-3" />}
                {c.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══ النبذة ═══ */}
      <div className="rounded-2xl border border-border/70 bg-card p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-bold">نبذتك الشخصية</p>
          <span className={cn("text-[10px] tabular-nums", bio.length > (catalog.maxBio ?? 160) ? "text-rose-500" : "text-muted-foreground")}>
            {bio.length}/{catalog.maxBio ?? 160}
          </span>
        </div>
        <Textarea
          value={bio}
          onChange={(e) => setBio(e.target.value.slice(0, catalog.maxBio ?? 160))}
          placeholder="مثال: عقل استراتيجي يحب التحديات الصعبة…"
          className="min-h-16 text-sm"
        />
      </div>

      {/* ═══ الشارات المثبتة ═══ */}
      <div className="rounded-2xl border border-border/70 bg-card p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-bold">تثبيت الشارات ({pinned.length}/{catalog.maxPinned ?? 3})</p>
          <span className="text-[10px] text-muted-foreground">تظهر في مقدمة ملفك فقط</span>
        </div>
        {ownedBadges.length === 0 ? (
          <p className="rounded-lg border border-dashed p-3 text-center text-[11px] text-muted-foreground">
            لا تملك شارات بعد — العب وانتصر لتفتح شاراتك ثم ثبّتها هنا.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {ownedBadges.map((b) => {
              const on = pinned.includes(b);
              return (
                <button
                  key={b}
                  type="button"
                  onClick={() => togglePin(b)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs transition",
                    on ? "border-primary bg-primary text-primary-foreground" : "border-border/60 bg-muted/40 hover:bg-muted",
                  )}
                >
                  {on && <Check className="me-1 inline size-3" />}
                  {b}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══ الخصوصية ═══ */}
      <div className="rounded-2xl border border-border/70 bg-card p-3 space-y-3">
        <p className="text-xs font-bold">الخصوصية — تُحترم على الخادم فعلياً</p>
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-sm">
            <Eye className="size-3.5 text-muted-foreground" /> إظهار إحصاءاتي للآخرين
          </span>
          <Switch checked={showStats} onCheckedChange={setShowStats} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-sm">
            <Swords className="size-3.5 text-muted-foreground" /> السماح للآخرين بتحدّيي
          </span>
          <Switch checked={allowChallenges} onCheckedChange={setAllowChallenges} />
        </div>
        {!showStats && (
          <p className="text-[10px] text-muted-foreground/80">
            إحصاءاتك لن تُرسل لأي لاعب آخر — الخادم يخفيها قبل الإرسال.
          </p>
        )}
      </div>

      <Button onClick={onSave} disabled={busy} className="w-full gap-1.5 font-bold">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        حفظ تخصيص ملفي
      </Button>
    </div>
  );
}
