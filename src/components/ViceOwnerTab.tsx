/**
 * 👤 نائب المالك — واجهة المراقبة
 * يعمل على مفتاح OpenRouter الرسمي الوحيد (sk-or-v1...) — لا يحتاج أي مفتاح إضافي.
 * المالك يراقب فقط — لا توجد أي قناة أوامر إليه.
 */
import { useState, useEffect } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Loader2,
  UserCheck,
  Play,
  Pause,
  RefreshCw,
  Zap,
  ShieldAlert,
  History,
  KeyRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ViceOwnerFace } from "./ViceOwnerFace";
import { BrainCircuit } from "lucide-react";

const FOCUS_LABEL: Record<string, string> = {
  ai_ops: "إدارة AI و API",
  audit: "تدقيق شامل",
  optimization: "تحسين أداء",
  exploration: "استكشاف حر",
};

export function ViceOwnerTab() {
  const sessions = useQuery(api.viceOwnerStore.listSessions, { limit: 15 });
  const stats = useQuery(api.viceOwnerStore.getStats, {});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const session = useQuery(
    api.viceOwnerStore.getSessionForUi,
    selectedId ? { sessionId: selectedId as never } : "skip",
  );

  const startShift = useAction(api.viceOwner.startShift);
  const pauseShift = useAction(api.viceOwner.pauseShift);
  const resumeShift = useAction(api.viceOwner.resumeShift);

  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!selectedId && sessions && sessions.length > 0) setSelectedId(sessions[0]._id);
  }, [sessions, selectedId]);

  const active = sessions?.find((s) => s.status === "active");

  const handleStart = async () => {
    setStarting(true);
    try {
      const res = await startShift({});
      setSelectedId(res.sessionId);
      toast.success("النائب بدأ ورديته الجديدة — يعمل الآن بحريته الكاملة");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر بدء الوردية");
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* بطاقة النائب */}
      <Card className="border-amber-500/30 bg-amber-500/[0.04]">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="flex size-12 shrink-0 items-center justify-center">
            <ViceOwnerFace active={!!active} turnCount={session?.turnCount ?? 0} critical={stats?.critical ?? 0} size={110} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">
              نائب المالك — سيطرة مطلقة، معرفة تتجاوز العبقرية
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              يرى كل شيء، يقرر كل شيء، ويبتكر أنظمة جديدة من تلقاء نفسه — بلا أي تدخل بشري.
              حرّ دائم، سريع للغاية، ويعمل على المفتاح الرسمي الوحيد عبر البوابة الموحّدة.
            </p>
          </div>
          {stats && (
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="rounded-full text-[10px]">{stats.active} ورديات نشطة</Badge>
              <Badge variant="outline" className="rounded-full text-[10px]">{stats.activity} فعل موثّق</Badge>
              {stats.critical > 0 && (
                <Badge variant="outline" className="rounded-full text-[10px] text-rose-600">{stats.critical} حرج</Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* حالة المفتاح */}
      <div className="flex items-start gap-2 rounded-xl bg-sky-500/[0.06] px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        <KeyRound className="mt-0.5 size-4 shrink-0 text-sky-600" />
        <span>
          النائب يعمل على <strong className="text-foreground">مفتاح OpenRouter الرسمي الوحيد</strong> المضمّن في اللعبة
          — <strong className="text-foreground">لا Gemini ولا أي مزود آخر</strong>، وكل أنظمة AI تمر عبره.
          اضغط «ابدأ ورديته» وسيبدأ فوراً.
        </span>
      </div>

      {/* التحكم — تشغيل/مراقبة فقط */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <p className="min-w-0 flex-1 text-xs text-muted-foreground">
            لا توجد أوامر ولا رسائل ولا تدخلات — النائب حر. عندك تشغيل وإيقاف مؤقت فقط.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleStart} disabled={starting || !!active} className="gap-1.5 rounded-xl">
              {starting ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
              ابدأ ورديته
            </Button>
            {active && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 rounded-xl"
                onClick={async () => {
                  await pauseShift({ sessionId: active._id as never });
                  toast("أوقفتَ الوردية مؤقتاً — سيفتح وردية جديدة لاحقاً بنفسه");
                }}
              >
                <Pause className="size-3.5" /> إيقاف مؤقت
              </Button>
            )}
            {session?.status === "paused" && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 rounded-xl"
                onClick={async () => {
                  await resumeShift({ sessionId: session._id as never });
                  toast("استؤنفت الوردية");
                }}
              >
                <RefreshCw className="size-3.5" /> استئناف
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* الوردية الحالية */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            <Zap className="size-4 text-amber-600" />
            {session ? `المهمة: ${session.mission}` : "وردية النائب"}
            {session?.status === "active" && (
              <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                يعمل الآن — دورة {session.turnCount}/{session.maxTurns}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!session ? (
            <div className="flex justify-center py-10">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : session.activity.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border/70 py-10 text-center text-sm text-muted-foreground">
              الوردية فارغة… ابدأها وسيرفع النائب أول سجل أعمال خلال ثوانٍ.
            </p>
          ) : (
            [...session.activity].reverse().map((a, i) => (
              <div key={i} className="rounded-xl border border-border/60 bg-muted/20 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="rounded-full text-[10px]">{a.type}</Badge>
                  <span className="text-xs font-bold">{a.title}</span>
                  {a.severity !== "info" && (
                    <span
                      className={cn(
                        "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold",
                        a.severity === "critical" ? "bg-rose-500/10 text-rose-600" : "bg-amber-500/10 text-amber-600",
                      )}
                    >
                      <ShieldAlert className="size-3" />
                      {a.severity === "critical" ? "حرج" : "تحذير"}
                    </span>
                  )}
                  <span className="ms-auto text-[10px] text-muted-foreground">
                    {new Date(a.at).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                {a.detail && (
                  <p className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">{a.detail}</p>
                )}
              </div>
            ))
          )}
          {session?.lastError && (
            <p className="rounded-xl bg-rose-500/10 px-4 py-2.5 text-xs text-rose-600">{session.lastError}</p>
          )}
        </CardContent>
      </Card>

      {/* سجل الورديات */}
      {sessions && sessions.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="size-4 text-muted-foreground" />
              ورديات النائب السابقة ({stats?.total ?? 0})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {sessions.map((s) => (
              <button
                key={s._id}
                type="button"
                onClick={() => setSelectedId(s._id)}
                className={cn(
                  "flex w-full flex-wrap items-center gap-2 rounded-xl border p-3 text-start transition-colors hover:bg-muted/40",
                  s._id === selectedId ? "border-primary/50 bg-primary/5" : "border-border/60",
                )}
              >
                <Badge variant="outline" className="rounded-full text-[10px]">{FOCUS_LABEL[s.focus] ?? s.focus}</Badge>
                <span className="min-w-0 flex-1 truncate text-xs font-semibold">{s.mission}</span>
                <Badge variant="outline" className="rounded-full text-[10px]">{s.activity.length} فعل</Badge>
                <Badge
                  variant="outline"
                  className={cn(
                    "rounded-full text-[10px]",
                    s.status === "active" ? "text-emerald-600" : s.status === "paused" ? "text-amber-600" : "text-muted-foreground",
                  )}
                >
                  {s.status === "active" ? "نشطة" : s.status === "paused" ? "موقوفة" : "منتهية"}
                </Badge>
              </button>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
