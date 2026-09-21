import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { RuleRow } from "@/convex/owner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  Bot,
  BrainCircuit,
  Eraser,
  Gavel,
  Scale,
  ShieldCheck,
  Sparkles,
  Swords,
} from "lucide-react";
import { Link, useNavigate } from "react-router";
import { AppealForm, JusticeSection } from "@/components/Appeals";

const CATEGORY_META: Record<
  string,
  { label: string; icon: React.ElementType; tone: string; desc: string }
> = {
  essential: {
    label: "قوانين أساسية",
    icon: Scale,
    tone: "text-primary bg-primary/10 border-primary/25",
    desc: "أسس اللعب النزيه داخل الموقع",
  },
  prohibited: {
    label: "ممنوعات صريحة",
    icon: Ban,
    tone: "text-rose-600 bg-rose-500/10 border-rose-500/25",
    desc: "سلوكيات يُعاقب عليها فوراً",
  },
  punishment: {
    label: "سلم العقوبات",
    icon: Gavel,
    tone: "text-amber-600 bg-amber-500/10 border-amber-500/25",
    desc: "كيف تتصاعد العقوبة تلقائياً",
  },
};

function RuleItem({ rule }: { rule: RuleRow }) {
  const tones: Record<string, string> = {
    low: "border-emerald-500/25 bg-emerald-500/5",
    medium: "border-amber-500/25 bg-amber-500/5",
    high: "border-rose-500/25 bg-rose-500/5",
  };
  const labels: Record<string, string> = { low: "بسيطة", medium: "متوسطة", high: "خطيرة" };
  return (
    <div className={cn("rounded-2xl border p-5", tones[rule.severity])}>
      <div className="flex items-center justify-between gap-2">
        <p className="font-bold text-foreground">{rule.title}</p>
        <Badge variant="outline" className="shrink-0 rounded-full text-[10px]">
          خطورة {labels[rule.severity]}
        </Badge>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{rule.description}</p>
    </div>
  );
}

export default function Rules() {
  const navigate = useNavigate();
  const rules = useQuery(api.owner.getRules);
  const seedRules = useMutation(api.lawEnforcement.seedRules);
  const [seeding, setSeeding] = useState(false);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await seedRules();
      window.location.reload();
    } catch { /* ignore */ }
    setSeeding(false);
  };

  const grouped = (rules ?? []).reduce<Record<string, RuleRow[]>>((acc, r) => {
    (acc[r.category] ??= []).push(r);
    return acc;
  }, {});

  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
          <button type="button" onClick={() => navigate("/")} className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <ShieldCheck className="size-5" />
            </span>
            <span className="text-lg font-bold tracking-tight">قوانين اللعب</span>
          </button>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="gap-1.5 rounded-xl">
              <Link to="/play">
                <Swords className="size-3.5" />
                العب الآن
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 pb-24 pt-14">
        {/* Intro */}
        <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-card p-8 text-center shadow-sm sm:p-10">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 start-1/2 h-48 w-[30rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
          />
          <Badge variant="outline" className="mb-4 gap-1.5 rounded-full text-primary">
            <Sparkles className="size-3.5" />
            عقد اللعب النزيه
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            القوانين تحمي المنافسة…
            <br />
            <span className="text-primary">والعقوبة تلقائية.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl leading-relaxed text-muted-foreground">
            هذه القوانين ملزمة لكل لاعب. تراقبها الإدارة و«الرقيب الآلي» — ذكاء
            اصطناعي يعمل على مدار الساعة عبر منصة OpenRouter — ويُطبَّق
            سلم العقوبات تلقائياً على المخالفين دون انتظار تدخل يدوي.
          </p>

          <div className="mt-8 grid gap-3 text-start sm:grid-cols-3">
            <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
              <Eraser className="size-5 text-rose-500" />
              <p className="mt-2 text-sm font-bold">ممنوع الغش عبر الإنترنت</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                مغادرة نافذة اللعب أثناء السؤال = اشتباه بحث عن الإجابة. النظام يرصدها
                تلقائياً ويطبّق العقوبة فوراً.
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
              <Bot className="size-5 text-primary" />
              <p className="mt-2 text-sm font-bold">رقيب آلي يعمل 24/7</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                كل بلاغ يُفحص بالذكاء الاصطناعي حسب هذه القوانين، وكل قرار مسجّل
                ويمكن مراجعته من الإدارة.
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
              <Gavel className="size-5 text-amber-600" />
              <p className="mt-2 text-sm font-bold">عقوبات تصاعدية</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                تحذير ← خصم نقاط ← حظر مؤقت ← حظر دائم. لا مجال للتكرار المتعمد.
              </p>
            </div>
          </div>
        </div>

        {/* Rules by category */}
        {rules === undefined ? (
          <div className="mt-10 flex justify-center py-16">
            <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="mt-10 space-y-10">
            {(["essential", "prohibited", "punishment"] as const).map((cat) => {
              const meta = CATEGORY_META[cat];
              const items = grouped[cat] ?? [];
              if (items.length === 0) return null;
              return (
                <section key={cat}>
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "flex size-11 items-center justify-center rounded-xl border",
                        meta.tone,
                      )}
                    >
                      <meta.icon className="size-5" />
                    </span>
                    <div>
                      <h2 className="text-lg font-bold">{meta.label}</h2>
                      <p className="text-xs text-muted-foreground">{meta.desc}</p>
                    </div>
                    <Badge variant="outline" className="ms-auto rounded-full">
                      {items.length} بند
                    </Badge>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {items.map((rule) => (
                      <RuleItem key={rule.id} rule={rule} />
                    ))}
                  </div>
                </section>
              );
            })}

            {rules.length === 0 && (
              <Card className="border-border/80">
                <CardContent className="p-8 text-center">
                  <AlertTriangle className="mx-auto size-8 text-amber-500" />
                  <p className="mt-3 text-sm text-muted-foreground">
                    القوانين لم تُدخل بعد.
                  </p>
                  <Button onClick={handleSeed} disabled={seeding} className="mt-4 gap-1.5">
                    {seeding ? "⏳" : "⚖️"} إدخال القوانين الآن
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* مركز العدالة — حالة عقوبتك وحقك في الاعتراض (يظهر تلقائياً للمعاقَب فقط) */}
        <section className="mt-10">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl border border-amber-500/25 bg-amber-500/10 text-amber-600">
              <Scale className="size-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold">مركز العدالة</h2>
              <p className="text-xs text-muted-foreground">حالة عقوبتك، وسجل اعتراضاتك، وحقك في المراجعة</p>
            </div>
          </div>
          <div className="mt-4">
            <JusticeSection />
          </div>
        </section>

        {/* Anti-cheat notice */}
        <Card className="mt-10 border-rose-500/25 bg-rose-500/5 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <AlertTriangle className="size-4 text-rose-500" />
              تنبيه: العقوبة التلقائية على الغش
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
            <p className="flex items-start gap-2 text-muted-foreground">
              <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-amber-500" />
              المخالفة الأولى: تحذير رسمي يُسجَّل في ملفك.
            </p>
            <p className="flex items-start gap-2 text-muted-foreground">
              <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-orange-500" />
              المخالفة الثانية: خصم 150 نقطة من نتيجة جولتك.
            </p>
            <p className="flex items-start gap-2 text-muted-foreground">
              <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-rose-500" />
              المخالفة الثالثة: إلغاء نتيجتك وحظر حسابك 24 ساعة.
            </p>
            <p className="flex items-start gap-2 text-muted-foreground">
              <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-rose-600" />
              التكرار بعدها: حظر 7 أيام ثم حظر دائم.
            </p>
          </CardContent>
        </Card>

        {/* CTA */}
        <div className="mt-12 rounded-3xl bg-primary px-8 py-12 text-center text-primary-foreground shadow-xl shadow-primary/20">
          <BrainCircuit className="mx-auto size-10" />
          <h2 className="mt-4 text-2xl font-bold">العب بذكاء، وافزِ بشرف</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-primary-foreground/85">
            القوانين تحمي نزاهة المنافسة لك ولأصدقائك. التزم بها واستمتع بأعتى
            المعارك الفكرية.
          </p>
          <Button
            asChild
            size="lg"
            variant="secondary"
            className="mt-7 gap-2 rounded-xl bg-white px-8 text-primary hover:bg-white/90"
          >
            <Link to="/play">
              <ArrowLeft className="size-4" />
              ابدأ التحدي الآن
            </Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
