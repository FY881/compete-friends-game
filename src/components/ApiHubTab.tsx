// ═══════════════════════════════════════════════════════════════
// مركز API — النظامان الوحيدان (لا ثالث لهما)
//  ⚙️ النظام الأول: مفتاح API + رابط المزود (URL)
//  🔑 النظام الثاني: مفتاح API فقط (بوابة افتراضية)
// كل تحقق طلب شبكة حقيقي، والدليل يُسجَّل في السجل.
// ═══════════════════════════════════════════════════════════════
import React, { useState, type ChangeEvent } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button, Input, Badge, Card, CardHeader, CardTitle, CardContent, Separator } from "@/components/ui";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Globe,
  KeyRound,
  CheckCircle2,
  XCircle,
  Loader2,
  Trash2,
  FlaskConical,
  ShieldCheck,
  ScrollText,
  Plug,
} from "lucide-react";

type ProofCall = {
  ok: boolean;
  provider: string;
  latencyMs: number;
  taskType: string;
  createdAt: number;
};

type ProofEvent = {
  provider: string;
  event: string;
  detail: string;
  severity: string;
  at: number;
};

export function ApiHubTab() {
  const systems = useQuery(api.apiCoreStore.getSystems, {});
  const proof = useQuery(api.apiCoreStore.getProofLog, { limit: 12 });

  const saveA = useMutation(api.apiCoreStore.saveSystemA);
  const saveB = useMutation(api.apiCoreStore.saveSystemB);
  const deleteSystem = useMutation(api.apiCoreStore.deleteSystem);
  const verify = useAction(api.apiCore.verifySystem);

  const [keyA, setKeyA] = useState("");
  const [urlA, setUrlA] = useState("");
  const [keyB, setKeyB] = useState("");
  const [busyA, setBusyA] = useState(false);
  const [busyB, setBusyB] = useState(false);
  const [verifying, setVerifying] = useState<string | null>(null);

  const handleSaveA = async () => {
    if (!keyA.trim() || !urlA.trim()) return toast.error("أدخل المفتاح والرابط معاً");
    setBusyA(true);
    try {
      await saveA({ apiKey: keyA.trim(), baseUrl: urlA.trim() });
      toast.success("حُفظ النظام الأول (مفتاح + رابط)");
      setKeyA("");
      setUrlA("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الحفظ");
    } finally {
      setBusyA(false);
    }
  };

  const handleSaveB = async () => {
    if (!keyB.trim()) return toast.error("أدخل مفتاح API");
    setBusyB(true);
    try {
      await saveB({ apiKey: keyB.trim() });
      toast.success("حُفظ النظام الثاني (مفتاح فقط)");
      setKeyB("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الحفظ");
    } finally {
      setBusyB(false);
    }
  };

  const handleVerify = async (which: "systemA" | "systemB") => {
    setVerifying(which);
    try {
      const res = await verify({ which });
      if (res.ok) {
        toast.success(`تحقق ناجح (${res.latencyMs}ms) — دليل مُسجَّل في السجل`);
      } else {
        toast.error(`فشل التحقق (${res.status}): ${res.error?.slice(0, 120) ?? ""}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل التحقق");
    } finally {
      setVerifying(null);
    }
  };

  const handleDelete = async (which: "systemA" | "systemB") => {
    await deleteSystem({ which });
    toast(`حُذف النظام — لا يوجد أثر`);
  };

  return (
    <div className="space-y-6">
      {/* النظام الأول: مفتاح + رابط */}
      <Card className="border-primary/30 bg-primary/[0.03]">
        <CardHeader className="pb-2">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            <Globe className="size-4 text-primary" />
            النظام الأول — مفتاح API + رابط المزود (URL)
            {systems?.systemA ? (
              <Badge variant="outline" className="rounded-full text-[10px] text-emerald-600">مضبوط</Badge>
            ) : (
              <Badge variant="outline" className="rounded-full text-[10px] text-muted-foreground">غير مضبوط</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">مفتاح API</label>
              <Input
                value={keyA}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setKeyA(e.target.value)}
                placeholder="sk-... أو مفتاح المزود"
                className="rounded-xl font-mono text-xs"
                dir="ltr"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">رابط المزود (URL)</label>
              <Input
                value={urlA}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setUrlA(e.target.value)}
                placeholder="https://api.example.com/v1/chat/completions"
                className="rounded-xl font-mono text-xs"
                dir="ltr"
              />
            </div>
          </div>
          {systems?.systemA && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-muted/20 p-3 text-xs">
              <span className="font-mono">{systems.systemA.apiKey}</span>
              <span className="text-muted-foreground" dir="ltr">{systems.systemA.baseUrl}</span>
              <span className="ms-auto text-[10px] text-muted-foreground">
                حُدّث {new Date(systems.systemA.updatedAt).toLocaleString("ar-SA")}
              </span>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleSaveA} disabled={busyA} className="gap-1.5 rounded-xl">
              {busyA ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
              {systems?.systemA ? "تحديث النظام الأول" : "حفظ النظام الأول"}
            </Button>
            <Button
              variant="outline"
              onClick={() => handleVerify("systemA")}
              disabled={verifying === "systemA" || !systems?.systemA}
              className="gap-1.5 rounded-xl"
            >
              {verifying === "systemA" ? <Loader2 className="size-4 animate-spin" /> : <FlaskConical className="size-4" />}
              تحقق حقيقي
            </Button>
            {systems?.systemA && (
              <Button variant="ghost" size="sm" className="gap-1.5 text-rose-600" onClick={() => handleDelete("systemA")}>
                <Trash2 className="size-3.5" /> حذف
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            يُستخدم هذا النظام مع أي مزوّد يعطي رابطاً خاصاً. عند التحقق يُرسل طلب شبكة فعلي ويُسجَّل الدليل (زمن، حالة، الرد) في السجل.
          </p>
        </CardContent>
      </Card>

      <Separator />

      {/* النظام الثاني: مفتاح فقط */}
      <Card className="border-violet-500/30 bg-violet-500/[0.04]">
        <CardHeader className="pb-2">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            <KeyRound className="size-4 text-violet-600" />
            النظام الثاني — مفتاح API فقط (بدون رابط)
            {systems?.systemB ? (
              <Badge variant="outline" className="rounded-full text-[10px] text-emerald-600">مضبوط</Badge>
            ) : (
              <Badge variant="outline" className="rounded-full text-[10px] text-muted-foreground">غير مضبوط</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">مفتاح API</label>
            <Input
              value={keyB}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setKeyB(e.target.value)}
              placeholder="sk-or-v1-... (بوابة افتراضية موثوقة)"
              className="rounded-xl font-mono text-xs"
              dir="ltr"
            />
          </div>
          {systems?.systemB && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-muted/20 p-3 text-xs">
              <span className="font-mono">{systems.systemB.apiKey}</span>
              <span className="ms-auto text-[10px] text-muted-foreground">
                حُدّث {new Date(systems.systemB.updatedAt).toLocaleString("ar-SA")}
              </span>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleSaveB} disabled={busyB} className="gap-1.5 rounded-xl">
              {busyB ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
              {systems?.systemB ? "تحديث النظام الثاني" : "حفظ النظام الثاني"}
            </Button>
            <Button
              variant="outline"
              onClick={() => handleVerify("systemB")}
              disabled={verifying === "systemB" || !systems?.systemB}
              className="gap-1.5 rounded-xl"
            >
              {verifying === "systemB" ? <Loader2 className="size-4 animate-spin" /> : <FlaskConical className="size-4" />}
              تحقق حقيقي
            </Button>
            {systems?.systemB && (
              <Button variant="ghost" size="sm" className="gap-1.5 text-rose-600" onClick={() => handleDelete("systemB")}>
                <Trash2 className="size-3.5" /> حذف
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            يُستخدم في الأنظمة التي تدعم البوابة الافتراضية. عند التحقق يُرسل طلب شبكة فعلي ويُسجَّل الدليل في السجل.
          </p>
        </CardContent>
      </Card>

      {/* الإثبات الحقيقي — آخر عمليات التحقق */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ScrollText className="size-4 text-primary" />
            دليل التنفيذ الفعلي — آخر عمليات التحقق
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!proof ? (
            <div className="flex justify-center py-8"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
          ) : proof.calls.length === 0 && proof.events.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border/70 py-8 text-center text-sm text-muted-foreground">
              لا توجد عمليات تحقق بعد — اضغط «تحقق حقيقي» على أي نظام وسيظهر الدليل هنا (زمن، حالة، الرد).
            </p>
          ) : (
            <>
              {proof.events.slice(0, 6).map((e: ProofEvent, i: number) => (
                <div key={`ev-${i}`} className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/30 px-3 py-2 text-[11px]">
                  {e.event === "verify_ok" ? (
                    <CheckCircle2 className="size-3.5 text-emerald-600" />
                  ) : (
                    <XCircle className="size-3.5 text-rose-600" />
                  )}
                  <span className="font-bold">{e.provider}</span>
                  <span className="text-muted-foreground">{e.detail}</span>
                  <span className="ms-auto text-[9px] text-muted-foreground">
                    {new Date(e.at).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
              {proof.calls.slice(0, 6).map((c: ProofCall, i: number) => (
                <div key={`call-${i}`} className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/20 px-3 py-1.5 text-[10px] text-muted-foreground">
                  <Plug className="size-3" />
                  <span className="font-semibold">{c.provider}</span>
                  <span>{c.ok ? "نجاح" : "فشل"}</span>
                  <span>{c.latencyMs}ms</span>
                  <span className="ms-auto">{new Date(c.createdAt).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              ))}
            </>
          )}
        </CardContent>
      </Card>

      {/* حماية وضمانات النظام */}
      <Card className="border-emerald-500/30 bg-emerald-500/[0.04]">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-4 text-emerald-600" />
            ضمانات النظام
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-xs text-muted-foreground">
          <p>• لا توجد مفاتيح مشفّرة داخل الكود — النظامان فقط هما المصدر.</p>
          <p>• كل استدعاء AI في اللعبة يمر عبر محرك واحد يقرأ النظامين بالترتيب (الأول ثم الثاني).</p>
          <p>• عند فشل أي طلب يظهر خطأ واضح وصريح — لا نتائج وهمية أبداً.</p>
          <p>• كل عملية تحقق تُسجَّل دليلاً قابلاً للتحقق في السجل (زمن + حالة + الرد).</p>
        </CardContent>
      </Card>

      {/* شرح الترتيب الحقيقي */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="size-4 text-muted-foreground" />
            كيف يعمل الربط الحقيقي
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-muted-foreground">
          <p>1. عند الحفظ: يُخزَّن النظام في قاعدة البيانات ويُحقن فوراً في محرك الاستدعاء.</p>
          <p>2. عند أي استدعاء AI في اللعبة: يُستخدم النظام الأول إن وُجد، وإلا النظام الثاني.</p>
          <p>3. عند الفشل: إعادة محاولة تلقائية + انتقال للنموذج البديل، ثم خطأ واضح إن تعذّر.</p>
          <p>4. عند التحقق: طلب شبكة فعلي يُقاس زمنه ويُسجَّل دليلاً في السجل — قابل للتحقق دائماً.</p>
        </CardContent>
      </Card>

      {/* مساحة إضافية — حماية من النظام القديم */}
      <Card className={cn("border-dashed")}>
        <CardContent className="py-4 text-center text-[11px] text-muted-foreground">
          النظام القديم (مفتاح مشفّر + سجل API متعدد) أُزيل نهائياً — هذه هي البنية الجديدة الكاملة.
        </CardContent>
      </Card>
    </div>
  );
}