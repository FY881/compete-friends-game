import React, { useState, type ChangeEvent, type ElementType } from "react";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button, Input, Textarea, Badge, Switch, Card, CardHeader, CardTitle, CardContent, Separator, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui";
import { ADMIN_AI_KEY, ADMIN_AI_MODEL, ADMIN_AI_PROVIDER } from "@/lib/aiCredentials";
import { ASSISTANT_MINDS } from "@/lib/assistantMinds";
import {
  Code,
  Loader2,
  Globe,
  Plug,
  Radar,
  Trash2,
  FlaskConical,
  Hammer,
  CheckCircle2,
  XCircle,
  GitBranch,
  Layers,
  Cpu,
  ShieldCheck,
  Zap,
  KeyRound,
  SearchCheck,
  Users,
  Power,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const SCOPE_OPTIONS: Array<{ value: string; label: string; icon: ElementType; hint: string }> = [
  { value: "everything", label: "كل شيء في اللعبة", icon: Layers, hint: "وظائف متنوعة" },
  { value: "side", label: "قسم محدد (اختر من القائمة)", icon: GitBranch, hint: "مثال: غرف / PEG / أسئلة" },
  { value: "item", label: "شئ محدد واحد", icon: InboxIcon, hint: "تعيين هدف واحد" },
];

function InboxIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

export function ApiHubTab() {
  const apis = useQuery(api.apiHubStore.listApisSafe, {});
  const viceSystems = useQuery(api.apiHubInternal.listViceSystems, {});
  const removeApi = useMutation(api.apiHubStore.removeApi);
  const testApi = useAction(api.apiHub.testApi);
  const discoverFromCurl = useAction(api.apiHub.discoverFromCurl);
  const smartCall = useAction(api.apiHub.smartCall);
  const analyzeAndAddKey = useAction(api.apiHub.analyzeAndAddKey);
  const deepInspectKey = useAction(api.apiHub.deepInspectKey);
  const mergeSafeguard = useAction(api.apiHub.mergeSafeguard);
  const setApiEnabled = useMutation(api.apiHubStore.setApiEnabled);
  const replaceApiKey = useMutation(api.apiHubStore.replaceApiKey);

  const [curlInput, setCurlInput] = useState("");
  const [discovering, setDiscovering] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [analyzingKey, setAnalyzingKey] = useState(false);
  const [keyReport, setKeyReport] = useState<{
    ok: boolean;
    latencyMs: number;
    sample: string;
    probeError: string;
    keyPreview: string;
    analysis: {
      provider: string;
      model: string;
      likelyService: string;
      usageHint: string;
      notes: string;
      quality: number;
      capabilities: string[];
    };
  } | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [lastDiscovered, setLastDiscovered] = useState<string | null>(null);
  const [testMsg, setTestMsg] = useState("");
  const [scopeMode, setScopeMode] = useState<string>("everything");
  const [scopeTarget, setScopeTarget] = useState("");
  const [keyMasked, setKeyMasked] = useState(true);
  const [autoDiscoverEnabled, setAutoDiscoverEnabled] = useState(true);
  const [fallbackChainEnabled, setFallbackChainEnabled] = useState(true);
  const [liveStatsEnabled, setLiveStatsEnabled] = useState(true);
  const [deepRaw, setDeepRaw] = useState("");
  const [deepReport, setDeepReport] = useState<Awaited<ReturnType<typeof deepInspectKey>> | null>(null);
  const [deepBusy, setDeepBusy] = useState(false);
  const [deepConnecting, setDeepConnecting] = useState(false);
  const [guardAssistant, setGuardAssistant] = useState(ASSISTANT_MINDS[0]?.id ?? "");
  const [guardOpts, setGuardOpts] = useState({ hunter: true, security: true, economy: true });
  const [guardBusy, setGuardBusy] = useState(false);
  const [guardResult, setGuardResult] = useState<Awaited<ReturnType<typeof mergeSafeguard>> | null>(null);
  const [replaceId, setReplaceId] = useState<string | null>(null);
  const [replaceKey, setReplaceKey] = useState("");

  const handleAnalyzeKey = async () => {
    if (!keyInput.trim()) return toast.error("الصق مفتاح AI أولاً");
    setAnalyzingKey(true);
    setKeyReport(null);
    try {
      const res = await analyzeAndAddKey({ rawKey: keyInput.trim() });
      setKeyReport(res);
      if (res.ok) {
        toast.success(`المفتاح يعمل ورُبط باللعبة (${res.latencyMs}ms)`);
      } else {
        toast.error("تعذّر التحقق من المفتاح — تفاصيل التحليل في التقرير أدناه");
      }
      setKeyInput("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل التحليل");
    } finally {
      setAnalyzingKey(false);
    }
  };

  const handleDiscover = async () => {
    if (!curlInput.trim()) return toast.error("الصق أمر curl أولاً");
    setDiscovering(true);
    try {
      const res = await discoverFromCurl({ curlCommand: curlInput.trim() });
      setLastDiscovered(res.spec);
      setCurlInput("");
      toast.success(`تم اكتشاف وتسجيل «${res.name}» — جاهز للاستخدام`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الاكتشاف");
    } finally {
      setDiscovering(false);
    }
  };

  const handleTest = async (apiId: string) => {
    setTestingId(apiId);
    try {
      const res = await testApi({ apiId: apiId as never });
      if (res.ok) toast.success(`يعمل! زمن الاستجابة ${res.latencyMs}ms`);
      else toast.error(`فشل الاتصال (${res.latencyMs}ms)`);
    } catch {
      toast.error("فشل الاختبار");
    } finally {
      setTestingId(null);
    }
  };

  const handleSmartCall = async () => {
    setTestMsg("");
    try {
      const res = await smartCall({
        messages: [{ role: "user", content: "قل جملة واحدة قصيرة بالعربية تعلن أنك جاهز." }],
        maxTokens: 60,
        temperature: 0.7,
      });
      setTestMsg(`✓ ${res.provider}: ${res.reply.slice(0, 120)}`);
    } catch (e) {
      setTestMsg(`✗ ${e instanceof Error ? e.message : "فشل"}`);
    }
  };

  const handleDeepInspect = async () => {
    if (!deepRaw.trim()) return toast.error("الصق مفتاح API لفحصه بعمق");
    setDeepBusy(true);
    setDeepReport(null);
    try {
      const res = await deepInspectKey({ rawKey: deepRaw.trim() });
      setDeepReport(res);
      toast.success(res.verified ? "المفتاح يعمل فعلياً — يمكنك ربطه الآن" : "المفتاح لم يُقبل من أي مزود");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الفحص العميق");
    } finally {
      setDeepBusy(false);
    }
  };

  const handleConnectFromDeep = async () => {
    const key = deepRaw.trim();
    if (!key) return toast.error("أعد لصق المفتاح أولاً");
    const verified = deepReport?.matched.find((m) => m.ok);
    setDeepConnecting(true);
    try {
      const res = await analyzeAndAddKey({
        rawKey: key,
        ...(verified ? { providerHint: verified.provider } : {}),
      });
      if (res.ok) {
        toast.success(`المفتاح يعمل ورُبط باللعبة على ${res.analysis.provider} (${res.latencyMs}ms)`);
        setDeepReport(null);
        setDeepRaw("");
      } else {
        toast.error("تعذّر الربط — تفاصيل في تقرير التحليل");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الربط");
    } finally {
      setDeepConnecting(false);
    }
  };

  const handleRunGuard = async () => {
    if (!guardAssistant) return toast.error("اختر مساعداً أولاً");
    setGuardBusy(true);
    setGuardResult(null);
    try {
      const res = await mergeSafeguard({
        assistantId: guardAssistant,
        includeErrorHunter: guardOpts.hunter,
        includeSecurity: guardOpts.security,
        includeEconomyWatch: guardOpts.economy,
      });
      setGuardResult(res);
      toast.success(`انتهت جولة الحارس: ${res.guardName}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل تشغيل الحارس المدمج");
    } finally {
      setGuardBusy(false);
    }
  };

  const handleReplace = async (apiId: string) => {
    if (!replaceKey.trim()) return toast.error("الصق المفتاح الجديد");
    try {
      await replaceApiKey({ apiId: apiId as never, apiKey: replaceKey.trim() });
      toast.success("استُبدل المفتاح وأُعيد ضبطه للفحص");
      setReplaceId(null);
      setReplaceKey("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الاستبدال");
    }
  };

  const maskedKey = keyMasked
    ? `${ADMIN_AI_KEY.slice(0, 8)}…${ADMIN_AI_KEY.slice(-4)}`
    : ADMIN_AI_KEY;

  return (
    <div className="space-y-6">
      <Card className="border-amber-500/30 bg-amber-500/[0.04]">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="size-4 text-amber-600" />
            مفتاح نائب الرئيس الرسمي
            <Badge variant="outline" className="ms-auto rounded-full text-[10px] text-amber-600">
              المتحكم الرئيسي
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <ShieldCheck className="size-3.5 text-emerald-600" />
            <span className="text-muted-foreground">هذا المفتاح يتحكم في كل أنظمة الذكاء داخل اللعبة — نائب الرئيس + كل الأنظمة الآلية.</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-muted/20 p-3">
            <Code className="size-4 text-muted-foreground" />
            <Textarea
              value={maskedKey}
              readOnly
              rows={2}
              className="rounded-md font-mono text-xs resize-none border-0 bg-transparent p-0 shadow-none h-auto"
              dir="ltr"
            />
            <Button variant="outline" size="sm" className="shrink-0 rounded-lg" onClick={() => setKeyMasked((v) => !v)}>
              {keyMasked ? "إظهار" : "إخفاء"}
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline" className="rounded-full text-[10px] font-mono">{ADMIN_AI_PROVIDER}</Badge>
            <Badge variant="outline" className="rounded-full text-[10px] font-mono">{ADMIN_AI_MODEL}</Badge>
            <Badge variant="outline" className="rounded-full text-[10px]">نائب الرئيس</Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/30 bg-primary/[0.03]">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="size-4 text-primary" />
            أضف أي مفتاح AI تلقائياً — المحلل الذكي يفحصه ويربطه باللعبة
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={keyInput}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setKeyInput(e.target.value)}
            placeholder="الصق مفتاح API هنا (مثل sk-...)"
            rows={2}
            className="rounded-xl font-mono text-xs"
            dir="ltr"
          />
          <div className="flex items-center gap-2">
            <Button onClick={handleAnalyzeKey} disabled={analyzingKey} className="gap-1.5 rounded-xl">
              {analyzingKey ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
              حلّل واربط باللعبة
            </Button>
            <p className="text-xs text-muted-foreground">
              يحلل AI المفتاح (المزود والنموذج)، يفحصه باختبار حي، ويضيفه لسلسلة الاستدعاء الذكي.
            </p>
          </div>
          {keyReport && (
            <div className="space-y-2 rounded-xl border border-border/60 bg-card p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1.5 text-sm font-bold">
                  {keyReport.ok ? <CheckCircle2 className="size-4 text-emerald-600" /> : <XCircle className="size-4 text-rose-600" />}
                  {keyReport.ok ? "المفتاح يعمل ورُبط باللعبة" : "المفتاح غير صالح — لم يُربط"}
                </span>
                <Badge variant="outline" className="rounded-full text-[10px]">{keyReport.keyPreview}</Badge>
                {keyReport.ok && <Badge variant="outline" className="rounded-full text-[10px] text-emerald-600">{keyReport.latencyMs}ms</Badge>}
              </div>
              <div className="flex flex-wrap gap-2 text-[10px]">
                <span className="rounded-full bg-muted px-2 py-0.5 font-semibold">المزود: {keyReport.analysis.provider}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 font-semibold font-mono">{keyReport.analysis.model}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 font-semibold">الخدمة المرجحة: {keyReport.analysis.likelyService}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 font-semibold">جودة {keyReport.analysis.quality}/100</span>
              </div>
              {keyReport.analysis.capabilities?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {keyReport.analysis.capabilities.map((c) => (
                    <span key={c} className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-semibold text-primary">{c}</span>
                  ))}
                </div>
              )}
              {keyReport.ok && keyReport.sample && (
                <p className="rounded-lg bg-muted/40 px-3 py-2 text-[11px]" dir="auto">عيّنة الرد: {keyReport.sample}</p>
              )}
              {!keyReport.ok && keyReport.probeError && (
                <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-[11px] text-rose-700">{keyReport.probeError}</p>
              )}
              {keyReport.analysis.usageHint && (
                <p className="text-[11px] text-muted-foreground">نصيحة: {keyReport.analysis.usageHint}</p>
              )}
              {keyReport.analysis.notes && (
                <p className="text-[11px] text-muted-foreground">{keyReport.analysis.notes}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers className="size-4 text-primary" />
            نطاق تحكم الـ API — شئ معين / قسم / كل شيء
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-3">
            {SCOPE_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={cn(
                    "flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all",
                    scopeMode === opt.value
                      ? "border-primary/50 bg-primary/5"
                      : "border-border/60 bg-muted/20 hover:bg-muted/40",
                  )}
                  onClick={() => setScopeMode(opt.value)}
                >
                  <Icon className="size-4 text-primary" />
                  <div className="space-y-0.5">
                    <p className="text-sm font-bold">{opt.label}</p>
                    <p className="text-[10px] text-muted-foreground">{opt.hint}</p>
                  </div>
                </button>
              );
            })}
          </div>
          {scopeMode === "side" && (
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs font-semibold text-muted-foreground">القسم أو النظام:</label>
              <Input
                value={scopeTarget}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setScopeTarget(e.target.value)}
                placeholder="مثال: apiHub, questionBank, rooms, viceOwner"
                className="rounded-xl font-mono text-xs w-72"
              />
            </div>
          )}
          {scopeMode === "item" && (
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs font-semibold text-muted-foreground">الشئ المحدد:</label>
              <Input
                value={scopeTarget}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setScopeTarget(e.target.value)}
                placeholder="مثال: rooms:live, questions:ai-123"
                className="rounded-xl font-mono text-xs w-72"
              />
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            النطاق يحدد أي أقسام يُسمح للـ API بالتحكم فيها عند الاستدعاءات الموجّهة من نائب الرئيس.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Cpu className="size-4 text-primary" />
            خيارات مركز API
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Radar className="size-4 text-primary" />
              <span className="text-sm font-semibold">اكتشاف تلقائي من أوامر curl</span>
            </div>
            <Switch checked={autoDiscoverEnabled} onCheckedChange={setAutoDiscoverEnabled} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <GitBranch className="size-4 text-primary" />
              <span className="text-sm font-semibold">سلسلة بديلة ذكية</span>
            </div>
            <Switch checked={fallbackChainEnabled} onCheckedChange={setFallbackChainEnabled} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Zap className="size-4 text-primary" />
              <span className="text-sm font-semibold">إحصائيات حية للاستدعاءات</span>
            </div>
            <Switch checked={liveStatsEnabled} onCheckedChange={setLiveStatsEnabled} />
          </div>
          <Separator />
          <div className="flex flex-wrap justify-between gap-3 text-xs text-muted-foreground">
            <span>المفتاح الرسمي للنائب: {maskedKey}</span>
            <span className="font-mono">{ADMIN_AI_PROVIDER} · {ADMIN_AI_MODEL}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/25 bg-primary/[0.03]">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Radar className="size-4 text-primary" />
            الاكتشاف التلقائي — الصق أمر curl وسيتعرف عليه AI ويسجّله
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={curlInput}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setCurlInput(e.target.value)}
            placeholder={"curl https://api.example.com/v1/chat \\n  -H 'Authorization: Bearer sk-...' \\n  -d '{\"model\":\"...\",\"messages\":[...]} '"}
            rows={4}
            className="rounded-xl font-mono text-xs"
            dir="ltr"
          />
          <div className="flex items-center gap-2">
            <Button onClick={handleDiscover} disabled={discovering} className="gap-1.5 rounded-xl">
              {discovering ? <Loader2 className="size-4 animate-spin" /> : <Radar className="size-4" />}
              تعرّف وادمج تلقائياً
            </Button>
            <p className="text-xs text-muted-foreground">
              يحلل AI الأمر ويستخرج الرابط والمفتاح ونمط المصادقة والنموذج — ويسجل API كاملاً.
            </p>
          </div>
          {lastDiscovered && (
            <pre className="max-h-40 overflow-auto rounded-xl border border-border/60 bg-muted/30 p-3 text-left font-mono text-[10px]" dir="ltr">
              {lastDiscovered}
            </pre>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            <Globe className="size-4 text-primary" />
            سجل واجهات البرمجة ({apis?.length ?? 0})
            <Button variant="outline" size="sm" className="ms-auto gap-1.5 rounded-xl" onClick={handleSmartCall}>
              <Plug className="size-3.5" /> استدعاء ذكي تجريبي
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {testMsg && (
            <p className="rounded-xl bg-muted/40 px-4 py-2.5 text-xs" dir="auto">{testMsg}</p>
          )}
          {!apis ? (
            <div className="flex justify-center py-10"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
          ) : apis.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border/70 py-10 text-center text-sm text-muted-foreground">
              لا توجد APIs مسجّلة بعد — الصق أمر curl أعلاه ليتعرف عليه النظام ويدمجه.
            </p>
          ) : (
            apis.map((a) => {
              const statusMeta = {
                active: { label: "يعمل", cls: "text-emerald-600" },
                untested: { label: "لم يُختبر", cls: "text-muted-foreground" },
                failed: { label: "فشل", cls: "text-rose-600" },
                disabled: { label: "معطّل", cls: "text-amber-600" },
              }[a.status] ?? { label: "لم يُختبر", cls: "text-muted-foreground" };
              return (
                <div key={a._id} className="rounded-xl border border-border/60 bg-card p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold">{a.name}</span>
                    <Badge variant="outline" className="rounded-full text-[10px]">{a.provider}</Badge>
                    {a.model && <Badge variant="outline" className="rounded-full text-[10px] font-mono">{a.model}</Badge>}
                    <Badge variant="outline" className="rounded-full text-[10px]">{a.authStyle}</Badge>
                    {a.source === "auto-discovered" && (
                      <Badge variant="outline" className="rounded-full text-[10px] text-sky-600">اكتُشف تلقائياً</Badge>
                    )}
                    <span className={cn("ms-auto flex items-center gap-1 text-[10px] font-bold", statusMeta.cls)}>
                      {a.status === "active" ? <CheckCircle2 className="size-3" /> : a.status === "failed" ? <XCircle className="size-3" /> : null}
                      {statusMeta.label}
                    </span>
                  </div>
                  <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground" dir="ltr">{a.baseUrl}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {a.capabilities?.map((c) => (
                      <span key={c} className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-semibold">{c}</span>
                    ))}
                    {a.lastLatencyMs !== undefined && (
                      <span className="text-[10px] text-muted-foreground">آخر زمن: {a.lastLatencyMs}ms</span>
                    )}
                    <span className="text-[10px] text-muted-foreground">نجاح {a.successCount} / فشل {a.failCount}</span>
                    <div className="ms-auto flex flex-wrap items-center gap-1.5">
                      <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Power className="size-3" />
                        <Switch
                          checked={a.status !== "disabled"}
                          onCheckedChange={async (on) => {
                            await setApiEnabled({ apiId: a._id, enabled: on });
                            toast(on ? "تم تفعيل API" : "أُوقف API — لن يُستخدم بعد الآن");
                          }}
                          className="scale-75"
                        />
                      </label>
                      <Button variant="outline" size="sm" className="h-7 gap-1 rounded-lg text-[11px]" onClick={() => { setReplaceId(a._id); setReplaceKey(""); }}>
                        <KeyRound className="size-3" /> استبدال مفتاح
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 gap-1 rounded-lg text-[11px]" onClick={() => handleTest(a._id)} disabled={testingId === a._id}>
                        {testingId === a._id ? <Loader2 className="size-3 animate-spin" /> : <FlaskConical className="size-3" />}
                        اختبار حي
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 rounded-lg text-rose-600"
                        onClick={async () => {
                          await removeApi({ apiId: a._id });
                          toast("حُذف من السجل");
                        }}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                    {replaceId === a._id && (
                      <div className="mt-2 flex w-full items-center gap-2">
                        <Input
                          value={replaceKey}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => setReplaceKey(e.target.value)}
                          placeholder="الصق المفتاح الجديد هنا…"
                          className="h-8 rounded-lg font-mono text-xs"
                          dir="ltr"
                        />
                        <Button size="sm" className="h-8 rounded-lg" onClick={() => handleReplace(a._id)}>
                          تأكيد
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card className="border-sky-500/30 bg-sky-500/[0.04]">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <SearchCheck className="size-4 text-sky-600" />
            الفحص العميق للمفتاح — اعرف كل شيء عنه قبل ربطه
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={deepRaw}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setDeepRaw(e.target.value)}
              placeholder="الصق مفتاح API لفحصه على 6 مزودين…"
              className="min-w-0 flex-1 rounded-xl font-mono text-xs"
              dir="ltr"
            />
            <Button onClick={handleDeepInspect} disabled={deepBusy} className="gap-1.5 rounded-xl">
              {deepBusy ? <Loader2 className="size-4 animate-spin" /> : <SearchCheck className="size-4" />}
              افحص بعمق
            </Button>
          </div>
          {deepReport && (
            <div className="space-y-2 rounded-xl border border-border/60 bg-card p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1.5 text-sm font-bold">
                  {deepReport.verified ? <CheckCircle2 className="size-4 text-emerald-600" /> : <XCircle className="size-4 text-rose-600" />}
                  {deepReport.verified ? "يعمل فعلياً" : "لا يُقبل من أي مزود"}
                </span>
                <Badge variant="outline" className="rounded-full text-[10px]">{deepReport.keyPreview}</Badge>
                <Badge variant="outline" className="rounded-full text-[10px]">الطول {deepReport.length}</Badge>
                <Badge variant="outline" className="rounded-full text-[10px]">بادئة: {deepReport.recognizedProvider}</Badge>
                {deepReport.bestLatencyMs > 0 && <Badge variant="outline" className="rounded-full text-[10px] text-emerald-600">أفضل زمن {deepReport.bestLatencyMs}ms</Badge>}
              </div>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {deepReport.matched.map((m) => (
                  <div key={m.provider} className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-1.5 text-[11px]">
                    <span>{m.ok ? <CheckCircle2 className="size-3 text-emerald-600" /> : <XCircle className="size-3 text-rose-600" />}</span>
                    <span className="font-semibold">{m.provider}</span>
                    <span className="text-muted-foreground">{m.latencyMs}ms</span>
                    {m.hint && <span className="truncate text-muted-foreground">{m.hint}</span>}
                  </div>
                ))}
              </div>
              {deepReport.recommendations?.length > 0 && (
                <ul className="space-y-1">
                  {deepReport.recommendations.map((r, i) => (
                    <li key={i} className="text-[11px] text-muted-foreground">• {r}</li>
                  ))}
                </ul>
              )}
              <Button
                onClick={handleConnectFromDeep}
                disabled={deepConnecting || !deepReport.verified || !deepRaw.trim()}
                className="gap-1.5 rounded-xl"
              >
                {deepConnecting ? <Loader2 className="size-4 animate-spin" /> : <Plug className="size-4" />}
                {deepReport.verified ? "اربط باللعبة الآن" : "المفتاح غير صالح — لا يمكن ربطه"}
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            يفحص المفتاح فعلياً على OpenRouter / OpenAI / Anthropic / Groq / Mistral / Together — يقيس الزمن، يكشف المزود الحقيقي، يرفع قائمة النماذج المتاحة، ويوصي بما تفعل.
          </p>
        </CardContent>
      </Card>

      <Card className="border-violet-500/30 bg-violet-500/[0.04]">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="size-4 text-violet-600" />
            الحارس المدمج — مساعد نائب المالك + صياد الأخطاء
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={guardAssistant} onValueChange={setGuardAssistant}>
              <SelectTrigger className="w-64 rounded-xl">
                <SelectValue placeholder="اختر مساعداً…" />
              </SelectTrigger>
              <SelectContent>
                {ASSISTANT_MINDS.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.emoji} {m.name} — {m.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-xs">
              <Switch checked={guardOpts.hunter} onCheckedChange={(v) => setGuardOpts((o) => ({ ...o, hunter: v }))} />
              <ShieldCheck className="size-3.5 text-emerald-600" /> صياد الأخطاء
            </label>
            <label className="flex items-center gap-2 text-xs">
              <Switch checked={guardOpts.security} onCheckedChange={(v) => setGuardOpts((o) => ({ ...o, security: v }))} />
              <ShieldCheck className="size-3.5 text-rose-600" /> المراقبة الأمنية
            </label>
            <label className="flex items-center gap-2 text-xs">
              <Switch checked={guardOpts.economy} onCheckedChange={(v) => setGuardOpts((o) => ({ ...o, economy: v }))} />
              <ShieldCheck className="size-3.5 text-amber-600" /> الرقابة الاقتصادية
            </label>
          </div>
          <Button onClick={handleRunGuard} disabled={guardBusy} className="gap-1.5 rounded-xl">
            {guardBusy ? <Loader2 className="size-4 animate-spin" /> : <Users className="size-4" />}
            شغّل جولة الحارس المدمج
          </Button>
          {guardResult && (
            <div className="space-y-2 rounded-xl border border-border/60 bg-card p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold">{guardResult.guardName}</span>
                <Badge variant="outline" className="rounded-full text-[10px] text-violet-600">حارس فعلي نشط</Badge>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {guardResult.mergedCapabilities.map((c) => (
                  <span key={c} className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold text-violet-700">{c}</span>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {Object.entries(guardResult.report).filter(([k]) => !["errorCategories", "healthStatus"].includes(k)).map(([k, val]) => (
                  <div key={k} className="rounded-lg bg-muted/30 px-2 py-1.5 text-center">
                    <p className="text-lg font-bold">{String(val)}</p>
                    <p className="text-[9px] text-muted-foreground">{k}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold text-muted-foreground">الحالة الصحية:</span>
                <Badge variant="outline" className="rounded-full text-[10px]">{guardResult.report.healthStatus}</Badge>
              </div>
              <ul className="space-y-1">
                {guardResult.findings.map((f, i) => (
                  <li key={i} className="text-[11px] text-muted-foreground">• {f}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            تدمج قدرات المساعد المختار مع صياد الأخطاء في حارس واحد يراقب الأخطاء والـ APIs والأمن — لضمان سلاسة النظام وخلوه من الأعطال، وهو مدمج فعلياً في سلسلة الاستدعاء الذكي.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Hammer className="size-4 text-amber-600" />
            أنظمة ابتكرها نائب المالك بنفسه ({viceSystems?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!viceSystems || viceSystems.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border/70 py-8 text-center text-sm text-muted-foreground">
              عندما يبتكر نائب المالك نظاماً جديداً سيظهر هنا بمواصفاته الكاملة.
            </p>
          ) : (
            viceSystems.map((s) => (
              <div key={s._id} className="rounded-xl border border-border/60 bg-card p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold">{s.name}</span>
                  <Badge variant="outline" className="rounded-full text-[10px] text-amber-600">ابتكاره بنفسه</Badge>
                  <span className="ms-auto text-[10px] text-muted-foreground">
                    {new Date(s.createdAt).toLocaleDateString("ar-SA")}
                  </span>
                </div>
                {s.purpose && <p className="mt-1 text-xs text-muted-foreground">{s.purpose}</p>}
                {s.spec && (
                  <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded-lg bg-muted/30 p-2 text-[10px] leading-relaxed">
                    {s.spec}
                  </pre>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
