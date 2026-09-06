import { useState, type ChangeEvent, type FC, type LucideProps } from "react";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button, Input, Textarea, Badge, Switch, Card, CardHeader, CardTitle, CardContent, Separator } from "@/components/ui";
import { ADMIN_AI_KEY, ADMIN_AI_MODEL, ADMIN_AI_PROVIDER } from "@/lib/aiCredentials";
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
  Scope as ScopeIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const ScopeIconFC: FC<LucideProps> = ScopeIcon;

const SCOPE_OPTIONS = [
  { value: "everything", label: "كل شيء في اللعبة", icon: Layers, hint: "وظائف متنوعة" },
  { value: "side", label: "قسم محدد (اختر من القائمة)", icon: GitBranch, hint: "مثال: غرف / PEG / أسئلة" },
  { value: "item", label: "شئ محدد واحد", icon: ScopeIconFC, hint: "تعيين هدف واحد" },
];

export function ApiHubTab() {
  const apis = useQuery(api.apiHubStore.listApisSafe, {});
  const viceSystems = useQuery(api.apiHubInternal.listViceSystems, {});
  const removeApi = useMutation(api.apiHubStore.removeApi);
  const testApi = useAction(api.apiHub.testApi);
  const discoverFromCurl = useAction(api.apiHub.discoverFromCurl);
  const smartCall = useAction(api.apiHub.smartCall);

  const [curlInput, setCurlInput] = useState("");
  const [discovering, setDiscovering] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [lastDiscovered, setLastDiscovered] = useState<string | null>(null);
  const [testMsg, setTestMsg] = useState("");
  const [scopeMode, setScopeMode] = useState<string>("everything");
  const [scopeTarget, setScopeTarget] = useState("");
  const [keyMasked, setKeyMasked] = useState(true);
  const [autoDiscoverEnabled, setAutoDiscoverEnabled] = useState(true);
  const [fallbackChainEnabled, setFallbackChainEnabled] = useState(true);
  const [liveStatsEnabled, setLiveStatsEnabled] = useState(true);

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

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ScopeIconFC className="size-4 text-primary" />
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
                    <div className="ms-auto flex gap-1.5">
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
                  </div>
                </div>
              );
            })
          )}
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
