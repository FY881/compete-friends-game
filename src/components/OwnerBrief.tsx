import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
import {
  Swords,
  HeartPulse,
  Target,
  Coins,
  Users,
  Sparkles,
} from "lucide-react";

/**
 * 📊 بريف المالك — أهم 5 أرقام يومية مع تفسير ذكي + رسوم اتجاهات 14 يوماً،
 * كلها مولّدة من بيانات اللعب الحقيقية (gameHistory + loyaltyLedger).
 */

const BRIEF_ICON: Record<string, React.ElementType> = {
  swords: Swords,
  heart: HeartPulse,
  target: Target,
  coins: Coins,
  users: Users,
};

const TONE_CLS: Record<string, string> = {
  good: "border-emerald-500/40 bg-emerald-500/5",
  warn: "border-amber-500/40 bg-amber-500/5",
  bad: "border-rose-500/40 bg-rose-500/5",
  info: "border-border/70 bg-card",
};

export function OwnerBrief() {
  const brief = useQuery(api.commandDeck.getOwnerBrief, {});

  if (brief === undefined || brief === null) return null;

  const chartData = brief.series.labels.map((label, i) => ({
    label,
    rounds: brief.series.rounds[i],
    active: brief.series.active[i],
    accuracy: brief.series.accuracy[i],
    netPoints: brief.series.netPoints[i],
  }));

  return (
    <div dir="rtl" className="space-y-4">
      {/* ═══ بريف المالك — الأرقام الخمسة ═══ */}
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-amber-500" />
        <h3 className="text-sm font-bold">بريف المالك اليومي</h3>
        <span className="text-[10px] text-muted-foreground">مولّد من بيانات حقيقية — آخر 14 يوماً</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {brief.brief.map((b) => {
          const Icon = BRIEF_ICON[b.icon] ?? Sparkles;
          return (
            <div key={b.title} className={cn("rounded-2xl border p-3.5 transition-shadow hover:shadow-md", TONE_CLS[b.tone])}>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Icon className="size-3.5" />
                <span className="text-[11px]">{b.title}</span>
              </div>
              <p className="mt-1 text-2xl font-bold tabular-nums">{b.value}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{b.insight}</p>
            </div>
          );
        })}
      </div>

      {/* ═══ رسوم الاتجاهات ═══ */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-1">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Swords className="size-4 text-primary" /> الجولات واللاعبون النشطون (14 يوم)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="gRounds" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gActive" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={1} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                <Area type="monotone" dataKey="rounds" name="جولات" stroke="var(--primary)" fill="url(#gRounds)" strokeWidth={2} />
                <Area type="monotone" dataKey="active" name="لاعبون نشطون" stroke="#f59e0b" fill="url(#gActive)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-1">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Coins className="size-4 text-amber-500" /> صافي النقاط اليومي (14 يوم)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={1} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                <Bar dataKey="netPoints" name="صافي النقاط" radius={[4, 4, 0, 0]} fill="var(--primary)" opacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
