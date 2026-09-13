import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  LineChart,
  Line,
} from "recharts";
import { TrendingUp, TrendingDown, Activity, Users, Swords, Flame } from "lucide-react";

/**
 * 📊 مركز التحليلات العميقة — كل رقم هنا محسوب من بيانات فعلية:
 *  - اتجاهات 8 أسابيع: لاعبون جدد، جولات، تدفق نقاط، سرعة اقتصاد
 *  - احتفاظ يومي/أسبوعي + جيلات (Cohorts) لآخر 4 أسابيع
 *  - نشاط الساعات (لاختيار توقيت الأحداث والإعلانات)
 *  - مؤشر اتجاه عام: هل اللعبة صاعدة أم متراجعة؟
 */

export function AnalyticsCenter() {
  const a = useQuery(api.commandDeck.getDeepAnalytics, {});

  if (a === undefined) {
    return (
      <div dir="rtl" className="py-16 text-center text-sm text-muted-foreground">
        يجري تحليل البيانات…
      </div>
    );
  }

  const rising = a.trendScore > 0;
  const trendPct = a.weeklyTrends.length >= 2
    ? (() => {
        const t = a.weeklyTrends[a.weeklyTrends.length - 1];
        const p = a.weeklyTrends[a.weeklyTrends.length - 2];
        const base = p.newPlayers + p.rounds;
        return base === 0 ? (t.newPlayers + t.rounds > 0 ? 100 : 0) : Math.round(((t.newPlayers + t.rounds - base) / base) * 100);
      })()
    : 0;

  return (
    <div dir="rtl" className="space-y-5">
      {/* ═══ شريط المؤشرات ═══ */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { icon: Users, label: "إجمالي اللاعبين", value: a.totals.players, tone: "text-primary" },
          { icon: Activity, label: "نشِط اليوم", value: a.totals.activeToday, tone: "text-emerald-600" },
          { icon: Swords, label: "جولات مكتملة", value: a.totals.realGames, tone: "text-violet-600" },
          { icon: Flame, label: "دقة عامة", value: `${a.totals.avgAccuracy}%`, tone: "text-amber-600" },
        ].map((m) => (
          <Card key={m.label} className="border-border/70 shadow-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <m.icon className={cn("size-5 shrink-0", m.tone)} />
              <div>
                <p className="text-xl font-black leading-none">{m.value}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">{m.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ═══ مؤشر الاتجاه العام ═══ */}
      <Card className={cn("border shadow-sm", rising ? "border-emerald-500/30" : trendPct < -10 ? "border-rose-500/30" : "border-border/70")}>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          {rising ? <TrendingUp className="size-6 text-emerald-600" /> : <TrendingDown className={cn("size-6", trendPct < -10 ? "text-rose-600" : "text-muted-foreground")} />}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">{rising ? "اللعبة في مسار صاعد 🚀" : trendPct < -10 ? "تحذير: نشاط الأسبوع أقل من سابقه" : "النشاط مستقر"}</p>
            <p className="text-[11px] text-muted-foreground">
              مقارنة هذا الأسبوع بالسابق: {trendPct >= 0 ? "+" : ""}{trendPct}% (لاعبون جدد + جولات)
            </p>
          </div>
          <Badge variant="outline" className={cn("rounded-full", rising ? "border-emerald-500/40 text-emerald-600" : "border-border")}>
            درجة الاتجاه: {a.trendScore}
          </Badge>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ═══ اتجاهات أسبوعية ═══ */}
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">📈 الاتجاهات الأسبوعية — 8 أسابيع</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={a.weeklyTrends} margin={{ top: 5, right: 5, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="gPlayers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="week" tick={{ fontSize: 9 }} interval={1} />
                <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 11, direction: "rtl" }} />
                <Area type="monotone" dataKey="newPlayers" name="لاعبون جدد" stroke="hsl(var(--primary))" fill="url(#gPlayers)" strokeWidth={2} />
                <Area type="monotone" dataKey="rounds" name="جولات" stroke="#8b5cf6" fillOpacity={0} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={a.weeklyTrends} margin={{ top: 5, right: 5, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="week" tick={{ fontSize: 9 }} interval={1} />
                <YAxis tick={{ fontSize: 9 }} />
                <Tooltip contentStyle={{ fontSize: 11, direction: "rtl" }} />
                <Bar dataKey="velocity" name="سرعة الاقتصاد" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <p className="mt-1 text-[10px] text-muted-foreground">سرعة الاقتصاد = مجموع كل حركة النقاط (كسب + إنفاق) خلال الأسبوع.</p>
          </CardContent>
        </Card>

        {/* ═══ الاحتفاظ والجيلات ═══ */}
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">🔁 الاحتفاظ باللاعبين</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-center">
                <p className="text-2xl font-black text-emerald-600">{a.retention.daily}%</p>
                <p className="text-[10px] text-muted-foreground">احتفاظ يومي</p>
              </div>
              <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-3 text-center">
                <p className="text-2xl font-black text-sky-600">{a.retention.weekly}%</p>
                <p className="text-[10px] text-muted-foreground">احتفاظ أسبوعي</p>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              {a.retention.activeToday} نشِط اليوم · {a.retention.activeWeek} نشِط هذا الأسبوع · القاعدة: {a.retention.base} لاعب قبل الأسبوع الحالي
            </p>
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={a.cohorts} margin={{ top: 5, right: 5, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="label" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 9 }} unit="%" />
                <Tooltip contentStyle={{ fontSize: 11, direction: "rtl" }} />
                <Bar dataKey="retention" name="نسبة العودة" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <p className="text-[10px] text-muted-foreground">
              الجيلات: نسبة من انضمّوا في أسبوع معين ثم عادوا للعب لاحقاً — أعلى رقم = مجتمع أوفى.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ═══ النشاط الساعي ═══ */}
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
            <Activity className="size-4 text-primary" /> النشاط حسب الساعة — آخر 14 يوماً
            <Badge variant="outline" className="ms-auto rounded-full text-[10px]">ذروة اللعب: الساعة {a.hourlyActivity.reduce((b, x) => (x.v > b.v ? x : b), a.hourlyActivity[0]).hour}:00</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={170}>
            <LineChart data={a.hourlyActivity} margin={{ top: 5, right: 5, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="hour" tick={{ fontSize: 9 }} unit=":00" interval={2} />
              <YAxis tick={{ fontSize: 9 }} unit="%" />
              <Tooltip contentStyle={{ fontSize: 11, direction: "rtl" }} />
              <Line type="monotone" dataKey="pct" name="كثافة النشاط" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-muted-foreground">استخدم ذروة الساعات لتوقيت الإعلانات والأحداث المضاعفة — أكبر عدد لاعبين = أكبر أثر.</p>
        </CardContent>
      </Card>
    </div>
  );
}
