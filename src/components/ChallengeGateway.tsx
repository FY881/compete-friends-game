import { useState } from "react";
import { Link } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ChallengeInfo, ChallengeSubmitOutcome } from "@/lib/challengeSync";
import { Clock, Loader2, Medal, Swords, Trophy, Users, X } from "lucide-react";

/**
 * ⚔️ بوابة التحدّي — تُعرض في الساحة عند الوصول بكود تحدٍّ
 * (`/arena?challenge=CODE`) من غرفة خاصة أو من ملتقى العقول.
 *
 * كل رقم هنا حقيقي: من الخادم (عدد الأسئلة · المكافأة المُعلنة · عدد اللاعبين)
 * ومن جهازك (محاولاتك ونتيجتك). بعد الجولة يظهر ما دفعه الخادم فعلاً.
 */
export function ChallengeGateway({
  challenge,
  loading,
  busy,
  outcome,
  onStart,
}: {
  challenge: ChallengeInfo | null;
  loading: boolean;
  busy: boolean;
  outcome: ChallengeSubmitOutcome | null;
  onStart: (challenge: ChallengeInfo) => void;
}) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  if (loading) {
    return (
      <Card className="border-border/70">
        <CardContent className="flex items-center gap-2 p-4 text-xs text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> نقرأ التحدّي من الخادم…
        </CardContent>
      </Card>
    );
  }

  if (!challenge) {
    return (
      <Card className="border-rose-500/40 bg-rose-500/5">
        <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
          <p className="text-xs font-bold text-rose-700 dark:text-rose-400">
            🚫 لا يوجد تحدٍّ بهذا الكود — ربما انتهى أو حُذف.
          </p>
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline" className="rounded-lg">
              <Link to="/forum">ملتقى العقول</Link>
            </Button>
            <Button size="sm" variant="ghost" className="rounded-lg" onClick={() => setHidden(true)}>
              <X className="size-3.5" /> إخفاء
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const closed = !challenge.playable;
  const myState = challenge.mine;

  return (
    <Card
      className={cn(
        "overflow-hidden border-2 shadow-sm",
        closed ? "border-border/60" : "border-primary/40 bg-gradient-to-bl from-primary/[0.07] to-transparent",
      )}
    >
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
              <Swords className="size-3.5 text-primary" />
              تحدٍّ {challenge.source === "room" ? "داخل غرفة خاصة" : "من ملتقى العقول"} · {challenge.code}
            </p>
            <h3 className="mt-1 truncate text-base font-black">{challenge.title}</h3>
            <p className="text-[11px] text-muted-foreground">
              أطلقه {challenge.createdByName} · {challenge.difficultyEmoji} {challenge.difficultyLabel} ·{" "}
              {challenge.questionCount} أسئلة
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge
              variant="outline"
              className={cn(
                "rounded-full text-[10px]",
                closed ? "border-border/70" : "border-emerald-500/40 text-emerald-700 dark:text-emerald-400",
              )}
            >
              {closed ? challenge.remaining : challenge.remaining}
            </Badge>
            <Button size="sm" variant="ghost" className="rounded-lg p-1.5" onClick={() => setHidden(true)}>
              <X className="size-3.5" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
          <div className="rounded-xl border border-border/70 bg-card px-2 py-1.5">
            <p className="text-[10px] text-muted-foreground">المكافأة المُعلنة</p>
            <p className="text-sm font-black tabular-nums text-primary">{challenge.rewardXp} خبرة</p>
            {challenge.rewardCoins > 0 && (
              <p className="text-[10px] tabular-nums text-amber-600 dark:text-amber-400">+{challenge.rewardCoins} عملة</p>
            )}
          </div>
          <div className="rounded-xl border border-border/70 bg-card px-2 py-1.5">
            <p className="text-[10px] text-muted-foreground">اللاعبون</p>
            <p className="flex items-center justify-center gap-1 text-sm font-black tabular-nums">
              <Users className="size-3.5 text-muted-foreground" /> {challenge.participants}
            </p>
          </div>
          <div className="rounded-xl border border-border/70 bg-card px-2 py-1.5">
            <p className="text-[10px] text-muted-foreground">نالوا مكافأتهم</p>
            <p className="text-sm font-black tabular-nums">{challenge.rewardedCount}</p>
          </div>
          <div className="rounded-xl border border-border/70 bg-card px-2 py-1.5">
            <p className="text-[10px] text-muted-foreground">ترتيبك</p>
            <p className="text-sm font-black tabular-nums">{challenge.myRank > 0 ? `#${challenge.myRank}` : "—"}</p>
          </div>
        </div>

        {challenge.note && <p className="text-[11px] text-muted-foreground">{challenge.note}</p>}

        {myState && (
          <p className="text-[11px] font-bold text-foreground/80">
            {myState.rewarded ? "✅ " : "⏳ "}
            {myState.label} · محاولاتك {myState.attempts}
          </p>
        )}

        {challenge.board.length > 0 && (
          <div className="space-y-1 rounded-xl border border-border/70 bg-muted/20 p-2">
            <p className="flex items-center gap-1 text-[11px] font-bold">
              <Medal className="size-3.5 text-amber-500" /> صدارة التحدّي
            </p>
            {challenge.board.slice(0, 3).map((row, i) => (
              <div key={row.userId} className="flex items-center justify-between text-[11px]">
                <span className="truncate">
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"} {row.userName}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {row.score} نقطة · {row.correct}/{row.total}
                </span>
              </div>
            ))}
          </div>
        )}

        {outcome && (
          <div
            className={cn(
              "space-y-1 rounded-xl border p-2.5",
              outcome.status === "paid"
                ? "border-emerald-500/40 bg-emerald-500/10"
                : outcome.status === "queued" || outcome.status === "unauthenticated"
                  ? "border-amber-500/40 bg-amber-500/10"
                  : "border-border/70 bg-muted/20",
            )}
          >
            <p className="flex items-center gap-1.5 text-xs font-bold">
              {outcome.status === "paid" ? (
                <>
                  <Trophy className="size-3.5 text-emerald-600" /> مكافأة التحدّي وصلت
                </>
              ) : outcome.status === "already" ? (
                <>♻️ نلت مكافأة هذا التحدّي سابقاً</>
              ) : (
                <>⏳ {outcome.status === "queued" ? "بانتظار الاتصال" : outcome.status === "unauthenticated" ? "يلزم تسجيل الدخول" : "لا مكافأة"}</>
              )}
            </p>
            <p className="text-[11px] text-muted-foreground">{outcome.message}</p>
            {outcome.status === "paid" && (
              <p className="text-[11px] font-bold tabular-nums">
                +{outcome.result?.xpAwarded ?? 0} خبرة
                {outcome.coinsGranted > 0 ? ` · +${outcome.coinsGranted} عملة في محفظتك` : ""}
                {outcome.result?.coinsTo === "treasury" && (outcome.result?.coinsAwarded ?? 0) > 0
                  ? ` · +${outcome.result?.coinsAwarded} لعملة عشيرتك`
                  : ""}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            className="rounded-xl"
            disabled={closed || busy}
            onClick={() => onStart(challenge)}
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Swords className="size-3.5" />}
            {closed ? "التحدّي مغلق" : "ابدأ التحدّي الآن"}
          </Button>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock className="size-3" /> {challenge.seconds} ثانية للسؤال · مكافأة واحدة لكل لاعب
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
