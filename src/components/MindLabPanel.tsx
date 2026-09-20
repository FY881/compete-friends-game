import { useState } from "react";
import { toast } from "sonner";
import {
  FACULTIES,
  MAX_EQUIPPED,
  MASTERY_TIERS,
  SPECIALIZATIONS,
  describeEffect,
  domainMastery,
  equipSpecialization,
  equippedSpecializations,
  facultyProgress,
  masteryTierIndex,
  mindEffect,
  mindIdentity,
  mindTierScore,
  unequipSpecialization,
  unlockedSpecializations,
  useEvolvedMind,
  type FacultyId,
  type MindState,
  type SpecializationDef,
} from "@/lib/evolvedMind";
import { useLocalGame } from "@/lib/localEngine";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Brain, Check, Lock, Sparkles, Target, Wand2 } from "lucide-react";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🧬 مختبر العقل المتطور — قلب التقدّم الشخصي
 * ═══════════════════════════════════════════════════════════════════════
 * كل رقم هنا مشتقّ من إجابات حقيقية سجّلها المحرك المحلي، وكل تخصص
 * يمكن تجهيزه له تأثير مقيس داخل الجولة (خبرة، عملات، ثوانٍ، دروع).
 */

export function MindLabPanel() {
  const mind = useEvolvedMind();
  const save = useLocalGame();
  const [tab, setTab] = useState<"faculties" | "specs" | "domains">("faculties");

  const identity = mindIdentity(mind);
  const effect = mindEffect(mind);
  const unlocked = unlockedSpecializations(mind);
  const equipped = equippedSpecializations(mind);
  const tierScore = mindTierScore(mind);
  const maxTierScore = FACULTIES.length * 12;

  const emptySlots = Math.max(0, MAX_EQUIPPED - equipped.length);

  const toggleEquip = (def: SpecializationDef) => {
    if (equipped.some((e) => e.id === def.id)) {
      unequipSpecialization(def.id);
      toast.info(`أُزيل ${def.name} من التجهيز`);
      return;
    }
    const res = equipSpecialization(def.id);
    if (res === "full") {
      toast.error(`المقاعد ممتلئة (${MAX_EQUIPPED}) — أزل تخصصاً أولاً`);
      return;
    }
    if (res === "not_unlocked") {
      toast.error("هذا التخصص لم يُفتح بعد");
      return;
    }
    toast.success(`جُهّز ${def.icon} ${def.name} — تأثيره يعمل من الجولة القادمة`);
  };

  const domains = Object.entries(save.stats.categories)
    .map(([category, c]) => ({ category, c, mastery: domainMastery(c) }))
    .sort((a, b) => b.mastery - a.mastery || b.c.answered - a.c.answered);

  return (
    <div className="space-y-5">
      {/* ── هوية العقل ومقياس تطوّره ── */}
      <Card className="overflow-hidden border-border/70 shadow-sm">
        <div className="h-1.5 w-full bg-gradient-to-l from-violet-500/70 via-violet-500/25 to-transparent" />
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-violet-500/10 text-2xl">
              {identity.icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-violet-600 dark:text-violet-400">هوية عقلك</p>
              <h2 className="truncate text-lg font-black tracking-tight">{identity.title}</h2>
              <p className="truncate text-[11px] text-muted-foreground">{identity.description}</p>
            </div>
            <Badge variant="outline" className="rounded-full border-violet-500/30 bg-violet-500/10 text-[11px] font-bold">
              مستوى العقل {tierScore}/{maxTierScore}
            </Badge>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>تطوّر العقل الكلي (مجموع مستويات القوى الست)</span>
              <span className="font-bold tabular-nums">{Math.round((tierScore / maxTierScore) * 100)}%</span>
            </div>
            <Progress value={(tierScore / maxTierScore) * 100} className="h-2" />
          </div>

          {/* الأثر الفعلي الحالي — دليل أن النظام يغيّر اللعب */}
          <div className="rounded-2xl border border-border/70 bg-muted/25 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold">
              <Sparkles className="size-3.5 text-violet-500" /> أثر عقلك الحالي داخل الجولات
            </p>
            {describeEffect(effect).length === 0 ? (
              <p className="text-[11px] text-muted-foreground">
                لا تأثيرات بعد — العب جولات لتبدأ قواك بالتصاعد وفتح التخصصات
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {describeEffect(effect).map((line) => (
                  <span
                    key={line}
                    className="rounded-full border border-violet-500/30 bg-card px-2 py-0.5 text-[10px] font-bold tabular-nums"
                  >
                    {line}
                  </span>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── التبويبات الداخلية ── */}
      <div className="flex gap-1">
        {(
          [
            { id: "faculties", label: "القوى الست", icon: <Brain className="size-3.5" /> },
            { id: "specs", label: `التخصصات (${unlocked.length}/${SPECIALIZATIONS.length})`, icon: <Wand2 className="size-3.5" /> },
            { id: "domains", label: "إتقان المجالات", icon: <Target className="size-3.5" /> },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-colors",
              tab === t.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/60",
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {tab === "faculties" && <FacultiesSection mind={mind} />}
      {tab === "specs" && (
        <SpecsSection mind={mind} equipped={equipped} emptySlots={emptySlots} onToggle={toggleEquip} />
      )}
      {tab === "domains" && <DomainsSection domains={domains} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// القوى الست
// ═══════════════════════════════════════════════════════════════════════

function FacultiesSection({ mind }: { mind: MindState }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {FACULTIES.map((f) => {
        const xp = mind.faculty[f.id as FacultyId] ?? 0;
        const p = facultyProgress(xp);
        return (
          <Card key={f.id} className="border-border/70 shadow-sm">
            <CardContent className="space-y-2 p-4">
              <div className="flex items-center gap-2.5">
                <span className={cn("flex size-9 items-center justify-center rounded-xl bg-muted/50 text-lg")}>
                  {f.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{f.name}</p>
                  <p className={cn("text-[10px] font-bold tabular-nums", f.text)}>
                    المستوى {p.level}
                    {p.maxed ? " · مكتمل" : ` · ${p.into}/${p.needed} XP`}
                  </p>
                </div>
                <span className="shrink-0 text-[10px] font-bold tabular-nums text-muted-foreground">{xp} XP</span>
              </div>

              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full transition-all", f.bar)}
                  style={{ width: `${Math.round(p.progress * 100)}%` }}
                />
              </div>

              <p className="text-[10px] leading-relaxed text-muted-foreground">🔹 {f.source}</p>
              <p className={cn("text-[10px] font-bold", f.text)}>🎁 {f.passive}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// التخصصات والتجهيز
// ═══════════════════════════════════════════════════════════════════════

const TIER_TONE: Record<SpecializationDef["tier"], string> = {
  برونزي: "border-amber-700/30 bg-amber-700/5 text-amber-800 dark:text-amber-400",
  فضي: "border-slate-400/40 bg-slate-400/10 text-slate-700 dark:text-slate-300",
  ذهبي: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  أسطوري: "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-400",
};

function SpecsSection({
  mind,
  equipped,
  emptySlots,
  onToggle,
}: {
  mind: MindState;
  equipped: SpecializationDef[];
  emptySlots: number;
  onToggle: (def: SpecializationDef) => void;
}) {
  return (
    <div className="space-y-4">
      {/* المقاعد المجهّزة */}
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-sm">
            <span>مقاعد التجهيز ({equipped.length}/{MAX_EQUIPPED})</span>
            {emptySlots > 0 && (
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                {emptySlots} مقعد فارغ
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-3">
          {Array.from({ length: MAX_EQUIPPED }).map((_, i) => {
            const spec = equipped[i];
            return (
              <div
                key={i}
                className={cn(
                  "rounded-2xl border p-3 text-center",
                  spec ? "border-violet-500/30 bg-violet-500/5" : "border-dashed border-border/70",
                )}
              >
                {spec ? (
                  <>
                    <p className="text-xl">{spec.icon}</p>
                    <p className="truncate text-xs font-bold">{spec.name}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">{describeEffect(spec.effect).join(" · ")}</p>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="mt-1.5 h-6 text-[10px]"
                      onClick={() => onToggle(spec)}
                    >
                      إزالة
                    </Button>
                  </>
                ) : (
                  <p className="py-4 text-[11px] text-muted-foreground">مقعد فارغ</p>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* كتالوج التخصصات */}
      <div className="grid gap-2 sm:grid-cols-2">
        {SPECIALIZATIONS.map((def) => {
          const isOpen = unlockedSpecializations(mind).some((s) => s.id === def.id);
          const isOn = equipped.some((s) => s.id === def.id);
          return (
            <Card
              key={def.id}
              className={cn("border shadow-sm", isOpen ? "border-border/70" : "border-border/50 opacity-80")}
            >
              <CardContent className="space-y-2 p-4">
                <div className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-xl text-lg",
                      isOpen ? "bg-violet-500/10" : "bg-muted/50 grayscale",
                    )}
                  >
                    {isOpen ? def.icon : <Lock className="size-4 text-muted-foreground" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{def.name}</p>
                    <Badge variant="outline" className={cn("rounded-full text-[9px]", TIER_TONE[def.tier])}>
                      {def.tier}
                    </Badge>
                  </div>
                </div>

                <p className="text-[11px] leading-relaxed text-muted-foreground">{def.description}</p>

                <div className="flex flex-wrap gap-1.5">
                  {describeEffect(def.effect).map((line) => (
                    <span key={line} className="rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-bold tabular-nums">
                      {line}
                    </span>
                  ))}
                </div>

                <div className="space-y-0.5">
                  {def.requires.map((r) => {
                    const meta = FACULTIES.find((f) => f.id === r.faculty);
                    const lvl = facultyProgress(mind.faculty[r.faculty] ?? 0).level;
                    const ok = lvl >= r.level;
                    return (
                      <p
                        key={r.faculty}
                        className={cn("text-[10px] font-bold", ok ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}
                      >
                        {ok ? "✔" : "•"} {meta?.icon} {meta?.name} مستوى {r.level} (لديك {lvl})
                      </p>
                    );
                  })}
                </div>

                <Button
                  size="sm"
                  variant={isOn ? "secondary" : "default"}
                  className="w-full gap-1.5"
                  disabled={!isOpen}
                  onClick={() => onToggle(def)}
                >
                  {isOn ? (
                    <>
                      <Check className="size-3.5" /> مُجهّز — إزالة
                    </>
                  ) : isOpen ? (
                    "تجهيز"
                  ) : (
                    "مقفل"
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// إتقان المجالات
// ═══════════════════════════════════════════════════════════════════════

function DomainsSection({
  domains,
}: {
  domains: { category: string; c: { answered: number; correct: number }; mastery: number }[];
}) {
  const tracked = domains.filter((d) => d.c.answered > 0);
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border/70 bg-muted/25 p-3">
        <p className="text-[11px] font-bold">رتب الإتقان</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {MASTERY_TIERS.map((t) => (
            <span key={t.name} className="rounded-full bg-card px-2 py-0.5 text-[10px] font-bold">
              {t.icon} {t.name} · {t.min}+ · +{t.reward} عملة
            </span>
          ))}
        </div>
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          الإتقان = دقتك في المجال (70%) + حجم تدريبك فيه (30%) — ولا يُحتسب قبل 5 إجابات
        </p>
      </div>

      {tracked.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
          لا مجالات مُتدرَّب عليها بعد — العب جولة ليبدأ احتساب إتقانك
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {tracked.map(({ category, c, mastery }) => {
            const tier = MASTERY_TIERS[masteryTierIndex(mastery)];
            const acc = Math.round((c.correct / Math.max(1, c.answered)) * 100);
            return (
              <div key={category} className="rounded-2xl border border-border/70 bg-card p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-sm font-bold">{category}</p>
                  <span className="shrink-0 text-[10px] font-bold">
                    {tier.icon} {tier.name}
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-gradient-to-l from-violet-500 to-sky-500" style={{ width: `${mastery}%` }} />
                </div>
                <p className="mt-1.5 text-[10px] tabular-nums text-muted-foreground">
                  إتقان {mastery}/100 · دقة {acc}% · {c.correct}/{c.answered} إجابة
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
