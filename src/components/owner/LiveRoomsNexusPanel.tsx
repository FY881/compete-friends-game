import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Activity, Loader2, Radio, Target } from "lucide-react";

const DIFF_LABEL: Record<string, string> = { easy: "سهل", medium: "متوسط", hard: "صعب" };

const ar = (ts: number) => new Date(ts).toLocaleString("ar", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "numeric" });

/**
 * 🎯 الغرف الحيّة — سيطرة المالك على نظام الضبط التكيّفي.
 *
 * تكشف ما لا تراه أي لوحة أخرى:
 *   • غرفة دقّتها قريبة من الصفر ⇒ أسئلتها أصعب من لاعبّيها (مشكلة محتوى).
 *   • غرفة تُضبط باستمرار ⇒ فئتها غير متجانسة (مشكلة تصنيف).
 * وكل رقم هنا مقروء من الإجابات المسجّلة فعلاً في الغرفة، لا تقدير.
 */
export function LiveRoomsNexusPanel() {
  const data = useQuery(api.gameLive.ownerLiveRooms, { limit: 15 });

  if (data === undefined) {
    return (
      <Card className="border-border/70">
        <CardContent className="flex items-center gap-2 p-5 text-xs text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> نقرأ الغرف الحيّة…
        </CardContent>
      </Card>
    );
  }
  if (data === null) {
    return (
      <Card className="border-border/70">
        <CardContent className="p-5 text-xs text-muted-foreground">هذه اللوحة للمالك فقط.</CardContent>
      </Card>
    );
  }

  const stats: { label: string; value: number }[] = [
    { label: "غرف جارية الآن", value: data.totals.liveRooms },
    { label: "لاعبون داخل الغرف", value: data.totals.playersLive },
    { label: "إجابات مسجّلة", value: data.totals.answeredLive },
    { label: "غرف عُدّلت صعوبتها", value: data.totals.roomsAdapted },
  ];

  return (
    <div className="space-y-4">
      <Card className="border-primary/25 bg-primary/[0.03]">
        <CardHeader className="pb-2">
          <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
            <Radio className="size-4 text-primary" /> الغرف الحيّة والضبط التكيّفي
            <Badge variant="outline" className="rounded-full text-[10px]">
              أرقام من الإجابات المسجّلة
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl border border-border/70 bg-muted/30 px-3 py-2">
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
                <p className="text-lg font-black tabular-nums">{s.value}</p>
              </div>
            ))}
          </div>

          {data.live.length === 0 ? (
            <p className="py-3 text-center text-xs text-muted-foreground">لا غرفة جارية الآن.</p>
          ) : (
            <div className="space-y-1.5">
              {data.live.map((r) => (
                <div key={r.code} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border/60 bg-card p-2.5 text-[11px]">
                  <Badge variant="outline" className="rounded-full font-mono text-[9px]">
                    {r.code}
                  </Badge>
                  <span className="text-muted-foreground tabular-nums">
                    سؤال {r.questionIndex + 1}/{r.totalQuestions}
                  </span>
                  <span className="text-muted-foreground tabular-nums">{r.players} لاعباً</span>
                  <span
                    className={cn(
                      "flex items-center gap-1 font-bold tabular-nums",
                      r.roomAccuracy >= 70 ? "text-emerald-600" : r.roomAccuracy >= 40 ? "text-sky-600" : "text-rose-600",
                    )}
                  >
                    <Activity className="size-3" /> {r.roomAccuracy}٪ من {r.answered}
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Target className="size-3" />
                    {DIFF_LABEL[r.difficulty] ?? r.difficulty} · صعب {Math.round(r.hardRatio * 100)}٪
                  </span>
                  {r.adaptations > 0 && (
                    <Badge variant="outline" className="rounded-full text-[9px] text-emerald-600">
                      ضُبطت {r.adaptations}×
                    </Badge>
                  )}
                  {!r.canRetune && <span className="text-[10px] text-muted-foreground">· لا متبقّي كافٍ للتعديل</span>}
                  <span className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground">{r.reason}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">سجل الضبط التكيّفي (آخر ٣٠ قراراً)</CardTitle>
        </CardHeader>
        <CardContent className="max-h-72 space-y-1.5 overflow-y-auto">
          {data.adaptations.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              لا تعديل بعد — وهذا طبيعي: النظام لا يعدّل إلا إن استحق التغيير فعلاً.
            </p>
          ) : (
            data.adaptations.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-card p-2.5 text-[11px]">
                <Badge variant="outline" className="rounded-full font-mono text-[9px]">
                  {a.code}
                </Badge>
                <span className="font-bold">{a.actorName}</span>
                <span className="text-muted-foreground">
                  عند السؤال {a.atQuestionIndex + 1}: {DIFF_LABEL[a.fromDifficulty] ?? a.fromDifficulty} ←{" "}
                  <b className="text-foreground">{DIFF_LABEL[a.toDifficulty] ?? a.toDifficulty}</b>
                </span>
                <span className="text-muted-foreground tabular-nums">
                  · دقّة {a.roomAccuracy}٪ من {a.sample} · استُبدل {a.swappedCount}
                </span>
                <span className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground">{a.reason}</span>
                <span className="text-[9px] text-muted-foreground">{ar(a.createdAt)}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
