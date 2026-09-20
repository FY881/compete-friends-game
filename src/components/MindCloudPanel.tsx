import { Link } from "react-router";
import { toast } from "sonner";
import { useMindSync } from "@/lib/mindSync";
import { MAX_TIER_SCORE, nextRank } from "@/convex/mindCore";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Brain, CloudUpload, Gavel, Loader2, Medal, Snowflake, Trophy } from "lucide-react";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * ☁️ لوحة العقول — عقلك بين عقول اللعبة
 * ═══════════════════════════════════════════════════════════════════════
 * اللعب يبني العقل محلياً، وهذه اللوحة تنقله إلى عالم اللعبة:
 * ترتيبك الحقيقي، رتبتك في سلّم العقول، منافسوك، وقرارات العرش.
 */

const MEDALS = ["🥇", "🥈", "🥉"];

export function MindCloudPanel() {
  const { cloud, leaderboard, push, rank, rankProgress } = useMindSync("cloud");

  const syncing = cloud === undefined;
  const profile = cloud?.profile ?? null;
  const next = profile ? nextRank(profile.tierScore) : null;

  const onSync = async () => {
    const res = await push(true);
    if (res.status === "failed") toast.error(res.message);
    else if (res.status === "frozen") toast.warning(res.message);
    else if (res.status === "unauthenticated") toast.info(res.message);
    else if (res.grantsApplied > 0 || res.resetApplied) toast.success(res.message);
    else toast.success(res.message);
  };

  return (
    <Card className="overflow-hidden border-border/70">
      <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-border/60 bg-muted/30 py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-bold">
          <Brain className="size-4 text-primary" />
          لوحة العقول
          <span className="text-[10px] font-normal text-muted-foreground">
            ترتيبك بين عقول اللاعبين
          </span>
        </CardTitle>
        <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={onSync}>
          <CloudUpload className="size-3.5" />
          زامن الآن
        </Button>
      </CardHeader>

      <CardContent className="space-y-4 pt-4">
        {syncing ? (
          <div className="flex justify-center py-6">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : cloud === null ? (
          <div className="rounded-2xl border border-dashed border-border/70 p-5 text-center">
            <p className="text-sm font-bold">عقلك يعمل محلياً فقط</p>
            <p className="mt-1 text-xs text-muted-foreground">
              سجّل الدخول ليدخل عقلك لوحة الصدارة، وليصلك قرار العرش ومنحه فوراً.
            </p>
            <Button asChild size="sm" className="mt-3">
              <Link to="/auth?returnTo=%2Foffline">تسجيل الدخول</Link>
            </Button>
          </div>
        ) : (
          <>
            {profile?.frozen && (
              <div className="flex items-start gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-rose-700 dark:text-rose-300">
                <Snowflake className="mt-0.5 size-4 shrink-0" />
                <div>
                  <p className="text-xs font-bold">عقلك مُجمَّد بقرار من الإدارة</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed">
                    لا يُقبل أي تقدّم جديد في لوحة العقول حتى يُرفع التجميد. لعبك المحلي مستمر كما هو.
                  </p>
                </div>
              </div>
            )}

            {profile?.note && !profile.frozen && (
              <div className="flex items-start gap-2 rounded-2xl border border-primary/30 bg-primary/5 p-3">
                <Gavel className="mt-0.5 size-4 shrink-0 text-primary" />
                <div>
                  <p className="text-xs font-bold text-primary">رسالة من العرش</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{profile.note}</p>
                </div>
              </div>
            )}

            {/* رتبتي في سلّم العقول */}
            <div className="rounded-2xl border border-border/70 bg-gradient-to-b from-muted/40 to-transparent p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-background text-xl shadow-sm">
                    {rank?.icon ?? "🌱"}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{rank?.name ?? "عقل ناشئ"}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {profile?.identityTitle ?? "ابدأ جولاتك ليكتسب عقلك ملامحه"}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-left">
                  <p className="text-lg font-black tabular-nums leading-none">
                    {profile?.tierScore ?? 0}
                    <span className="text-xs font-normal text-muted-foreground">/{MAX_TIER_SCORE}</span>
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">مجموع القوى</p>
                </div>
              </div>

              <Progress value={Math.round(rankProgress * 100)} className="mt-3 h-1.5" />

              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] text-muted-foreground">
                  {next
                    ? `تبقّى ${next.remaining} مستوى لتصل «${next.rank.name}» ${next.rank.icon}`
                    : "بلغت قمة سلّم العقول 🌟"}
                </p>
                {cloud?.position && (
                  <Badge variant="secondary" className="text-[10px] font-bold">
                    {cloud.description}
                  </Badge>
                )}
              </div>
            </div>

            {/* لوحة الصدارة */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-xs font-bold">
                  <Trophy className="size-3.5 text-amber-500" />
                  أقوى العقول
                </p>
                {leaderboard && leaderboard.total > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    {leaderboard.total} عقل مسجَّل
                  </span>
                )}
              </div>

              {leaderboard === undefined ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                </div>
              ) : leaderboard === null || leaderboard.rows.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-border/70 p-4 text-center text-xs text-muted-foreground">
                  لا عقول مسجَّلة بعد — كن أول من يحفر اسمه هنا 🥇
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {leaderboard.rows.map((row) => (
                    <li
                      key={row.userId}
                      className={cn(
                        "flex items-center gap-2.5 rounded-xl border px-2.5 py-2",
                        row.isMe
                          ? "border-primary/40 bg-primary/5"
                          : "border-border/60 bg-card/60",
                      )}
                    >
                      <span className="w-6 shrink-0 text-center text-xs font-black tabular-nums">
                        {MEDALS[row.rank - 1] ?? row.rank}
                      </span>
                      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-muted text-sm">
                        {row.avatar ?? row.rankIcon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold">
                          {row.name}
                          {row.isMe && <span className="ms-1 text-[10px] text-primary">(أنت)</span>}
                        </p>
                        <p className="truncate text-[10px] text-muted-foreground">
                          {row.rankIcon} {row.rankName} · {row.identityTitle}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs font-black tabular-nums">{row.tierScore}</span>
                      {row.rank <= 3 && <Medal className="size-3.5 shrink-0 text-amber-500" />}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
