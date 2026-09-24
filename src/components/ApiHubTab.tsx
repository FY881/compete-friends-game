// ═══════════════════════════════════════════════════════════════════════
// 🧠 مركز API — لوحة السيطرة الحقيقية على كل ذكاء اللعبة
// ═══════════════════════════════════════════════════════════════════════
//  ① المزوّدون      ② مصفوفة التوجيه   ③ النماذج المُكتشَفة   ④ الحدود
//  ⑤ الاستهلاك      ⑥ الذاكرة          ⑦ القاطع والتبديل     ⑧ الاختبار والسجل
//
// كل زر هنا يُغيّر سلوك اللعبة فعلاً — لا عرض شكلي.
// ═══════════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Separator,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  Ban,
  CheckCircle2,
  Coins,
  Cpu,
  Database,
  FlaskConical,
  Globe,
  HeartPulse,
  KeyRound,
  Layers,
  Loader2,
  Play,
  Plug,
  RefreshCw,
  Route,
  Save,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Timer,
  Trash2,
  Wrench,
  XCircle,
  Zap,
} from "lucide-react";

const PANELS = [
  { id: "providers", label: "المزوّدون", icon: Plug },
  { id: "routing", label: "مصفوفة التوجيه", icon: Route },
  { id: "models", label: "النماذج", icon: Layers },
  { id: "limits", label: "الحدود", icon: ShieldCheck },
  { id: "usage", label: "الاستهلاك", icon: Coins },
  { id: "cache", label: "الذاكرة", icon: Database },
  { id: "resilience", label: "القاطع والتبديل", icon: Zap },
  { id: "live", label: "الاختبار والسجل", icon: FlaskConical },
] as const;

type PanelId = (typeof PANELS)[number]["id"];

const nf = new Intl.NumberFormat("ar-EG");
function fmt(n: number | undefined | null): string {
  return nf.format(Math.round(n ?? 0));
}
function ago(ms: number | null | undefined): string {
  if (!ms) return "—";
  const diff = Date.now() - ms;
  if (diff < 60_000) return "قبل لحظات";
  if (diff < 3_600_000) return `قبل ${Math.floor(diff / 60_000)} دقيقة`;
  if (diff < 86_400_000) return `قبل ${Math.floor(diff / 3_600_000)} ساعة`;
  return `قبل ${Math.floor(diff / 86_400_000)} يوم`;
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "good" | "warn" | "bad";
}) {
  const toneClass =
    tone === "good"
      ? "text-emerald-600"
      : tone === "warn"
        ? "text-amber-600"
        : tone === "bad"
          ? "text-rose-600"
          : "text-primary";
  return (
    <div className="rounded-2xl border border-border/60 bg-card/60 p-3.5">
      <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
        <Icon className={cn("size-3.5", toneClass)} />
        {label}
      </div>
      <div className="mt-1.5 text-xl font-black tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function ApiHubTab() {
  const center = useQuery(api.apiCenterStore.getCenter, {});
  const saveProvider = useMutation(api.apiCenterStore.saveProvider);
  const deleteProvider = useMutation(api.apiCenterStore.deleteProvider);
  const saveRoute = useMutation(api.apiCenterStore.saveRoute);
  const resetRoutes = useMutation(api.apiCenterStore.resetRoutes);
  const saveGuard = useMutation(api.apiCenterStore.saveGuard);
  const flushCache = useMutation(api.apiCenterStore.flushCache);
  const resetCircuit = useMutation(api.apiCenterStore.resetCircuit);
  const clearUsage = useMutation(api.apiCenterStore.clearUsage);
  const verifyProvider = useAction(api.apiCenter.verifyProvider);
  const discoverModels = useAction(api.apiCenter.discoverModels);
  const testTask = useAction(api.apiCenter.testTask);
  const healthReport = useAction(api.apiCenter.healthReport);
  const selfHeal = useAction(api.apiCenter.selfHeal);
  const syncCenterAction = useAction(api.apiCenter.syncCenter);
  const [syncReport, setSyncReport] = useState<
    Awaited<ReturnType<typeof syncCenterAction>> | null
  >(null);

  const [panel, setPanel] = useState<PanelId>("providers");
  const [busy, setBusy] = useState<string | null>(null);
  const [liveHealth, setLiveHealth] = useState<
    Awaited<ReturnType<typeof healthReport>> | null
  >(null);
  const [healLog, setHealLog] = useState<string[]>([]);

  const runHealth = async () => {
    setBusy("health");
    try {
      const r = await healthReport({});
      setLiveHealth(r);
      toast.success(
        r.anyOk ? "مزوّد واحد على الأقل يستجيب فعلياً" : "لا مزوّد يستجيب — راجع الأخطاء أدناه",
      );
      if (r.circuitReset) toast.info("أُعيد فتح قاطع الدائرة تلقائياً بعد فحص ناجح");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل فحص الصحة");
    } finally {
      setBusy(null);
    }
  };

  const runSync = async () => {
    setBusy("sync");
    try {
      const r = await syncCenterAction({});
      setSyncReport(r);
      toast.success(
        r.slotA?.ok || r.slotB?.ok
          ? "تم التزامن — كل الوحدات مرتبطة بالمزوّد الشغّال"
          : "تم حقن إعدادات المركز في كل الوحدات — لا مزوّد يستجيب بعد",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل التزامن");
    } finally {
      setBusy(null);
    }
  };

  const runSelfHeal = async () => {
    setBusy("heal");
    try {
      const r = await selfHeal({});
      setHealLog(r.actions);
      toast.success("انتهى الإصلاح الذاتي — راجع التفاصيل");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الإصلاح الذاتي");
    } finally {
      setBusy(null);
    }
  };

  // ── ① نموذج المزوّدين ──
  const [keyA, setKeyA] = useState("");
  // مملوء مسبقاً بمزوّد MiniMax: على المالك أن يلصق المفتاح فقط
  const [urlA, setUrlA] = useState("https://api.minimax.io/v1");
  const [presetA, setPresetA] = useState("minimax");
  const [modelA, setModelA] = useState("");
  const [keyB, setKeyB] = useState("");
  const [modelB, setModelB] = useState("");

  // ── ② التوجيه: مسودّات لكل وحدة ──
  const [draft, setDraft] = useState<
    Record<string, { model: string; temperature: string; maxTokens: string; needsJson: boolean; enabled: boolean }>
  >({});

  // ── ④ الحدود ──
  const guardDraft = useMemo(() => {
    if (!center) return null;
    return {
      enabled: center.guard.enabled,
      dailyCallCap: String(center.guard.dailyCallCap),
      dailyTokenCap: String(center.guard.dailyTokenCap),
      perMinuteCap: String(center.guard.perMinuteCap),
      cacheEnabled: center.guard.cacheEnabled,
      circuitEnabled: center.guard.circuitEnabled,
      failureThreshold: String(center.guard.failureThreshold),
      cooldownMs: String(Math.round(center.guard.cooldownMs / 1000)),
      allowEnvBootstrap: center.guard.allowEnvBootstrap,
    };
  }, [center]);
  const [guardEdit, setGuardEdit] = useState<typeof guardDraft>(null);
  const guard = guardEdit ?? guardDraft;

  // ── ⑧ الاختبار الحي ──
  const [liveTask, setLiveTask] = useState("questions");
  const [livePrompt, setLivePrompt] = useState("");
  const [liveResult, setLiveResult] = useState<Record<string, unknown> | null>(null);

  if (!center) {
    return (
      <div className="flex min-h-[240px] items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> جارٍ قراءة مركز API…
      </div>
    );
  }

  const run = async (tag: string, fn: () => Promise<unknown>) => {
    setBusy(tag);
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل التنفيذ");
    } finally {
      setBusy(null);
    }
  };

  const providerHead = center.providers.A ?? center.providers.B;
  // Environment bootstrap is a real server-side provider too. Keep the verify
  // action usable when the owner configured the key through the Keys screen
  // instead of duplicating it in the database.
  const hasA = Boolean(center.providers.A || center.envBootstrap?.active);
  const hasB = Boolean(center.providers.B);
  const usage = center.usage.today;
  const maxSeries = Math.max(1, ...center.usage.series.map((s: { calls: number }) => s.calls));

  // 🩺 تشخيص حيّ — نحوّل آخر فشل مسجّل إلى سبب واضح وخطوة تالية قابلة للتنفيذ،
  // حتى لا يبقى المالك أمام «هناك خطأ» غامضة أو حالة «متصل» مضلّلة.
  const latest = center.events[0] as { ok: boolean; error?: string } | undefined;
  const health = (() => {
    const err = latest && !latest.ok ? (latest.error ?? "") : "";
    const t = err.toLowerCase();
    if (/رصيد|insufficient|usage limit|quota|billing|credit/.test(t)) {
      return {
        tone: "amber" as const,
        title: "💰 رصيد المزوّد انتهى — أنظمة AI موقوفة حتى إضافة رصيد أو تبديل المزوّد",
        body: "المفتاح صحيح، والمشكلة ليست في اللعبة: حساب المزوّد لا يملك رصيداً. أضف رصيداً في حساب المزوّد، أو أضبط مزوّداً آخر (النظام الثاني) فتعود كل التبويبات للعمل فوراً بلا تعديل كود.",
        detail: err,
      };
    }
    if (/مفتاح|401|403|unauthor|invalid/.test(t)) {
      return {
        tone: "rose" as const,
        title: "🔑 المزوّد رفض المفتاح",
        body: "حدّث المفتاح من القسم أعلاه ثم اضغط «تحقق حقيقي» للتأكد فوراً.",
        detail: err,
      };
    }
    if (center.circuit.open) {
      return {
        tone: "rose" as const,
        title: "⚠️ قاطع الدائرة مفتوح — الطلبات موقوفة مؤقتاً",
        body: "أوقف المحرك الضرب على المزوّد بعد فشل متتالٍ. أصلح السبب أعلاه ثم أعد الضبط من تبويب «القاطع والتبديل»، أو انتظر انتهاء التبريد تلقائياً.",
        detail: err || undefined,
      };
    }
    return null;
  })();

  return (
    <div className="space-y-5" dir="rtl">
      {/* ═══ شريط الحالة العلوي — صورة فورية ═══ */}
      <Card className="border-primary/25 bg-primary/[0.03]">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-2 text-sm font-black">
              <Cpu className="size-4 text-primary" /> مركز الذكاء الموحّد
            </span>
            {hasA || hasB ? (
              <Badge className="rounded-full bg-emerald-600/10 text-[10px] text-emerald-700">
                <CheckCircle2 className="me-1 size-3" /> المزوّد متصل
              </Badge>
            ) : (
              <Badge variant="outline" className="rounded-full text-[10px] text-rose-600">
                <XCircle className="me-1 size-3" /> لا مزوّد — كل ذكاء اللعبة موقوف
              </Badge>
            )}
            {providerHead && (
              <Badge variant="outline" className="rounded-full text-[10px]" dir="ltr">
                {providerHead.baseUrl || "مفتاح فقط"}
              </Badge>
            )}
            {center.circuit.open && (
              <Badge variant="outline" className="rounded-full border-rose-500/40 text-[10px] text-rose-600">
                <Ban className="me-1 size-3" /> قاطع الدائرة مفتوح
              </Badge>
            )}
            {center.envBootstrap?.active && (
              <Badge variant="outline" className="rounded-full text-[10px] text-amber-600">
                تشغيل احتياطي من متغيّرات البيئة
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard icon={Activity} label="استدعاءات اليوم" value={fmt(usage.calls)} hint={`${fmt(usage.cacheHits)} من الذاكرة`} />
            <StatCard
              icon={CheckCircle2}
              label="نسبة النجاح"
              value={`${usage.successRate}%`}
              tone={usage.successRate >= 95 ? "good" : usage.successRate >= 80 ? "warn" : "bad"}
              hint={`${fmt(usage.fail)} فشل`}
            />
            <StatCard icon={Timer} label="متوسط الزمن" value={`${fmt(usage.avgLatency)}ms`} hint="لكل استدعاء حقيقي" />
            <StatCard icon={Coins} label="توكنات اليوم" value={fmt(usage.tokensIn + usage.tokensOut)} hint={`${fmt(usage.tokensIn)} داخل / ${fmt(usage.tokensOut)} خارج`} />
            <StatCard icon={Database} label="ذاكرة الاستجابة" value={fmt(center.cache.entries)} hint={`وفّرت ${fmt(center.cache.savedCalls)} استدعاء`} tone="good" />
            <StatCard
              icon={ShieldCheck}
              label="الحماية"
              value={center.guard.enabled ? "مفعّلة" : "معطّلة"}
              tone={center.guard.enabled ? "good" : "warn"}
              hint={center.guard.dailyCallCap > 0 ? `سقف ${fmt(center.guard.dailyCallCap)}/يوم` : "بلا سقف يومي"}
            />
          </div>
        </CardContent>
      </Card>

      {health && (
        <div
          className={cn(
            "flex items-start gap-3 rounded-2xl border p-4",
            health.tone === "amber"
              ? "border-amber-500/40 bg-amber-500/[0.07]"
              : "border-rose-500/40 bg-rose-500/[0.06]",
          )}
        >
          <AlertTriangle
            className={cn(
              "mt-0.5 size-4 shrink-0",
              health.tone === "amber" ? "text-amber-600" : "text-rose-600",
            )}
          />
          <div className="min-w-0 space-y-1">
            <p
              className={cn(
                "text-sm font-black",
                health.tone === "amber" ? "text-amber-800" : "text-rose-800",
              )}
            >
              {health.title}
            </p>
            <p className="text-[11px] leading-relaxed text-muted-foreground">{health.body}</p>
            {health.detail && (
              <p
                className="max-h-24 overflow-auto rounded-lg bg-background/70 px-2 py-1 font-mono text-[10px] leading-relaxed text-muted-foreground"
                dir="ltr"
              >
                {health.detail}
              </p>
            )}
          </div>
        </div>
      )}

      <Tabs value={panel} onValueChange={(v) => setPanel(v as PanelId)}>
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-2xl bg-muted/40 p-1.5">
          {PANELS.map((p) => (
            <TabsTrigger key={p.id} value={p.id} className="gap-1.5 rounded-xl text-xs">
              <p.icon className="size-3.5" />
              {p.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ═══════════════════ ① المزوّدون ═══════════════════ */}
        <TabsContent value="providers" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                <Globe className="size-4 text-primary" /> النظام الأول — مفتاح + رابط المزوّد
                {hasA ? (
                  <Badge className="rounded-full bg-emerald-600/10 text-[10px] text-emerald-700">مضبوط</Badge>
                ) : (
                  <Badge variant="outline" className="rounded-full text-[10px] text-muted-foreground">غير مضبوط</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {center.presets.map((p: { id: string; label: string }) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setPresetA(p.id);
                      const preset = center.presets.find((x: { id: string }) => x.id === p.id);
                      if (preset?.baseUrl) setUrlA(preset.baseUrl);
                    }}
                    className={cn(
                      "rounded-xl border px-3 py-1.5 text-[11px] font-bold transition-colors",
                      presetA === p.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border/60 text-muted-foreground hover:border-primary/40",
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">مفتاح API</Label>
                  <Input
                    value={keyA}
                    onChange={(e) => setKeyA(e.target.value)}
                    placeholder={center.providers.A ? `محفوظ: ${center.providers.A.maskedKey} — اكتب الجديد للاستبدال` : "sk-..."}
                    className="rounded-xl font-mono text-xs"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">رابط المزوّد (URL)</Label>
                  <Input
                    value={urlA}
                    onChange={(e) => setUrlA(e.target.value)}
                    placeholder="api.minimax.io/v1"
                    className="rounded-xl font-mono text-xs"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">
                  النموذج المفضّل لهذا المزوّد (اتركه فارغاً ليختار المحرك الأسرع المتاح)
                </Label>
                <Input
                  value={modelA}
                  onChange={(e) => setModelA(e.target.value)}
                  placeholder={center.providers.A?.model ?? "MiniMax-M2.7-highspeed"}
                  className="rounded-xl font-mono text-xs"
                  dir="ltr"
                />
              </div>

              {center.providers.A && (
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-muted/20 p-3 text-xs">
                  <KeyRound className="size-3.5 text-muted-foreground" />
                  <span className="font-mono">{center.providers.A.maskedKey}</span>
                  <span className="text-muted-foreground" dir="ltr">{center.providers.A.baseUrl || "—"}</span>
                  <span className="ms-auto text-[10px] text-muted-foreground">حُدّث {ago(center.providers.A.updatedAt)}</span>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  className="gap-1.5 rounded-xl"
                  disabled={busy !== null}
                  onClick={() =>
                    run("saveA", async () => {
                      await saveProvider({
                        which: "A",
                        apiKey: keyA.trim() || undefined,
                        baseUrl: urlA.trim() || undefined,
                        presetId: presetA,
                        model: modelA.trim() ? modelA.trim() : null,
                      });
                      setKeyA("");
                      toast.success("حُفظ المزوّد الأول — يعمل فوراً في كل اللعبة");
                    })
                  }
                >
                  {busy === "saveA" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  {center.providers.A ? "تحديث المزوّد" : "حفظ المزوّد"}
                </Button>
                <Button
                  variant="outline"
                  className="gap-1.5 rounded-xl"
                  disabled={busy !== null || !hasA}
                  onClick={() =>
                    run("verifyA", async () => {
                      const r = await verifyProvider({ which: "A" });
                      if (r.ok) {
                        toast.success(`تحقق ناجح (${r.latencyMs}ms) على ${r.model}: ${r.reply || "استجابة فارغة"}`);
                        return;
                      }
                      // التشخيص يصل مفهومًا من المحرك: رصيد / مفتاح / مسار / حد استخدام
                      const diagnosis = r.error ?? "سبب غير معروف";
                      if (r.kind === "balance") {
                        toast.error(`💰 رصيد المزوّد انتهى\n${diagnosis}`, {
                          duration: 12000,
                          description: "المفتاح صالح — أضف رصيدًا في حساب المزوّد أو أضبط مزوّدًا آخر (النظام الثاني) فتعود كل أنظمة AI للعمل فورًا.",
                        });
                        return;
                      }
                      toast.error(`فشل التحقق (${r.status})\n${diagnosis}`, { duration: 10000 });
                    })
                  }
                >
                  {busy === "verifyA" ? <Loader2 className="size-4 animate-spin" /> : <FlaskConical className="size-4" />}
                  تحقق حقيقي
                </Button>
                <Button
                  variant="outline"
                  className="gap-1.5 rounded-xl"
                  disabled={busy !== null || !hasA}
                  onClick={() =>
                    run("discoverA", async () => {
                      const r = await discoverModels({ which: "A" });
                      if (r.ok) toast.success(`اكتُشف ${r.models.length} نموذجاً من ${r.url}`);
                      else toast.error(`تعذّر الاكتشاف: ${r.error ?? "خطأ غير معروف"}`);
                    })
                  }
                >
                  {busy === "discoverA" ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                  اكتشاف النماذج
                </Button>
                {center.providers.A && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 rounded-xl text-rose-600"
                    disabled={busy !== null}
                    onClick={() =>
                      run("delA", async () => {
                        await deleteProvider({ which: "A" });
                        toast("حُذف المزوّد الأول نهائياً");
                      })
                    }
                  >
                    <Trash2 className="size-3.5" /> حذف
                  </Button>
                )}
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                اكتب الرابط كما هو — حتى بدون <span dir="ltr">https://</span>. المحرك يطبّعه إلى نقطة الاتصال الصحيحة
                (<span dir="ltr">/v1/chat/completions</span>) ويكتشف النماذج بنفسه. لا يوجد مفتاح مكتوب في الكود إطلاقاً.
              </p>
            </CardContent>
          </Card>

          <Card className="border-violet-500/25 bg-violet-500/[0.03]">
            <CardHeader className="pb-2">
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                <KeyRound className="size-4 text-violet-600" /> النظام الثاني — مفتاح فقط (بوابة افتراضية)
                {center.providers.B ? (
                  <Badge className="rounded-full bg-emerald-600/10 text-[10px] text-emerald-700">مضبوط</Badge>
                ) : (
                  <Badge variant="outline" className="rounded-full text-[10px] text-muted-foreground">غير مضبوط</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">مفتاح API</Label>
                  <Input
                    value={keyB}
                    onChange={(e) => setKeyB(e.target.value)}
                    placeholder={center.providers.B ? `محفوظ: ${center.providers.B.maskedKey}` : "sk-or-v1-..."}
                    className="rounded-xl font-mono text-xs"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">النموذج المفضّل</Label>
                  <Input
                    value={modelB}
                    onChange={(e) => setModelB(e.target.value)}
                    placeholder={center.providers.B?.model ?? "openrouter/auto"}
                    className="rounded-xl font-mono text-xs"
                    dir="ltr"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  className="gap-1.5 rounded-xl"
                  disabled={busy !== null}
                  onClick={() =>
                    run("saveB", async () => {
                      await saveProvider({
                        which: "B",
                        apiKey: keyB.trim() || undefined,
                        presetId: "openrouter",
                        model: modelB.trim() ? modelB.trim() : null,
                      });
                      setKeyB("");
                      toast.success("حُفظ المزوّد الثاني — احتياطي حقيقي عند فشل الأول");
                    })
                  }
                >
                  {busy === "saveB" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  حفظ المزوّد الاحتياطي
                </Button>
                <Button
                  variant="outline"
                  className="gap-1.5 rounded-xl"
                  disabled={busy !== null || !hasB}
                  onClick={() =>
                    run("verifyB", async () => {
                      const r = await verifyProvider({ which: "B" });
                      if (r.ok) {
                        toast.success(`تحقق ناجح (${r.latencyMs}ms) على ${r.model}: ${r.reply || "استجابة فارغة"}`);
                        return;
                      }
                      const diagnosis = r.error ?? "سبب غير معروف";
                      toast.error(
                        r.kind === "balance" ? `💰 رصيد المزوّد انتهى\n${diagnosis}` : `فشل التحقق (${r.status})\n${diagnosis}`,
                        { duration: 10000 },
                      );
                    })
                  }
                >
                  {busy === "verifyB" ? <Loader2 className="size-4 animate-spin" /> : <FlaskConical className="size-4" />}
                  تحقق حقيقي
                </Button>
                {center.providers.B && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 rounded-xl text-rose-600"
                    onClick={() =>
                      run("delB", async () => {
                        await deleteProvider({ which: "B" });
                        toast("حُذف المزوّد الاحتياطي");
                      })
                    }
                  >
                    <Trash2 className="size-3.5" /> حذف
                  </Button>
                )}
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                يُستخدم تلقائياً بعد استنفاد المزوّد الأول: تبديل حقيقي بلا تدخل، فلا يتوقف ذكاء اللعبة عند عطل مزوّد واحد.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════ ② مصفوفة التوجيه ═══════════════════ */}
        <TabsContent value="routing" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Route className="size-4 text-primary" /> توجيه كل وحدة AI في اللعبة
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 rounded-xl"
                disabled={busy !== null}
                onClick={() =>
                  run("resetRoutes", async () => {
                    await resetRoutes({});
                    setDraft({});
                    toast.success("أُعيدت المصفوفة للافتراضي — كل وحدة عادت لتوجيهها الأصلي");
                  })
                }
              >
                <RefreshCw className="size-3.5" /> إعادة الكل للافتراضي
              </Button>
            </CardHeader>
            <CardContent className="space-y-5">
              <p className="rounded-xl border border-border/60 bg-muted/20 p-3 text-[11px] leading-relaxed text-muted-foreground">
                كل صف هنا = وحدة ذكاء تستدعي AI في اللعبة فعلاً. غيّر النموذج أو الحرارة أو سقف الطول فتسري على تلك الوحدة وحدها
                في كل اللعبة من هذه اللحظة. إيقاف الوحدة يجعلها ترفض الاستدعاء برسالة واضحة بدل أن تعمل بالخطأ.
              </p>
              {["المحتوى", "الأمان", "اللاعب", "الأحداث", "الإدارة", "عام"].map((group) => {
                const rows = center.routes.filter((r: { group: string }) => r.group === group);
                if (rows.length === 0) return null;
                return (
                  <div key={group} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="size-3.5 text-primary" />
                      <span className="text-xs font-black">{group}</span>
                      <Separator className="flex-1" />
                    </div>
                    {rows.map(
                      (r: {
                        task: string;
                        label: string;
                        what: string;
                        model: string | null;
                        temperature: number | null;
                        maxTokens: number;
                        needsJson: boolean;
                        enabled: boolean;
                        cacheTtlMs: number;
                      }) => {
                        const d = draft[r.task] ?? {
                          model: r.model ?? "",
                          temperature: r.temperature === null ? "" : String(r.temperature),
                          maxTokens: String(r.maxTokens),
                          needsJson: r.needsJson,
                          enabled: r.enabled,
                        };
                        const stats = center.usage.perTask[r.task];
                        const set = (patch: Partial<typeof d>) => setDraft((p) => ({ ...p, [r.task]: { ...d, ...patch } }));
                        return (
                          <div
                            key={r.task}
                            className={cn(
                              "rounded-2xl border p-3 transition-colors",
                              d.enabled ? "border-border/60 bg-card/50" : "border-amber-500/30 bg-amber-500/[0.04]",
                            )}
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-bold">{r.label}</span>
                              <span className="text-[10px] text-muted-foreground">{r.what}</span>
                              {r.cacheTtlMs > 0 && (
                                <Badge variant="outline" className="rounded-full text-[9px] text-emerald-600">
                                  ذاكرة {Math.round(r.cacheTtlMs / 1000)}ث
                                </Badge>
                              )}
                              {stats && (
                                <Badge variant="outline" className="rounded-full text-[9px] text-muted-foreground">
                                  {fmt(stats.calls)} اليوم
                                  {stats.cached > 0 ? ` · ${fmt(stats.cached)} ذاكرة` : ""}
                                  {stats.fails > 0 ? ` · ${fmt(stats.fails)} فشل` : ""}
                                </Badge>
                              )}
                              <div className="ms-auto flex items-center gap-2">
                                <span className="text-[10px] text-muted-foreground">{d.enabled ? "مفعّلة" : "موقوفة"}</span>
                                <Switch checked={d.enabled} onCheckedChange={(v) => set({ enabled: v })} />
                              </div>
                            </div>
                            <div className="mt-2.5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                              <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">النموذج (فارغ = الأسرع المتاح)</Label>
                                <Input
                                  value={d.model}
                                  onChange={(e) => set({ model: e.target.value })}
                                  className="h-8 rounded-lg font-mono text-[11px]"
                                  dir="ltr"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">الحرارة 0–2 (فارغ = كما يطلب الكود)</Label>
                                <Input
                                  value={d.temperature}
                                  onChange={(e) => set({ temperature: e.target.value })}
                                  className="h-8 rounded-lg text-[11px]"
                                  dir="ltr"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">سقف الطول (0 = بلا سقف)</Label>
                                <Input
                                  value={d.maxTokens}
                                  onChange={(e) => set({ maxTokens: e.target.value })}
                                  className="h-8 rounded-lg text-[11px]"
                                  dir="ltr"
                                />
                              </div>
                              <div className="flex items-end gap-2">
                                <div className="flex flex-1 items-center gap-2 pb-1.5">
                                  <Switch checked={d.needsJson} onCheckedChange={(v) => set({ needsJson: v })} />
                                  <span className="text-[10px] text-muted-foreground">ردّ JSON</span>
                                </div>
                                <Button
                                  size="sm"
                                  className="h-8 gap-1 rounded-lg"
                                  disabled={busy !== null}
                                  onClick={() =>
                                    run(`route-${r.task}`, async () => {
                                      await saveRoute({
                                        task: r.task,
                                        model: d.model.trim() ? d.model.trim() : null,
                                        temperature: d.temperature.trim() === "" ? null : Number(d.temperature),
                                        maxTokens: Number(d.maxTokens) || 0,
                                        needsJson: d.needsJson,
                                        enabled: d.enabled,
                                      });
                                      setDraft((p) => {
                                        const next = { ...p };
                                        delete next[r.task];
                                        return next;
                                      });
                                      toast.success(`حُفظ توجيه «${r.label}»`);
                                    })
                                  }
                                >
                                  {busy === `route-${r.task}` ? (
                                    <Loader2 className="size-3.5 animate-spin" />
                                  ) : (
                                    <Save className="size-3.5" />
                                  )}
                                  حفظ
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      },
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════ ③ النماذج المُكتشَفة ═══════════════════ */}
        <TabsContent value="models" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Layers className="size-4 text-primary" /> النماذج المتاحة فعلاً على مزوّدك
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="rounded-xl border border-border/60 bg-muted/20 p-3 text-[11px] leading-relaxed text-muted-foreground">
                نقرأ <span dir="ltr">/v1/models</span> من المزوّد مباشرة. أي مزوّد جديد تضيفه يعمل تلقائياً هنا — بلا تعديل كود.
                النماذج المرتّبة بالأسرع أولاً لأن ذكاء اللعبة يحتاج ردّاً سريعاً.
              </p>
              {(["A", "B"] as const).map((which) => {
                const p = center.providers[which];
                if (!p) return null;
                return (
                  <div key={which} className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="rounded-full text-[10px]">
                        المزوّد {which}
                      </Badge>
                      <span className="font-mono text-[11px] text-muted-foreground" dir="ltr">
                        {p.baseUrl || "بوابة افتراضية"}
                      </span>
                      {p.discoveredAt ? (
                        <span className="text-[10px] text-muted-foreground">آخر اكتشاف {ago(p.discoveredAt)}</span>
                      ) : (
                        <span className="text-[10px] text-amber-600">لم يُكتشف بعد — نستخدم نماذج القالب</span>
                      )}
                    </div>
                    {p.discoveredModels.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-border/70 py-4 text-center text-[11px] text-muted-foreground">
                        اضغط «اكتشاف النماذج» في تبويب المزوّدين — أو استخدم النموذج المفضّل يدوياً في المصفوفة.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {p.discoveredModels.map((m: string) => {
                          const isDefault = p.model === m;
                          return (
                            <button
                              key={m}
                              type="button"
                              disabled={busy !== null}
                              onClick={() =>
                                run(`setmodel-${which}-${m}`, async () => {
                                  await saveProvider({ which, presetId: p.presetId, model: isDefault ? null : m });
                                  toast.success(isDefault ? "أُزيل التفضيل" : `صار «${m}» هو النموذج المفضّل للمزوّد ${which}`);
                                })
                              }
                              className={cn(
                                "rounded-lg border px-2.5 py-1 font-mono text-[10px] transition-colors",
                                isDefault
                                  ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700"
                                  : "border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground",
                              )}
                              dir="ltr"
                            >
                              {m}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════ ④ الحدود والحماية ═══════════════════ */}
        <TabsContent value="limits" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="size-4 text-primary" /> الحدود التي تحمي رصيدك واللعبة
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!guard ? null : (
                <>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground">سقف الاستدعاءات اليومي (0 = بلا سقف)</Label>
                      <Input
                        value={guard.dailyCallCap}
                        onChange={(e) => setGuardEdit({ ...guard, dailyCallCap: e.target.value })}
                        className="rounded-xl"
                        dir="ltr"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground">سقف التوكنات اليومي (0 = بلا سقف)</Label>
                      <Input
                        value={guard.dailyTokenCap}
                        onChange={(e) => setGuardEdit({ ...guard, dailyTokenCap: e.target.value })}
                        className="rounded-xl"
                        dir="ltr"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground">حد الاستدعاءات في الدقيقة (0 = بلا حد)</Label>
                      <Input
                        value={guard.perMinuteCap}
                        onChange={(e) => setGuardEdit({ ...guard, perMinuteCap: e.target.value })}
                        className="rounded-xl"
                        dir="ltr"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground">عدد الفشل المتتالي لفتح القاطع</Label>
                      <Input
                        value={guard.failureThreshold}
                        onChange={(e) => setGuardEdit({ ...guard, failureThreshold: e.target.value })}
                        className="rounded-xl"
                        dir="ltr"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground">مدة التبريد قبل إعادة المحاولة (ثانية)</Label>
                      <Input
                        value={guard.cooldownMs}
                        onChange={(e) => setGuardEdit({ ...guard, cooldownMs: e.target.value })}
                        className="rounded-xl"
                        dir="ltr"
                      />
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    {(
                      [
                        ["enabled", "تشغيل الحماية", "السقوف والكاش والقاطع"],
                        ["cacheEnabled", "ذاكرة الاستجابة", "نفس الطلب لا يُدفع مرتين"],
                        ["circuitEnabled", "قاطع الدائرة", "يوقف الضرب على مزوّد فاشل"],
                        ["allowEnvBootstrap", "تشغيل احتياطي من متغيّرات البيئة", "إن لم يُضبط مزوّد في المركز"],
                      ] as const
                    ).map(([field, label, hint]) => (
                      <div key={field} className="flex items-center justify-between rounded-xl border border-border/60 p-3">
                        <div>
                          <div className="text-xs font-bold">{label}</div>
                          <div className="text-[10px] text-muted-foreground">{hint}</div>
                        </div>
                        <Switch
                          checked={Boolean(guard[field])}
                          onCheckedChange={(v) => setGuardEdit({ ...guard, [field]: v })}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      className="gap-1.5 rounded-xl"
                      disabled={busy !== null}
                      onClick={() =>
                        run("saveGuard", async () => {
                          await saveGuard({
                            enabled: guard.enabled,
                            dailyCallCap: Number(guard.dailyCallCap) || 0,
                            dailyTokenCap: Number(guard.dailyTokenCap) || 0,
                            perMinuteCap: Number(guard.perMinuteCap) || 0,
                            cacheEnabled: guard.cacheEnabled,
                            circuitEnabled: guard.circuitEnabled,
                            failureThreshold: Number(guard.failureThreshold) || 5,
                            cooldownMs: (Number(guard.cooldownMs) || 300) * 1000,
                            allowEnvBootstrap: guard.allowEnvBootstrap,
                          });
                          setGuardEdit(null);
                          toast.success("حُفظت الحدود — تسري على كل استدعاء فوراً");
                        })
                      }
                    >
                      {busy === "saveGuard" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                      حفظ الحدود
                    </Button>
                    {guardEdit && (
                      <Button variant="ghost" className="rounded-xl" onClick={() => setGuardEdit(null)}>
                        إلغاء التعديل
                      </Button>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════ ⑤ الاستهلاك ═══════════════════ */}
        <TabsContent value="usage" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Coins className="size-4 text-primary" /> استهلاك حقيقي — أرقام مقيسة لا مُقدَّرة
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 rounded-xl text-rose-600"
                disabled={busy !== null}
                onClick={() =>
                  run("clearUsage", async () => {
                    await clearUsage({});
                    toast("أُفرغت أرقام الاستهلاك والسجل الحي");
                  })
                }
              >
                {busy === "clearUsage" ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                تصفير العدّادات
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="text-xs font-bold">آخر ٧ أيام</div>
                <div className="flex h-28 items-end gap-1.5">
                  {center.usage.series.map((s: { day: string; calls: number; tokens: number; cacheHits: number }) => (
                    <div key={s.day} className="flex flex-1 flex-col items-center gap-1">
                      <div className="text-[9px] tabular-nums text-muted-foreground">{s.calls > 0 ? fmt(s.calls) : ""}</div>
                      <div
                        className="w-full rounded-t-md bg-primary/70 transition-all"
                        style={{ height: `${Math.max(3, (s.calls / maxSeries) * 72)}px` }}
                        title={`${s.day}: ${s.calls} استدعاء · ${s.tokens} توكن · ${s.cacheHits} من الذاكرة`}
                      />
                      <div className="text-[8px] text-muted-foreground" dir="ltr">
                        {s.day.slice(5)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="text-xs font-bold">لكل نموذج (اليوم)</div>
                {center.usage.byModel.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border/70 py-6 text-center text-[11px] text-muted-foreground">
                    لا استدعاءات اليوم بعد. أول استدعاء من أي وحدة AI سيظهر هنا فوراً بأرقامه الحقيقية.
                  </p>
                ) : (
                  center.usage.byModel.map(
                    (m: { model: string; calls: number; tokens: number; cacheHits: number; avgLatency: number }) => (
                      <div key={m.model} className="flex flex-wrap items-center gap-2 rounded-xl bg-muted/25 px-3 py-2 text-[11px]">
                        <Cpu className="size-3.5 text-primary" />
                        <span className="font-mono" dir="ltr">{m.model}</span>
                        <span className="text-muted-foreground">{fmt(m.calls)} استدعاء</span>
                        <span className="text-muted-foreground">{fmt(m.tokens)} توكن</span>
                        <span className="text-muted-foreground">{fmt(m.avgLatency)}ms متوسط</span>
                        {m.cacheHits > 0 && <Badge variant="outline" className="rounded-full text-[9px] text-emerald-600">{fmt(m.cacheHits)} من الذاكرة</Badge>}
                      </div>
                    ),
                  )
                )}
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="text-xs font-bold">لكل وحدة AI (من السجل الحي)</div>
                <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                  {center.routes
                    .filter((r: { task: string }) => center.usage.perTask[r.task])
                    .map((r: { task: string; label: string }) => {
                      const s = center.usage.perTask[r.task];
                      return (
                        <div key={r.task} className="flex items-center justify-between rounded-xl bg-muted/25 px-3 py-2 text-[11px]">
                          <span className="font-bold">{r.label}</span>
                          <span className="text-muted-foreground tabular-nums">
                            {fmt(s.calls)} · {fmt(Math.round(s.ms / Math.max(1, s.calls)))}ms
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════ ⑥ الذاكرة ═══════════════════ */}
        <TabsContent value="cache" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Database className="size-4 text-primary" /> ذاكرة الاستجابة
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 rounded-xl text-rose-600"
                disabled={busy !== null}
                onClick={() =>
                  run("flush", async () => {
                    await flushCache({});
                    toast("أُفرغت الذاكرة — الطلبات القادمة ستُدفع من جديد");
                  })
                }
              >
                {busy === "flush" ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                إفراغ الذاكرة
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <StatCard icon={Database} label="مدخلات محفوظة" value={fmt(center.cache.entries)} />
                <StatCard icon={Zap} label="إصابات الذاكرة" value={fmt(center.cache.hits)} tone="good" />
                <StatCard icon={Coins} label="استدعاءات مُوفَّرة" value={fmt(center.cache.savedCalls)} tone="good" />
              </div>
              <p className="rounded-xl border border-border/60 bg-muted/20 p-3 text-[11px] leading-relaxed text-muted-foreground">
                البصمة = النموذج + الحرارة + نص الرسائل كاملاً. نفس الطلب بالحرف لا يُدفع مرتين. الوحدات التي تحتاج محتوى طازجاً
                (توليد الأسئلة، الرقابة، البلاغات، التعليق) لا تدخل الذاكرة إطلاقاً — الكاش للوحدات المرجعية فقط (الدعم، المساعد، المدرّب).
                تُنظَّف المداخل القديمة تلقائياً في دورة الصيانة.
              </p>
              {center.cache.recent.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-xs font-bold">آخر المداخل</div>
                  {center.cache.recent.map((c: { task: string; model: string; hits: number; createdAt: number }, i: number) => (
                    <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/25 px-3 py-1.5 text-[10px] text-muted-foreground">
                      <span className="font-bold text-foreground">{c.task}</span>
                      <span className="font-mono" dir="ltr">{c.model}</span>
                      <span>{fmt(c.hits)} إصابة</span>
                      <span className="ms-auto">{ago(c.createdAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════ ⑦ القاطع والتبديل ═══════════════════ */}
        <TabsContent value="resilience" className="mt-4 space-y-4">
          <Card className={center.circuit.open ? "border-rose-500/30 bg-rose-500/[0.04]" : ""}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Zap className="size-4 text-primary" /> قاطع الدائرة وسلسلة التبديل
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 rounded-xl"
                disabled={busy !== null}
                onClick={() =>
                  run("circuit", async () => {
                    await resetCircuit({});
                    toast.success("أُعيد ضبط القاطع — الاستدعاء القادم سيُجرّب فوراً");
                  })
                }
              >
                {busy === "circuit" ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                إعادة الضبط
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <StatCard
                  icon={center.circuit.open ? Ban : CheckCircle2}
                  label="حالة القاطع"
                  value={center.circuit.open ? "مفتوح" : "مغلق"}
                  tone={center.circuit.open ? "bad" : "good"}
                  hint={center.circuit.open ? `يُعاد تلقائياً بعد ${fmt(center.circuit.cooldownLeftMs / 1000)}ث` : "الطلبات تمر طبيعياً"}
                />
                <StatCard icon={AlertTriangle} label="فشل متتالٍ" value={fmt(center.circuit.failures)} tone={center.circuit.failures > 0 ? "warn" : "default"} />
                <StatCard icon={Timer} label="مدة التبريد" value={`${fmt(center.guard.cooldownMs / 1000)}ث`} hint={`يُفتح بعد ${fmt(center.guard.failureThreshold)} فشل`} />
              </div>
              {center.circuit.open && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-[11px] text-rose-700">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                  <div>
                    فُتح القاطع تلقائياً لأن المزوّد فشل {fmt(center.circuit.failures)} مرة متتالية — نوقف الضرب عليه حتى يشفى،
                    ثم نُجرّب مرة واحدة (نصف مفتوح). إن نجحت يُغلق القاطع ويُصفَّر العدّاد تلقائياً.
                  </div>
                </div>
              )}

              <Separator />

              <div className="space-y-3">
                <div className="text-xs font-bold">ترتيب التبديل الفعلي</div>
                {(["A", "B"] as const).map((which, idx) => {
                  const p = center.providers[which];
                  if (!p) return null;
                  const preset = center.presets.find((x: { id: string }) => x.id === p.presetId);
                  const chain = [p.model, ...(p.discoveredModels ?? []).slice(0, 3), ...(preset?.models ?? []).slice(0, 3)].filter(
                    (m: string | null | undefined): m is string => Boolean(m),
                  );
                  return (
                    <div key={which} className="rounded-2xl border border-border/60 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="rounded-full text-[10px]">{idx === 0 ? "الأساسي" : "الاحتياطي"}</Badge>
                        <span className="text-xs font-bold">المزوّد {which}</span>
                        <span className="font-mono text-[10px] text-muted-foreground" dir="ltr">
                          {p.baseUrl || "بوابة افتراضية"}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {chain.length === 0 ? (
                          <span className="text-[10px] text-muted-foreground">لا نماذج معروفة — شغّل «اكتشاف النماذج»</span>
                        ) : (
                          chain.slice(0, 5).map((m: string, i: number) => (
                            <span key={`${m}-${i}`} className="rounded-lg bg-muted/40 px-2 py-1 font-mono text-[10px]" dir="ltr">
                              {i + 1}. {m}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  الترتيب: المزوّد الأساسي ← نماذجه بالأسرع أولاً ← المزوّد الاحتياطي ← نماذجه. عند خطأ 400 يتُعاد الطلب بلا
                  إضافات غير مدعومة، وعند 429/401 يُتجاوز المزوّد كاملاً إلى التالي — بلا توقف للعبة.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════ ⑧ الاختبار الحي والسجل ═══════════════════ */}
        <TabsContent value="live" className="mt-4 space-y-4">
          {/* ═══ 🩺 الصحة الحية + الإصلاح الذاتي ═══ */}
          <Card className="border-primary/25 bg-primary/[0.03]">
            <CardHeader className="pb-2">
              <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
                <ShieldCheck className="size-4 text-primary" /> الصحة الحية والإصلاح الذاتي
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={runHealth} disabled={busy === "health"} className="gap-1.5 rounded-lg">
                  {busy === "health" ? <Loader2 className="size-3.5 animate-spin" /> : <HeartPulse className="size-3.5" />}
                  فحص الصحة الآن (طلبات حقيقية)
                </Button>
                <Button size="sm" variant="outline" onClick={runSelfHeal} disabled={busy === "heal"} className="gap-1.5 rounded-lg">
                  {busy === "heal" ? <Loader2 className="size-3.5 animate-spin" /> : <Wrench className="size-3.5" />}
                  إصلاح ذاتي شامل
                </Button>
                <Button size="sm" variant="outline" onClick={runSync} disabled={busy === "sync"} className="gap-1.5 rounded-lg">
                  {busy === "sync" ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                  مزامنة المركز مع كل التبويبات
                </Button>
              </div>
              {syncReport && (
                <div className="space-y-1.5 rounded-xl border border-sky-500/30 bg-sky-500/[0.05] p-3 text-[11px]">
                  <p className="font-bold text-sky-700">
                    تزامن المركز — {syncReport.engines.length} وحدة مرتبطة · البيئة الاحتياطية: {syncReport.envActive ? "فعّالة" : "غير مضبوطة"}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {syncReport.engines.map((e) => (
                      <Badge key={e.key} variant="outline" className="rounded-full text-[10px]">
                        {e.label} ← المركز
                      </Badge>
                    ))}
                  </div>
                  <p className="text-muted-foreground">
                    المزوّد A: {syncReport.slotA?.ok ? `سليم (${syncReport.slotA.model ?? "—"})` : "غير مضبوط/فاشل"} · المزوّد B: {syncReport.slotB?.ok ? `سليم (${syncReport.slotB.model ?? "—"})` : "غير مضبوط/فاشل"}
                  </p>
                </div>
              )}
              {liveHealth && (
                <div className="space-y-2 rounded-xl border border-border/60 bg-background/60 p-3">
                  {liveHealth.slots.length === 0 && (
                    <p className="text-xs text-muted-foreground">لا يوجد مزوّد مضبوط في المركز — يعمل النظام حالياً على {liveHealth.envActive ? "التشغيل الاحتياطي من مفاتيح الخادم (Gemini)" : "لا شيء"}.</p>
                  )}
                  {liveHealth.slots.map((s) => (
                    <div key={s.slot} className="flex flex-wrap items-center gap-2 text-[11px]">
                      <Badge variant="outline" className={cn("rounded-full", s.ok ? "border-emerald-500/40 text-emerald-600" : "border-rose-500/40 text-rose-600")}>
                        {s.ok ? "✓ يستجيب" : "✗ لا يستجيب"} {s.slot}
                      </Badge>
                      {s.model && <span className="font-mono" dir="ltr">{s.model}</span>}
                      <span className="text-muted-foreground">{fmt(s.latencyMs)}ms</span>
                      {s.error && <span className="text-rose-600">{s.error}</span>}
                    </div>
                  ))}
                  {liveHealth.circuitWasOpen && (
                    <p className="text-[11px] text-amber-600">
                      {liveHealth.circuitReset ? "🩹 أُعيد فتح القاطع تلقائياً — الشفاء نجح" : "القاطع مفتوح والفحص لم ينجح — أصلح السبب أولاً"}
                    </p>
                  )}
                </div>
              )}
              {healLog.length > 0 && (
                <ul className="space-y-1 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.05] p-3 text-[11px] text-emerald-700">
                  {healLog.map((a, i) => (
                    <li key={i}>✓ {a}</li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <FlaskConical className="size-4 text-primary" /> اختبار حي — شغّل وحدة AI واعرف نتيجتها الحقيقية
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {center.routes.map((r: { task: string; label: string }) => (
                  <button
                    key={r.task}
                    type="button"
                    onClick={() => setLiveTask(r.task)}
                    className={cn(
                      "rounded-xl border px-2.5 py-1.5 text-[11px] font-bold transition-colors",
                      liveTask === r.task
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border/60 text-muted-foreground hover:border-primary/40",
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <Textarea
                value={livePrompt}
                onChange={(e) => setLivePrompt(e.target.value)}
                placeholder="اكتب ما تريد تجربته على هذه الوحدة… (فارغ = اختبار جاهزية سريع)"
                rows={3}
                className="rounded-xl text-xs"
              />
              <Button
                className="gap-1.5 rounded-xl"
                disabled={busy !== null}
                onClick={() =>
                  run("live", async () => {
                    const r = await testTask({ task: liveTask, prompt: livePrompt });
                    setLiveResult(r as unknown as Record<string, unknown>);
                    if (r.ok) toast.success("نجح الاختبار — الردّ الحقيقي ظاهر بالأسفل");
                    else toast.error(`فشل: ${r.error?.slice(0, 140) ?? "سبب غير معروف"}`);
                  })
                }
              >
                {busy === "live" ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                تشغيل الاختبار
              </Button>

              {liveResult && (
                <div
                  className={cn(
                    "space-y-2 rounded-2xl border p-3",
                    liveResult.ok ? "border-emerald-500/30 bg-emerald-500/[0.05]" : "border-rose-500/30 bg-rose-500/[0.05]",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    {liveResult.ok ? (
                      <CheckCircle2 className="size-3.5 text-emerald-600" />
                    ) : (
                      <XCircle className="size-3.5 text-rose-600" />
                    )}
                    <span className="font-bold">{String(liveResult.taskLabel ?? liveResult.taskKey)}</span>
                    {Boolean(liveResult.model) && <span className="font-mono" dir="ltr">{String(liveResult.model)}</span>}
                    <span className="text-muted-foreground">{fmt(Number(liveResult.latencyMs))}ms</span>
                    <span className="text-muted-foreground">
                      {fmt(Number(liveResult.tokensIn))} داخل · {fmt(Number(liveResult.tokensOut))} خارج
                    </span>
                    {Boolean(liveResult.cached) && (
                      <Badge variant="outline" className="rounded-full text-[9px] text-emerald-600">من الذاكرة</Badge>
                    )}
                  </div>
                  <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-xl bg-background/70 p-3 text-[11px] leading-relaxed">
                    {liveResult.ok ? String(liveResult.text ?? "") : String(liveResult.error ?? "فشل غير معروف")}
                  </pre>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <ScrollText className="size-3.5 text-muted-foreground" />
                <span className="text-xs font-bold">السجل الحي — آخر ٤٠ استدعاء من كل اللعبة</span>
              </div>
              <div className="space-y-1">
                {center.events.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border/70 py-6 text-center text-[11px] text-muted-foreground">
                    السجل فارغ — أي استدعاء AI في اللعبة سيظهر هنا فوراً بنموذجه وزمنه وتوكناته وسبب فشله إن فشل.
                  </p>
                ) : (
                  center.events.map(
                    (
                      e: {
                        ok: boolean;
                        provider: string;
                        taskLabel: string;
                        model: string;
                        latencyMs: number;
                        tokensIn: number;
                        tokensOut: number;
                        cached: boolean;
                        attempt: number;
                        error?: string;
                        at: number;
                      },
                      i: number,
                    ) => (
                      <div key={i} className="rounded-xl bg-muted/25 px-3 py-2 text-[10px]">
                        <div className="flex flex-wrap items-center gap-2">
                          {e.cached ? (
                            <Database className="size-3 text-emerald-600" />
                          ) : e.ok ? (
                            <CheckCircle2 className="size-3 text-emerald-600" />
                          ) : (
                            <XCircle className="size-3 text-rose-600" />
                          )}
                          <span className="font-bold text-foreground">{e.taskLabel}</span>
                          <span className="font-mono text-muted-foreground" dir="ltr">{e.model}</span>
                          <span className="text-muted-foreground">مزوّد {e.provider}</span>
                          <span className="text-muted-foreground">{fmt(e.latencyMs)}ms</span>
                          {(e.tokensIn > 0 || e.tokensOut > 0) && (
                            <span className="text-muted-foreground">{fmt(e.tokensIn + e.tokensOut)} توكن</span>
                          )}
                          {e.attempt > 1 && <span className="text-amber-600">محاولة {e.attempt}</span>}
                          <span className="ms-auto">{ago(e.at)}</span>
                        </div>
                        {!e.ok && e.error && (
                          <div className="mt-1 rounded-lg bg-rose-500/10 px-2 py-1 text-[10px] leading-relaxed text-rose-700" dir="ltr">
                            {e.error}
                          </div>
                        )}
                      </div>
                    ),
                  )
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="border-emerald-500/25 bg-emerald-500/[0.03]">
        <CardContent className="space-y-1.5 py-4 text-[11px] leading-relaxed text-muted-foreground">
          <p className="flex items-center gap-2 font-bold text-foreground">
            <ShieldCheck className="size-3.5 text-emerald-600" /> ضمانات هذا المركز
          </p>
          <p>• كل استدعاء AI في اللعبة يمرّ من محرّك واحد يقرأ هذه الإعدادات — لا مسار خلفي ولا مفتاح في الكود.</p>
          <p>• ربط كل وحدة يتم من مصفوفة التوجيه: أي قسم في اللعبة يُضبط بدون لمس سطر كود.</p>
          <p>• أي مزوّد جديد مستقبلاً: أضف رابطاً ومفتاحاً، وسيكتشف نماذجه ويعمل تلقائياً.</p>
          <p>• كل رقم في هذه اللوحة مقيس من طلبات حقيقية — وإن فشل شيء يظهر نصّ فشله كما ردّه المزوّد.</p>
        </CardContent>
      </Card>
    </div>
  );
}
