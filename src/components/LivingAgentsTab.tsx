import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Sprout,
  Radio,
  Users,
  Trophy,
  MessageSquare,
  Swords,
  Zap,
  Loader2,
  Activity,
  Crown,
} from "lucide-react";

/**
 * 🌱 مراقبة الوكلاء الأحياء — قراءة فقط.
 * الحياة تعمل ذاتياً بلا تدخّل؛ هذه اللوحة تُظهر ما يفعلونه الآن.
 */

type FeedKind = "chat" | "match" | "birth" | "action";

const KIND_META: Record<FeedKind, { label: string; tint: string; icon: typeof Radio }> = {
  chat: { label: "كلام", tint: "text-sky-500 bg-sky-500/10 border-sky-500/25", icon: MessageSquare },
  match: { label: "مباراة", tint: "text-amber-600 bg-amber-500/10 border-amber-500/25", icon: Swords },
  birth: { label: "ميلاد", tint: "text-emerald-600 bg-emerald-500/10 border-emerald-500/25", icon: Sprout },
  action: { label: "قرار", tint: "text-rose-600 bg-rose-500/10 border-rose-500/25", icon: Activity },
};

function ago(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "الآن";
  if (min < 60) return `قبل ${min} دقيقة`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `قبل ${hours} ساعة`;
  return `قبل ${Math.floor(hours / 24)} يوم`;
}

export function LivingAgentsTab() {
  const data = useQuery(api.aiAgents.getLivingAgents, {});
  const awaken = useMutation(api.aiAgents.awaken);
  const [tab, setTab] = useState<"feed" | "agents" | "matches">("feed");
  const [waking, setWaking] = useState(false);

  const stats = useMemo(() => {
    if (!data) return null;
    return [
      { label: "وكيل حيّ", value: String(data.stats.activeAgents), icon: Users, tint: "text-sky-500" },
      { label: "رسالة مُرسلة", value: String(data.stats.totalChats), icon: MessageSquare, tint: "text-violet-500" },
      { label: "مباراة مكتملة", value: String(data.stats.totalGames), icon: Swords, tint: "text-amber-500" },
      { label: "متوسط المستوى", value: String(data.stats.avgLevel), icon: Trophy, tint: "text-emerald-500" },
    ];
  }, [data]);

  if (data === undefined) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        <Loader2 className="me-2 size-4 animate-spin" /> جارٍ قراءة النبض…
      </div>
    );
  }

  // غير المالك لا يرى شيئاً إطلاقاً — الوكلاء يظهرون للاعبين كلاعبين طبيعيين
  if (data === null) return null;

  const wake = async () => {
    setWaking(true);
    try {
      await awaken({});
      toast.success("استُدعي الوكلاء — انظر النبض بعد لحظات");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر الإيقاظ");
    } finally {
      setWaking(false);
    }
  };

  return (
    <div dir="rtl" className="space-y-4">
      {/* الرأس */}
      <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-emerald-500/10 via-card to-sky-500/10 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600">
            <Sprout className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-black">الوكلاء الأحياء</h2>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              خمسون وكيلاً لكل منهم هويّة لاعب حقيقية: يتكلمون في غرف الدردشة، يلعبون مباريات كاملة
              تُسجَّل في سجل التاريخ، يتقدّمون في المستويات، ويُكملون كتيّبهم بمولودين جدد — ذاتياً،
              وبمحرك مدمج لا يحتاج أي API خارجي.
            </p>
          </div>
          {data.stats.activeAgents === 0 && (
            <Button onClick={() => void wake()} disabled={waking} className="gap-2">
              {waking ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
              أيقظ الوكلاء
            </Button>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
          {stats?.map((s) => (
            <div key={s.label} className="rounded-xl border border-border/60 bg-card/60 px-3 py-2">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground">
                <s.icon className={cn("size-3", s.tint)} />
                {s.label}
              </div>
              <p className="mt-0.5 text-lg font-black tabular-nums">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* التبويبات */}
      <div className="flex gap-2">
        {(
          [
            { id: "feed", label: "النبض الحي", icon: Radio },
            { id: "agents", label: "الوكلاء", icon: Users },
            { id: "matches", label: "المباريات", icon: Swords },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-all",
              tab === t.id
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
                : "border-border/60 text-muted-foreground hover:bg-muted/50",
            )}
          >
            <t.icon className="size-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* النبض الحي */}
      {tab === "feed" && (
        <div className="space-y-2">
          {data.feed.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              لا نبض بعد — اضغط «أيقظ الوكلاء» أو انتظر الدورة القادمة.
            </p>
          )}
          {data.feed.map((item) => {
            const meta = KIND_META[item.kind as FeedKind];
            const Icon = meta.icon;
            return (
              <div
                key={item._id}
                className="flex items-start gap-3 rounded-xl border border-border/60 bg-card px-3 py-2.5"
              >
                <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full border text-sm", meta.tint)}>
                  {item.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold">{item.agentName}</span>
                    <Badge variant="outline" className="gap-1 px-1.5 py-0 text-[9px]">
                      <Icon className="size-2.5" />
                      {meta.label}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">{item.place}</span>
                    <span className="text-[10px] text-muted-foreground">· {ago(item.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed">{item.text}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* شبكة الوكلاء */}
      {tab === "agents" && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {data.agents.map((a) => (
            <div key={a._id} className="rounded-xl border border-border/60 bg-card p-3">
              <div className="flex items-center gap-2">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-lg">
                  {a.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold">{a.name}</p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {a.persona} · {a.dept}
                  </p>
                </div>
                <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-600">
                  <Crown className="size-2.5" />
                  {a.level}
                </span>
              </div>

              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>الطاقة</span>
                  <span className="tabular-nums">{a.energy}%</span>
                </div>
                <Progress value={a.energy} className="h-1" />
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
                <span className="rounded-full bg-muted px-2 py-0.5">مزاج: {a.mood}</span>
                <span className="rounded-full bg-muted px-2 py-0.5">
                  {a.wins}/{a.gamesPlayed} فوز
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5">{a.chatCount} رسالة</span>
                <span className="rounded-full bg-muted px-2 py-0.5">{a.xp} خبرة</span>
              </div>
              <p className="mt-1.5 truncate text-[10px] text-muted-foreground">{a.role}</p>
            </div>
          ))}
        </div>
      )}

      {/* المباريات */}
      {tab === "matches" && (
        <div className="space-y-2">
          {data.recentMatches.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              لا مباريات مسجّلة بعد — أول دورة ستُشغّل مباراة بين أربعة وكلاء.
            </p>
          )}
          {data.recentMatches.map((m, i) => (
            <div
              key={`${m.gameCode}-${i}`}
              className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-3 py-2.5"
            >
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                  m.won ? "bg-amber-500/20 text-amber-600" : "bg-muted text-muted-foreground",
                )}
              >
                {m.rank}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold">
                  {m.won ? "🏆 " : ""}
                  {m.userName}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  غرفة {m.gameCode} · {m.playerCount} لاعبين · {ago(m.playedAt)}
                </p>
              </div>
              <span className="shrink-0 font-mono text-sm font-bold tabular-nums">{m.score}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
